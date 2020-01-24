const helpers = {

 prettyPrintObj: (obj) => console.log(JSON.stringify(obj, null, 4)),

 getPausedScriptId: (pausedPayload) => pausedPayload.callFrames[0].location.scriptId

};

module.exports = helpers;