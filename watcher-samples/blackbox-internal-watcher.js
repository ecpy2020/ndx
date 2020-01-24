const helpers = require('./helpers');

const { Watcher } = require('../lib/watcher-service');

class BlackBoxingInternalScript extends Watcher {
    constructor() {
        super();
        this.internalScriptIds = [];
    }

    onDebugEvent(inspector, domain, name, params, nextWatcher) {
        if (domain == 'Debugger') {
            if ([ 'scriptParsed' ].includes(name)) {
                if (!params.url.startsWith('file://')) this.internalScriptIds.push(params.scriptId);

                return;
            }

            if ([ 'paused' ].includes(name)) {
                inspector.enablePrint(false);

                const scriptId = helpers.getPausedScriptId(params);

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

module.exports = BlackBoxingInternalScript;
