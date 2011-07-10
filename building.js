// Building content script. What you get when you click on "Enter building".
// Load combat.js before this.

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

function showShipLinks() {

  // find all TABLEs direct childs of stab, and in each one the second
  // TD, and in those the A element that calls scanId().

  var ships = new Array();
  var e;
  var ns = document.evaluate(
    "//table[@class = 'messagestyle']/tbody/tr/td/a[starts-with(@href, 'building.php?detail_type=player&detail_id=')]",
    document, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
  while((e = ns.iterateNext())) {
    // XXX - this REALLY ought to be more robust...
    var playerId = parseInt(e.search.substr(30));
    if(playerId) {
      ships.push({ id: playerId, td: e.parentNode });
    }
  }

  for(var i = 0; i < ships.length; i++) {
    var ship = ships[i];
    e = document.createElement('br');
    ship.td.appendChild(e);
    var span = document.createElement('span');
    span.style.fontSize = '11px';
    e = document.createElement('a');
    e.href = 'ship2ship_combat.php?playerid=' + ship.id;
    e.style.color = 'red';
    e.appendChild(document.createTextNode('Attack'));
    span.appendChild(e);
    span.appendChild(document.createTextNode(' · '));
    e = document.createElement('a');
    e.href = 'ship2ship_transfer.php?playerid=' + ship.id;
    e.appendChild(document.createTextNode('Trade'));
    span.appendChild(e);
    ship.td.appendChild(span);
  }
}

function run() {
  port = chrome.extension.connect();
  port.onMessage.addListener(messageHandler);
  port.postMessage({ op: 'subscribe', keys: [ 'pvbMissileAutoAll', 'navShipLinks'] });
}

run();
