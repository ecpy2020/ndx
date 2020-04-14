import * as helpers from './helpers';

import { Watcher, Inspector, InspectorEventParam, InspectorDomain } from '../lib/watcher-service';

export default class InternalScriptWatcher extends Watcher {

    private internalScriptIds: number[]
    private isProcessing: boolean

    constructor() {
        super();
        this.internalScriptIds = [];
    }
    onDebugEvent(inspector: Inspector, domain: InspectorDomain, name: string, param: InspectorEventParam, nextWatcher: Function) {
        if (domain == 'Debugger') {
            if (['scriptParsed'].includes(name)) {
                if (!param.url.startsWith('file://')) this.internalScriptIds.push(param.scriptId);

                return;
            }

            if (['paused'].includes(name)) {
                inspector.enablePrint(false);

                const scriptId = helpers.getPausedScriptId(param);

                if (this.internalScriptIds.includes(scriptId)) {
                    inspector.Debugger.stepInto();
                    inspector.enableInput(false);

                    if (!this.isProcessing) this.log('start processing...');

                    this.isProcessing = true;
                } else {
                    inspector.enablePrint(true);
                    inspector.enableInput(true);

                    if (this.isProcessing) this.log('processed.');

                    this.isProcessing = false;
                }

                return;
            }
        }

        if (!this.isProcessing) nextWatcher();
    }
}
