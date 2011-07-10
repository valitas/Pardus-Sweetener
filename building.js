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
  // find the table which contains the "Other Ships" legend, add the
  // links to it
  var xpr = document.evaluate(
    "//table[@class = 'messagestyle' and tbody/tr/th = 'Other Ships']",
    document, null, XPathResult.ANY_UNORDERED_NODE_TYPE, null);
  if(xpr && xpr.singleNodeValue)
    addShipLinks(xpr.singleNodeValue, matchShipLink, null);
}

function run() {
  port = chrome.extension.connect();
  port.onMessage.addListener(messageHandler);
  port.postMessage({ op: 'subscribe', keys: [ 'pvbMissileAutoAll', 'navShipLinks'] });
}

run();
