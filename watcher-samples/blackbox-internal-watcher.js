"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const helpers = require("./helpers");
const watcher_service_1 = require("../lib/watcher-service");
class InternalScriptWatcher extends watcher_service_1.Watcher {
    constructor() {
        super();
        this.internalScriptIds = [];
    }
    onDebugEvent(inspector, domain, name, param, nextWatcher) {
        if (domain == 'Debugger') {
            if (['scriptParsed'].includes(name)) {
                if (!param.url.startsWith('file://'))
                    this.internalScriptIds.push(param.scriptId);
                return;
            }
            if (['paused'].includes(name)) {
                inspector.enablePrint(false);
                const scriptId = helpers.getPausedScriptId(param);
                if (this.internalScriptIds.includes(scriptId)) {
                    inspector.Debugger.stepInto();
                    inspector.enableInput(false);
                    if (!this.isProcessing)
                        this.log('start processing...');
                    this.isProcessing = true;
                }
                else {
                    inspector.enablePrint(true);
                    inspector.enableInput(true);
                    if (this.isProcessing)
                        this.log('processed.');
                    this.isProcessing = false;
                }
                return;
            }
        }
        if (!this.isProcessing)
            nextWatcher();
    }
}
exports.default = InternalScriptWatcher;
