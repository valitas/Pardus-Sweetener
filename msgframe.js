// include the VClock before this

var port;
var clock;
var indicators = {
  'icon_amsg.png':    'Ally',
  'icon_combat.png':  'Combat',
  'icon_mission.png': 'Mission',
  'icon_msg.png':     'PM',
  'icon_pay.png':     'Payment',
  'icon_trade.png':   'Trade',
  'gnome-error.png':  'Warning',
  'gnome-info.png':   'Info'
};

function scanForNotifications() {
  var r = new Object();
  var any = false;
  var imgs = document.getElementsByTagName('img');
  for(var i = 0; i < imgs.length; i++) {
    var src = imgs[i].src;
    var offset = src.lastIndexOf('/');
    if(offset >= 0) {
      src = src.substr(offset+1);
      var ind = indicators[src];
      if(ind) {
        r[ind] = true;
        any = true;
      }
    }
  }

  // Get the character name
  var name;
  var u = document.getElementById('universe');
  if(u && u.alt) {
    name = u.alt;
    var offset = name.indexOf(':');
    if(offset >= 0 && offset+2 < name.length)
      name = name.substr(offset+2);
  }

  //chrome.extension.sendRequest(req, function(response) { });
  port.postMessage({ 'op': 'dispatchNotifications',
                     'character_name': name,
                     'indicators': r });

  clock.sink(any);
}

function messageHandler(msg) {
  if(msg.op == 'updateValue' && msg.key.substr(0,5) == 'clock')
    clock.setEnabled(msg.key.substr(5), msg.value);
}

function run() {
  port = chrome.extension.connect();
  clock = new VClock(document);

  port.onMessage.addListener(messageHandler);
  port.postMessage({ op: 'subscribe',
                     keys: [ 'clockUTC', 'clockAP', 'clockB', 'clockP', 'clockS',
                             'clockL', 'clockE', 'clockN', 'clockZ', 'clockR' ] });

  clock.start();
  scanForNotifications();
}

run();
