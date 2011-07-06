// Ship 2 ship content script. What you get when you're shooting people.
// Include combat.js before this.

var port;

function messageHandler(msg) {
  if(msg.op == 'updateValue' && msg.key == 'pvpMissileAutoAll' && msg.value)
    checkAllMissiles();
}

function run() {
  port = chrome.extension.connect();
  port.onMessage.addListener(messageHandler);
  port.postMessage({ op: 'subscribe', keys: [ 'pvpMissileAutoAll' ] });
}

run();
