import * as Promise from 'bluebird'

export type InspectorEventParam = { scriptId: number, url: string }
type InspectorEventName = string

interface Emitter {
    emit: (name: InspectorEventName, param: InspectorEventParam) => void
}

interface Stepper {
    stepInto(): void
}
interface Inputable {
    enableInput(enable: boolean): void
}
interface Printable {
    enablePrint(enable: boolean): void
}

export type Debugger = Stepper & Emitter
export type HeapProfiler = Emitter
export type Profiler = Emitter
export type Runtime = Emitter

export interface Inspector extends Printable, Inputable {
    Debugger: Debugger
    HeapProfiler: HeapProfiler
    Profiler: Profiler
    Runtime: Runtime
}

export type InspectorDomain = 'Debugger' | 'HeapProfiler' | 'Profiler' | 'Runtime'

class WatcherService {

    private _inspector: Inspector

    private _watchers: Watcher[]

    constructor(watchers: Watcher[], inspector: Inspector) {

        this._inspector = inspector;

        this._watchers = watchers;

        Promise.each(this._watchers, (watcher) => this.register(watcher));

        this.overrideInspector(watchers, inspector);

    }

    overrideInspector(watchers: Watcher[], inspector: Inspector): void {
        const domainNames: InspectorDomain[] = ['Debugger', 'HeapProfiler', 'Profiler', 'Runtime'];

        domainNames.forEach((domain: InspectorDomain) => {
            const original_emit = inspector[domain].emit.bind(inspector[domain]);

            inspector[domain].emit = function (name, param) {
                let i = 0;

                let nextWatcher;

                nextWatcher = () => {
                    if (i >= watchers.length) return;

                    i += 1;

                    watchers[i - 1].onDebugEvent(inspector, domain, name, param, nextWatcher);

                    original_emit(name, param);
                };

                nextWatcher();
            };
        });
    }

    register(watcher: Watcher): void {
        this._watchers.push(watcher);
    }
}

import * as chalk from 'chalk';

export abstract class Watcher {

    abstract onDebugEvent(inspector: Inspector, domain: InspectorDomain, name: InspectorEventName, param: InspectorEventParam, nextWatcher: Function)

    protected log(message: any): void {
        console.log(chalk.yellow(`${this.constructor.name}: ${message}`));
    }
}

let _watcherService: WatcherService;

export function createWatcherService<T extends Watcher>(watchers: T[], inspector: Inspector): WatcherService {
    if (_watcherService) return _watcherService;
    _watcherService = new WatcherService(watchers, inspector);
    return _watcherService;
}
