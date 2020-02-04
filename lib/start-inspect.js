'use strict';

const { spawn } = require('child_process');

const { EventEmitter } = require('events');

const net = require('net');

const util = require('util');

const path = require('path');

const Promise = require('bluebird');

const [ InspectClient, createRepl ] = [ require('./inspect-client'), require('./create-repl') ];

const { createWatcherService } = require('./watcher-service');

const debuglog = util.debuglog('inspect');

class StartupError extends Error {
    constructor(message) {
        super(message);
        this.name = 'StartupError';
    }
}

function portIsFree(host, port, timeout = 2000) {
    if (port === 0) return Promise.resolve(); // Binding to a random port.

    const retryDelay = 150;
    let didTimeOut = false;

    return new Promise((resolve, reject) => {
        setTimeout(() => {
            didTimeOut = true;
            reject(new StartupError(`Timeout (${timeout}) waiting for ${host}:${port} to be free`));
        }, timeout);

        function pingPort() {
            if (didTimeOut) return;

            const socket = net.connect(port, host);
            let didRetry = false;
            function retry() {
                if (!didRetry && !didTimeOut) {
                    didRetry = true;
                    setTimeout(pingPort, retryDelay);
                }
            }

            socket.on('error', (error) => {
                if (error.code === 'ECONNREFUSED') {
                    resolve();
                } else {
                    retry();
                }
            });
            socket.on('connect', () => {
                socket.destroy();
                retry();
            });
        }
        pingPort();
    });
}

function createAgentProxy(domain, client) {
    const agent = new EventEmitter();
    agent.then = (...args) => {
        // TODO: potentially fetch the protocol and pretty-print it here.
        const descriptor = {
            [util.inspect.custom](depth, { stylize }) {
                return stylize(`[Agent ${domain}]`, 'special');
            }
        };
        return Promise.resolve(descriptor).then(...args);
    };

    return new Proxy(agent, {
        get(target, name) {
            if (typeof name === 'symbol') {
                return function() {};
            }

            if (name in target) return target[name];
            return function callVirtualMethod(params) {
                return client.callMethod(`${domain}.${name}`, params);
            };
        }
    });
}

class NodeInspector {
    constructor(options, stdin, stdout) {
        this.options = options;

        this.stdin = stdin;

        this.stdout = stdout;

        this.paused = true;

        this.child = null;

        this._printEnabled = false;

        this.enablePrint = this.enablePrint.bind(this);

        // Handle all possible exits
        process.on('exit', () => this.killChild());

        process.once('SIGTERM', process.exit.bind(process, 0));

        process.once('SIGHUP', process.exit.bind(process, 0));

        if (options.script && options.server) {
            this.startServer(
                options.script,
                options.scriptArgs,
                options.host,
                options.port,
                this.childPrint.bind(this)
            );
        } else {
            this.connectServer(options.host, options.port).then(() => {
                if(options.watchers){
                    this.createWatcherService(options.watchers, this);
                }
                this.enablePrint(true)
            });
        }
    }

    createWatcherService(watcherClassesFilePath, inspector) {
        const watcherClasses = require(path.resolve(process.cwd(), watcherClassesFilePath));
        const watchers = watcherClasses.map((watcherClass) => new watcherClass());
        this._watcherService = createWatcherService(watchers, inspector);
    }

    connectServer(host, port) {
        this.client = new InspectClient();

        // init domains
        this.domainNames = [ 'Debugger', 'HeapProfiler', 'Profiler', 'Runtime' ];
        this.domainNames.forEach((domain) => {
            this[domain] = createAgentProxy(domain, this.client);
        });

        this.handleDebugEvent = (fullName, params) => {
            const [ domain, name ] = fullName.split('.');
            if (domain in this) {
                this[domain].emit(name, params);
            }
        };

        this.client.on('debugEvent', this.handleDebugEvent);

        // connect server
        this.killChild();

        let connectionAttempts = 0;
        const attemptConnect = () => {
            ++connectionAttempts;
            debuglog('connection attempt #%d', connectionAttempts);
            this.stdout.write('.');
            return this.client.connect(port, host).then(
                () => {
                    debuglog('connection established');
                    this.stdout.write(' ok');
                },
                (error) => {
                    debuglog('connect failed', error);
                    // If it's failed to connect 10 times then print failed message
                    if (connectionAttempts >= 10) {
                        this.stdout.write(' failed to connect, please retry\n');
                        process.exit(1);
                    }

                    return new Promise((resolve) => setTimeout(resolve, 1000)).then(attemptConnect);
                }
            );
        };

        this.print(`connecting to ${host}:${port} ..`, true);

        return attemptConnect()
            .then(() => {
                const startRepl = createRepl(this);
                return startRepl();
            })
            .then((repl) => {
                this.repl = repl;
                this.repl.on('exit', () => {
                    process.exit(0);
                });
                this.paused = false;

                this.configReplPrompt(this.repl);
            })
            .then(null, (error) =>
                process.nextTick(() => {
                    throw error;
                })
            );
    }

