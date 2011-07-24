// Ship 2 ship content script. What you get when you're shooting people.
// Load combat.js before this.

var port;
var pswCombatScreenDriver;

function run() {
  port = chrome.extension.connect();
  pswCombatScreenDriver =
    new PSWCombatScreenDriver(document,
                              port,
                              { pvpMissileAutoAll:  'missileAutoAll',
                                pvpHighestRounds:   'highestRounds',
                                displayDamage:      'displayDamage',
                                previousShipStatus: 'previousShipStatus' });

  port.postMessage({ op: 'subscribe', keys: pswCombatScreenDriver.configkeys });
}

run();
