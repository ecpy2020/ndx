# ndx
extended node debugger server and client cli on v8 debugger protocol for debugging large Nodejs Applications 

## features
- able to register watchers to automate the debugging process 
- ```Watcher#onDebugEvent``` interface returns inspector object based on [v8 debugger protocol](https://chromedevtools.github.io/devtools-protocol/v8)
- watcher enables to blackbox and stepover the custom or internal scripts when stepping and trace function calls and variables
- separated server executable and client cli makes debugging dockerized node app possible 

## pending works
- [x] add typings to watchers
- [ ] support debugging typescript application with source map support
- [ ] update the cli interface for readability
- [ ] support <a href="https://nestjs.com/">Nestjs</a> framework debugging by providing NestJs Watchers

## demo
<img src="https://github.com/ecpy/ndx/raw/master/demo/ndx.gif" width=600>

## install
```bash
yarn global add @ecpy/ndx

# help
npx @ecpy/ndx --help

# launch debug server
npx @ecpy/ndx -s -h localhost -p 3000 $APP 

# launch as debug cli client with watchers
npx @ecpy/ndx -c -h localhost -p 3000 -w $WATCHERS_FILE
```

## examples
- watcher samples are located at ${PACKAGE_ROOT}/watcher-samples

```bash
cd $PACKAGE_ROOT

# test server
./cli.js -s -h localhost -p 3000 ./app-sample 

```

```bash
# test client
./cli.js -c -h localhost -p 3000 -w ./watcher-samples/index.js

ndx> pause

ndx> next

# debug APIs
ndx> help
```

- watcher class structure
```ts
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
```

## debug APIs
- protocol method calls are defined on the inspector object returned by ```Watcher#onDebugEvent``` interface, see [v8 debugger protocol](https://chromedevtools.github.io/devtools-protocol/v8)

## development
- parts of the debugger structure is referenced from [node-inspect](https://github.com/nodejs/node-inspect)  

<img src="https://github.com/ecpy/ndx/raw/master/structure.png" height="500">

