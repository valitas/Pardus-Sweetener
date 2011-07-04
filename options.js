// Pardus Sweetener
// The wiring of the options page.

var port;
var controls;
var testAlarmButton;

function disableTestAlarm() {
  port.postMessage({ op: 'stopAlarm' });
  testAlarmButton.value = 'Test';
  testAlarmButton.disabled = true;
}

function testAlarm() {
  if(testAlarmButton.value == 'Stop') {
    port.postMessage({ op: 'stopAlarm' });
    testAlarmButton.value = 'Test';
  }
  else {
    var i = controls.alarmSound.selectedIndex;
    if(i >= 0) {
      testAlarmButton.value = 'Stop';
      port.postMessage({ op: 'soundAlarm' });
    }
  }
};

function setBooleanOption(e) {
  port.postMessage({ op: 'setValue', key: e.target.id, value: e.target.checked });
}

function setStringOption(e) {
  port.postMessage({ op: 'setValue', key: e.target.id, value: e.target.value });
}

function messageHandler(msg) {
  var control;
  switch(msg.op) {
  case 'updateValue':
    control = controls[msg.key];
    if(control)
      updateControlState(control, msg.value);
    break;
  case 'updateList':
    control = controls[msg.name];
    if(control)
      populateSelectControl(control, msg.list);
    break;
  case 'sampleReady':
    if(testAlarmButton)
      testAlarmButton.disabled = false;
  }
}

function updateControlState(control, value) {
  switch(control.type) {
  case 'checkbox':
    control.checked = value;
    break;
  case 'select-one':
    var opt = control.options.namedItem(value);
    if(opt)
      opt.selected = true;
  }
}

function populateSelectControl(control, list) {
  while(control.hasChildNodes())
    control.removeChild(control.firstChild);

  var doc = control.ownerDocument;

  for(var i = 0; i < list.length; i++) {
    var entry = list[i];
    var o = doc.createElement('option');
    o.setAttribute('value', entry.id);
    o.setAttribute('name', entry.id);
    o.appendChild(doc.createTextNode(entry.name));
    control.appendChild(o);
  }
};


function initialise() {
  var keys = [ 'alarmSound',
               'alarmCombat', 'alarmAlly', 'alarmWarning', 'alarmPM',
               'alarmMission', 'alarmTrade', 'alarmPayment', 'alarmInfo',
               'desktopCombat', 'desktopAlly', 'desktopWarning', 'desktopPM',
               'desktopMission', 'desktopTrade', 'desktopPayment', 'desktopInfo',
               'clockUTC', 'clockAP', 'clockB', 'clockP', 'clockS',
               'clockL', 'clockE', 'clockN', 'clockZ', 'clockR',
               'pvpMissileAutoAll', 'pvmMissileAutoAll' ];

  controls = new Object();

  for(var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var control = document.getElementById(key);
    if(control) {
      controls[key] = control;
      switch(control.type) {
      case 'checkbox':
        control.addEventListener('click', setBooleanOption, false);
        break;
      case 'select-one':
        control.addEventListener('change', setStringOption, false);
      }
    }
  }

  testAlarmButton = document.getElementById('testAlarm');
  if(testAlarmButton) {
    testAlarmButton.addEventListener('click', testAlarm);
    controls.alarmSound.addEventListener('change', disableTestAlarm);
  }

  port = chrome.extension.connect();
  port.onMessage.addListener(messageHandler);
  port.postMessage({ op: 'requestList', name: 'alarmSound' });
  port.postMessage({ op: 'subscribe', keys: keys });
}
