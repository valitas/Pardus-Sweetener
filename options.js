// Pardus Sweetener
// The wiring of the options page.

var port;
var controls;
var testAlarmButton;
var testNotifierButton;

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

function testNotification() {
  port.postMessage({ op: 'testNotification' });
}

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
    if(control.id == 'autobots')
      updateAutobotControlsDisable();
    break;
  case 'select-one':
    updateSelectState(control, value);
    break;
  case 'text':
    control.value = value;
  }
}

// Find the option with a given *value* (not name or id), and select it
function updateSelectState(control, value) {
  var opts = control.options;
  for(var i = 0; i < opts.length; i++) {
    var opt = opts[i];
    if(opt.value == value) {
      opt.selected = true;
      break;
    }
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
    o.appendChild(doc.createTextNode(entry.name));
    control.appendChild(o);
  }
};

function updateAutobotControlsDisable() {
  var disabled = !controls.autobots.checked;
  var keys = [ 'autobotsArtemisPreset', 'autobotsArtemisPoints', 'autobotsArtemisStrength',
               'autobotsOrionPreset',   'autobotsOrionPoints',   'autobotsOrionStrength',
               'autobotsPegasusPreset', 'autobotsPegasusPoints', 'autobotsPegasusStrength' ];

  for(var i = 0; i < keys.length; i++)
    controls[keys[i]].disabled = disabled;
}

function wireAutobotPreset(preset, points) {
  preset.addEventListener('change',
    function() {
      var v = parseInt(preset.value);
      if(v > 0)
        points.value = v;
        port.postMessage({ op: 'setValue', key: points.id, value: v });
    }, false);
  points.addEventListener('keyup',
    function() {
      if(parseInt(points.value) != parseInt(preset.value)) {
        preset.selectedIndex = 0;
        port.postMessage({ op: 'setValue', key: preset.id, value: 0 });
      }
    }, false);
}

function wireAutobotControls() {
  if(controls.autobots)
    controls.autobots.addEventListener('click', updateAutobotControlsDisable, false);

  var keys = [ [ 'autobotsArtemisPreset', 'autobotsArtemisPoints' ],
               [ 'autobotsOrionPreset',   'autobotsOrionPoints'   ],
               [ 'autobotsPegasusPreset', 'autobotsPegasusPoints' ] ];
  var pair, preset, points;
  for(var i = 0; i < keys.length; i++) {
    pair = keys[i];
    preset = controls[pair[0]];
    points = controls[pair[1]];
    if(preset && points)
      wireAutobotPreset(preset, points);
  }
}


function initialise() {
  var keys = [ 'alarmSound',
               'alarmCombat', 'alarmAlly', 'alarmWarning', 'alarmPM',
               'alarmMission', 'alarmTrade', 'alarmPayment', 'alarmInfo',
               'desktopCombat', 'desktopAlly', 'desktopWarning', 'desktopPM',
               'desktopMission', 'desktopTrade', 'desktopPayment', 'desktopInfo',
               'clockUTC', 'clockAP', 'clockB', 'clockP', 'clockS',
               'clockL', 'clockE', 'clockN', 'clockZ', 'clockR',
               'pvpMissileAutoAll', 'pvmMissileAutoAll',
               'autobots',
               'autobotsArtemisPreset', 'autobotsArtemisPoints', 'autobotsArtemisStrength',
               'autobotsOrionPreset', 'autobotsOrionPoints', 'autobotsOrionStrength',
               'autobotsPegasusPreset', 'autobotsPegasusPoints', 'autobotsPegasusStrength',

               'navEquipmentLink', 'navPlanetTradeLink', 'navSBTradeLink', 'navBldgTradeLink',
               'navBMLink', 'navHackLink', 'navBBLink',
               'navShipLinks' ];

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
        break;
      case 'text':
        // keyup may be a bit much...
        control.addEventListener('keyup', setStringOption, false);
      }
    }
  }

  testAlarmButton = document.getElementById('testAlarm');
  if(testAlarmButton) {
    testAlarmButton.addEventListener('click', testAlarm, false);
    controls.alarmSound.addEventListener('change', disableTestAlarm, false);
  }

  testNotifierButton = document.getElementById('testNotifier');
  if(testNotifierButton)
    testNotifierButton.addEventListener('click', testNotification, false);

  wireAutobotControls();

  port = chrome.extension.connect();
  port.onMessage.addListener(messageHandler);
  port.postMessage({ op: 'requestList', name: 'alarmSound' });
  port.postMessage({ op: 'subscribe', keys: keys });
}
