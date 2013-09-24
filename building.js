// Building content script. What you get when you click on "Enter building".
// Load universe.js, combat.js and shiplinks.js before this.

var port;
var pswCombatScreenDriver;

function messageHandler(msg) {
  if(msg.op == 'updateValue' && msg.key == 'navShipLinks' && msg.value)
    showShipLinks();
}

var mslrx = /building\.php\?detail_type=([A-Za-z]+)&detail_id=(\d+)$/;
function matchShipLink(url) {
  // this could be smarter, doing proper URL-decode of the
  // building.php query string... but it isn't likely that'll be
  // needed, and it would slow things down..
  var r;
  var m = mslrx.exec(url);
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
  var configmap = { pvbMissileAutoAll:  'missileAutoAll',
                    autobots:           'autobots',
                    displayDamage:      'displayDamage',
                    previousShipStatus: 'previousShipStatus' };
  var universe = universeName();
  configmap[ 'autobots' + universe + 'Points' ] = 'autobotsPoints';
  configmap[ 'autobots' + universe + 'Strength' ] = 'autobotsStrength';

  port = chrome.extension.connect();
  pswCombatScreenDriver = new PSWCombatScreenDriver(document, port, configmap);

  port.onMessage.addListener(messageHandler);
  var keys = pswCombatScreenDriver.configkeys.concat(['navShipLinks']);
  port.postMessage({ op: 'subscribe', keys: keys });
}

run();
