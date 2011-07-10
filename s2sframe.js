// Ship 2 ship content script. What you get when you're shooting people.
// Load combat.js before this.

// XXX we really can merge more code into combat.js. just holding for now til it's more mature

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
  configmap = { pvpMissileAutoAll: 'missileAutoAll',
                pvpHighestRounds:  'highestRounds'   };
  configmap[ 'autobots' + universe + 'Points' ] = 'autobotsPoints';
  configmap[ 'autobots' + universe + 'Strength' ] = 'autobotsStrength';

  port = chrome.extension.connect();
  port.onMessage.addListener(messageHandler);
  port.postMessage({ op: 'subscribe', keys: Object.keys(configmap) });
}

run();
