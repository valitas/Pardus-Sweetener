// Ship 2 opponent content script. What you get when you're shooting NPCs.
// Load combat.js before this.

var port;
var config;
var configured;
var configmap;

function messageHandler(msg) {
  if(msg.op == 'updateValue') {
    var key = configmap[msg.key];
    if(key) {
      config[key] = msg.value;
      if(!configured && (Object.keys(config).length == Object.keys(configmap).length))
        configured = true;
      if(configured)
        sweetenCombatPage(config);
    }
  }
}

function run() {
  var host = document.location.host;
  var s = host.substr(0, host.indexOf('.'));
  var universe = s.substr(0,1).toUpperCase() + s.substr(1);

  config = new Object();
  configmap = { pvmMissileAutoAll: 'missileAutoAll',
                pvmHighestRounds:  'highestRounds'   };
  configmap[ 'autobots' + universe + 'Points' ] = 'autobotsPoints';
  configmap[ 'autobots' + universe + 'Strength' ] = 'autobotsStrength';

  port = chrome.extension.connect();
  port.onMessage.addListener(messageHandler);
  port.postMessage({ op: 'subscribe', keys: Object.keys(configmap) });
}

run();
