const { Watcher } = require('./../lib/watcher-service');

class VariablesWatcher extends Watcher {
    onDebugEvent(inspector, domain, name, params, nextWatcher) {
        if (domain == 'Runtime') {
            this.log('I am watching runtime domain calls');
        }

        nextWatcher();
    }
}

module.exports = VariablesWatcher;
