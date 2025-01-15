console.log("popup module loading");

// All simple booleans, and all bound to a checkbox.  This simplifies
// things a bit.  Keep muteAlarm as first element (see loop in
// updateAlarmControlsDisable).
var CONFIG_KEYS = [
  "muteAlarm",
  "alarmCombat",
  "alarmWarning",
  "alarmAlly",
  "alarmPM",
];

var controls, testAlarm, openOptions, port;

setUp();

// end of load execution

function setUp() {
  console.log("popup module setup");
  controls = {};

  for (let i = 0, end = CONFIG_KEYS.length; i < end; i++) {
    const key = CONFIG_KEYS[i],
      control = document.getElementById(key);
    controls[key] = control;
    control.addEventListener("click", onSettingClick);
  }

  testAlarm = document.getElementById("testAlarm");
  testAlarm.addEventListener("click", onTestAlarmClick);
  //controls.muteAlarm.addEventListener( 'click', updateAlarmControlsDisable );

  openOptions = document.getElementById("openOptions");
  openOptions.addEventListener("click", onOpenOptions);

  // Request our configuration
  chrome.storage.local.get(CONFIG_KEYS).then(finishConfiguration);
}

function finishConfiguration(items) {
  for (const key in items) {
    updateControlState(controls[key], items[key]);
  }

  // Listen for changes in configuration.
  chrome.storage.onChanged.addListener(onConfigurationChange);

  // Connect to the extension. We need a connection to drive the
  // alarm test.
  port = chrome.runtime.connect();
  port.onMessage.addListener(onMessage);
  port.postMessage({ watchAlarm: true });
}

function onConfigurationChange(changes, area) {
  if (area === "local") {
    for (const key in changes) {
      if (controls.hasOwnProperty(key)) {
        updateControlState(controls[key], changes[key].newValue);
      }
    }
  }
}

function updateControlState(control, value) {
  control.checked = value;
  if (control === controls.muteAlarm) {
    updateAlarmControlsDisable();
  }
}

function onSettingClick(event) {
  var control = event.target,
    items = {};
  items[control.id] = control.checked;
  chrome.storage.local.set(items);
}

function onTestAlarmClick() {
  const alarm = testAlarm.value !== "Stop Alarm";
  port.postMessage({ alarm: alarm });
}

//function disableTestAlarm() {
//	port.postMessage({ alarm: false });
//	testAlarm.value = 'Test Alarm';
//	testAlarm.disabled = true;
//}

function updateAlarmControlsDisable() {
  const disabled = controls.muteAlarm.checked;

  // We start at 1, because muteAlarm is first.
  for (let i = 1, end = CONFIG_KEYS.length; i < end; i++) {
    controls[CONFIG_KEYS[i]].disabled = disabled;
  }

  testAlarm.disabled = disabled;

  /*	if ( disabled ) {
		disableTestAlarm();
	}
	else {
		testAlarm.disabled = false;
	}*/
}

function onMessage(message) {
  console.log("popup onMessage", message);
  testAlarm.value = message.alarmState ? "Stop Alarm" : "Test Alarm";
}

function onOpenOptions(event) {
  event.preventDefault();
  chrome.runtime.openOptionsPage();
}

// start();
