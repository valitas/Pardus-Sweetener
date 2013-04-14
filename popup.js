var port;
var controls;
var testAlarmButton;

function setOption(e) {
  port.postMessage({ op: 'setValue', key: e.target.id, value: e.target.checked });
}

function messageHandler(msg) {
  if(msg.op == 'updateValue') {
    var control = controls[msg.key];
    if(control) {
      control.checked = msg.value;
      if(msg.key == 'muteAlarm')
        updateAlarmControlsDisable();
    }
  }
}

function testAlarm() {
  if(testAlarmButton.value == 'Stop Alarm') {
    port.postMessage({ op: 'stopAlarm' });
    testAlarmButton.value = 'Test Alarm';
  }
  else {
    port.postMessage({ op: 'soundAlarm' });
    testAlarmButton.value = 'Stop Alarm';
  }
};

function disableTestAlarm() {
  port.postMessage({ op: 'stopAlarm' });
  testAlarmButton.value = 'Test Alarm';
  testAlarmButton.disabled = true;
}

function updateAlarmControlsDisable() {
  var disabled = controls.muteAlarm.checked;
  var keys = [ 'alarmCombat', 'alarmAlly', 'alarmPM' ];

  for(var i = 0; i < keys.length; i++)
    controls[keys[i]].disabled = disabled;
  if(disabled)
    disableTestAlarm();
  else
    testAlarmButton.disabled = false;
}

function initialise() {
  controls = new Object();
  var keys = [ 'muteAlarm', 'alarmCombat', 'alarmAlly', 'alarmPM' ];

  for(var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var control = document.getElementById(key);
    if(control) {
      controls[key] = control;
      control.addEventListener('click', setOption, false);
    }
  }

  testAlarmButton = document.getElementById('testAlarm');
  testAlarmButton.addEventListener('click', testAlarm, false);
  controls.muteAlarm.addEventListener('click', updateAlarmControlsDisable, false);

  port = chrome.extension.connect();
  port.onMessage.addListener(messageHandler);
  port.postMessage({ op: 'subscribe', keys: keys });
}

window.onload = initialise;
