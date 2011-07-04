var port;
var controls;

function setBooleanOption(e) {
  port.postMessage({ op: 'setValue', key: e.target.id, value: e.target.checked });
}

function messageHandler(msg) {
  if(msg.op == 'updateValue') {
    var control = controls[msg.key];
    if(control)
      control.checked = msg.value;
  }
}

function initialise() {
  controls = new Object();
  var keys = [ 'alarmCombat', 'alarmAlly', 'alarmPM' ];

  for(var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var control = document.getElementById(key);
    if(control) {
      controls[key] = control;
      control.addEventListener('click', setBooleanOption, false);
    }
  }

  port = chrome.extension.connect();
  port.onMessage.addListener(messageHandler);
  port.postMessage({ op: 'subscribe', keys: keys });
}
