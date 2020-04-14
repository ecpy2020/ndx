export declare type InspectorEventParam = {
    scriptId: number;
    url: string;
};
declare type InspectorEventName = string;
interface Emitter {
    emit: (name: InspectorEventName, param: InspectorEventParam) => void;
}
interface Stepper {
    stepInto(): void;
}
interface Inputable {
    enableInput(enable: boolean): void;
}
interface Printable {
    enablePrint(enable: boolean): void;
}
export declare type Debugger = Stepper & Emitter;
export declare type HeapProfiler = Emitter;
export declare type Profiler = Emitter;
export declare type Runtime = Emitter;
export interface Inspector extends Printable, Inputable {
    Debugger: Debugger;
    HeapProfiler: HeapProfiler;
    Profiler: Profiler;
    Runtime: Runtime;
}
export declare type InspectorDomain = 'Debugger' | 'HeapProfiler' | 'Profiler' | 'Runtime';
declare class WatcherService {
    private _inspector;
    private _watchers;
    constructor(watchers: Watcher[], inspector: Inspector);
    overrideInspector(watchers: Watcher[], inspector: Inspector): void;
    register(watcher: Watcher): void;
}
export declare abstract class Watcher {
    abstract onDebugEvent(inspector: Inspector, domain: InspectorDomain, name: InspectorEventName, param: InspectorEventParam, nextWatcher: Function): any;
    protected log(message: any): void;
}
export declare function createWatcherService<T extends Watcher>(watchers: T[], inspector: Inspector): WatcherService;
export {};
