import { Watcher, Inspector, InspectorEventParam, InspectorDomain } from '../lib/watcher-service';
export default class InternalScriptWatcher extends Watcher {
    private internalScriptIds;
    private isProcessing;
    constructor();
    onDebugEvent(inspector: Inspector, domain: InspectorDomain, name: string, param: InspectorEventParam, nextWatcher: Function): void;
}