    configReplPrompt(repl) {
        const prompt = 'ndx>';
        repl._prompt = prompt;
        repl._initialPrompt = prompt;
        repl.setPrompt('ndx> ');
    }

    enablePrint(enable) {
        this._printEnabled = enable;
    }

    enableInput(enable) {
        if (enable) {
            this.stdin.resume();
        } else {
            this.stdin.pause();
        }
        this.paused = enable;
    }

    startServer(script, scriptArgs, host, port, childPrint) {
        return portIsFree(host, port).then(() => {
            return new Promise((resolve) => {
                const needDebugBrk = process.version.match(/^v(6|7)\./);
                const args = (needDebugBrk
                    ? [ '--inspect', `--debug-brk=${port}` ]
                    : [ `--inspect-brk=${port}` ]).concat([ script ], scriptArgs);
                const child = spawn(process.execPath, args);
                child.stdout.setEncoding('utf8');
                child.stderr.setEncoding('utf8');
                child.stdout.on('data', childPrint);
                child.stderr.on('data', childPrint);

                let output = '';
                function waitForListenHint(text) {
                    output += text;
                    if (/Debugger listening on ws:\/\/\[?(.+?)\]?:(\d+)\//.test(output)) {
                        const host = RegExp.$1;
                        const port = Number.parseInt(RegExp.$2);
                        child.stderr.removeListener('data', waitForListenHint);
                        resolve([ child, port, host ]);
                    }
                }

                child.stderr.on('data', waitForListenHint);
            });
        });
    }

    suspendReplWhile(fn) {
        if (this.repl) {
            this.repl.pause();
        }
        this.stdin.pause();
        this.paused = true;
        return new Promise((resolve) => {
            resolve(fn());
        })
            .then(() => {
                this.paused = false;
                if (this.repl) {
                    this.repl.resume();
                    this.repl.displayPrompt();
                }
                this.stdin.resume();
            })
            .then(null, (error) =>
                process.nextTick(() => {
                    throw error;
                })
            );
    }

    killChild() {
        if (this.client) {
            this.client.reset();
        }

        if (this.child) {
            this.child.kill();
            this.child = null;
        }
    }

    clearLine() {
        if (this.stdout.isTTY) {
            this.stdout.cursorTo(0);
            this.stdout.clearLine(1);
        } else {
            this.stdout.write('\b');
        }
    }

    print(text, oneline = false) {
        if (!this._printEnabled) return;
        this.clearLine();
        this.stdout.write(oneline ? text : `${text}\n`);
    }

    childPrint(text) {
        this.print(
            text.toString().split(/\r\n|\r|\n/g).filter((chunk) => !!chunk).map((chunk) => `< ${chunk}`).join('\n')
        );
        if (!this.paused) {
            this.repl.displayPrompt(true);
        }
        if (/Waiting for the debugger to disconnect\.\.\.\n$/.test(text)) {
            this.killChild();
        }
    }
}

const program = require('commander');

function parseArgv(argv) {
    let script;

    let scriptArgs;

    program
        .option('-s, --server', 'run as debug server')
        .option('-c, --client', 'run as debug client')
        .option('-h, --host <host>', 'host', 'localhost')
        .option('-p, --port <port>', 'port', '9229')
        .option('-w, --watchers <watchers>')
        .arguments('<file> [args...]')
        .action((_file, _args) => {
            script = _file;
            scriptArgs = _args;
        });

    program.parse(argv);

    if (program.opts().server && program.opts().client) {
        program.opts().client = false;
    }

    return {
        ...program.opts(),
        script,
        scriptArgs
    };
}

function startInspect(argv = process.argv, stdin = process.stdin, stdout = process.stdout) {
    const options = parseArgv(argv);

    const inspector = new NodeInspector(options, stdin, stdout);

    stdin.resume();

    function handleUnexpectedError(e) {
        if (!(e instanceof StartupError)) {
            console.error('There was an internal error in node-inspect. ' + 'Please report this bug.');
            console.error(e.message);
            console.error(e.stack);
        } else {
            console.error(e.message);
        }
        if (inspector.child) inspector.child.kill();
        process.exit(1);
    }

    process.on('uncaughtException', handleUnexpectedError);
    /* eslint-enable no-console */
}

exports.start = startInspect;
