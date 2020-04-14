"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Promise = require("bluebird");
class WatcherService {
    constructor(watchers, inspector) {
        this._inspector = inspector;
        this._watchers = watchers;
        Promise.each(this._watchers, (watcher) => this.register(watcher));
        this.overrideInspector(watchers, inspector);
    }
    overrideInspector(watchers, inspector) {
        const domainNames = ['Debugger', 'HeapProfiler', 'Profiler', 'Runtime'];
        domainNames.forEach((domain) => {
            const original_emit = inspector[domain].emit.bind(inspector[domain]);
            inspector[domain].emit = function (name, param) {
                let i = 0;
                let nextWatcher;
                nextWatcher = () => {
                    if (i >= watchers.length)
                        return;
                    i += 1;
                    watchers[i - 1].onDebugEvent(inspector, domain, name, param, nextWatcher);
                    original_emit(name, param);
                };
                nextWatcher();
            };
        });
    }
    register(watcher) {
        this._watchers.push(watcher);
    }
}
const chalk = require("chalk");
class Watcher {
    log(message) {
        console.log(chalk.yellow(`${this.constructor.name}: ${message}`));
    }
}
exports.Watcher = Watcher;
let _watcherService;
function createWatcherService(watchers, inspector) {
    if (_watcherService)
        return _watcherService;
    _watcherService = new WatcherService(watchers, inspector);
    return _watcherService;
}
exports.createWatcherService = createWatcherService;
