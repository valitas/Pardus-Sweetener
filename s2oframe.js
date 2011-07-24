// Ship 2 opponent content script. What you get when you're shooting NPCs.
// Load universe.js and combat.js before this.

var port;
var pswCombatScreenDriver;

function run() {
  var configmap = { pvmMissileAutoAll:  'missileAutoAll',
                    pvmHighestRounds:   'highestRounds',
                    autobots:           'autobots',
                    displayDamage:      'displayDamage',
                    previousShipStatus: 'previousShipStatus' };
  var universe = universeName();
  configmap[ 'autobots' + universe + 'Points' ] = 'autobotsPoints';
  configmap[ 'autobots' + universe + 'Strength' ] = 'autobotsStrength';

  port = chrome.extension.connect();
  pswCombatScreenDriver = new PSWCombatScreenDriver(document, port, configmap);

  port.postMessage({ op: 'subscribe', keys: pswCombatScreenDriver.configkeys });
}

run();
