// Ship 2 opponent content script. What you get when you're shooting NPCs.
// Include combat.js before this.

var port;

function messageHandler(msg) {
  if(msg.op == 'updateValue' && msg.key == 'pvmMissileAutoAll' && msg.value)
    checkAllMissiles();
}

function run() {
  port = chrome.extension.connect();
  port.onMessage.addListener(messageHandler);
  port.postMessage({ op: 'subscribe', keys: [ 'pvmMissileAutoAll' ] });
}

run();
