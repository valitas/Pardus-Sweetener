// Building content script. What you get when you click on "Enter building".
// Load combat.js and shiplinks.js before this.

var port;

function messageHandler(msg) {
  if(msg.op == 'updateValue') {
    switch(msg.key) {
    case 'pvbMissileAutoAll':
      if(msg.value)
        checkAllMissiles();
      break;
    case 'navShipLinks':
      if(msg.value)
        showShipLinks();
    }
  }
}

function matchShipLink(url) {
  // this could be smarter, doing proper URL-decode of the
  // building.php query string... but it isn't likely that'll be
  // needed, and it would slow things down..
  var r;
  var m = /building\.php\?detail_type=([A-Za-z]+)&detail_id=(\d+)$/.exec(url);
  if(m)
    r = { type: m[1], id: parseInt(m[2]) };

  return r;
}

function showShipLinks() {
  var ships = getShips(document,
                       "//table/tbody[tr/th = 'Other Ships']/tr/td/a",
                       matchShipLink);
  addShipLinks(ships);
}

function run() {
  port = chrome.extension.connect();
  port.onMessage.addListener(messageHandler);
  port.postMessage({ op: 'subscribe', keys: [ 'pvbMissileAutoAll', 'navShipLinks'] });
}

run();
