'use strict';

(function( doc ){

// All simple booleans, and all bound to a checkbox.  This simplifies
// things a bit.  Keep muteAlarm as first element (see loop in
// updateAlarmControlsDisable).
var CONFIG_KEYS = [
	'muteAlarm', 'alarmCombat', 'alarmWarning', 'alarmAlly', 'alarmPM'
];

var controls, testAlarm, openOptions, port;

function start() {
	doc.addEventListener( 'DOMContentLoaded', onDOMContentLoaded );
}

function onDOMContentLoaded() {
	controls = {};

	for ( var i = 0, end = CONFIG_KEYS.length; i < end; i++ ) {
		var key = CONFIG_KEYS[ i ], control = doc.getElementById( key );

		controls[ key ] = control;
		control.addEventListener( 'click', onSettingClick );
	}

	testAlarm = doc.getElementById( 'testAlarm' );
	testAlarm.addEventListener( 'click', onTestAlarmClick );
	//controls.muteAlarm.addEventListener( 'click', updateAlarmControlsDisable );

	openOptions = doc.getElementById( 'openOptions' );
	openOptions.addEventListener( 'click', onOpenOptions );

	// Request our configuration
	chrome.storage.local.get( CONFIG_KEYS, onConfigurationReady );
};

function onConfigurationReady( items ) {
	for ( var key in items) {
		updateControlState( controls[key], items[key] );
	}

	// Listen for changes in configuration.
	chrome.storage.onChanged.addListener( onConfigurationChange );

	// Connect to the extension. We need a connection to drive the
	// alarm test.
	port = chrome.runtime.connect();
	port.onMessage.addListener( onPortMessage );
	port.postMessage({ watchAlarm: true });
}

function onConfigurationChange( changes, area ) {
	if ( area == 'local' ) {
		for ( var key in changes ) {
			if ( controls.hasOwnProperty(key) ) {
				updateControlState( controls[key], changes[key].newValue );
			}
		}
	}
}

function updateControlState( control, value ) {
	control.checked = value;
	if ( control === controls.muteAlarm ) {
		updateAlarmControlsDisable();
	}
}

function onSettingClick( event ) {
	var control = event.target, items = {};
	items[ control.id ] = control.checked;
	chrome.storage.local.set( items );
}

function onTestAlarmClick() {
	var alarm = ( testAlarm.value != 'Stop Alarm' );
	port.postMessage({ alarm: alarm });
}

//function disableTestAlarm() {
//	port.postMessage({ alarm: false });
//	testAlarm.value = 'Test Alarm';
//	testAlarm.disabled = true;
//}

function updateAlarmControlsDisable() {
	var disabled = controls.muteAlarm.checked;

	// We start at 1, because muteAlarm is first.
	for ( var i = 1, end = CONFIG_KEYS.length; i < end; i++ ) {
		controls[ CONFIG_KEYS[i] ].disabled = disabled;
	}

	testAlarm.disabled = disabled;

/*	if ( disabled ) {
		disableTestAlarm();
	}
	else {
		testAlarm.disabled = false;
	}*/
}

function onPortMessage( message ) {
	testAlarm.value = message.alarmState ? 'Stop Alarm' : 'Test Alarm';
}

function onOpenOptions( event ) {
	var optionsUrl = chrome.extension.getURL( 'options.html' ),
		queryInfo = { url: optionsUrl },
		callback = function( tabs ) {
			if ( tabs.length ) {
				chrome.tabs.update( tabs[0].id, { active: true } );
			}
			else {
				chrome.tabs.create( queryInfo );
			}
		};

	event.preventDefault();
	chrome.tabs.query( queryInfo, callback );
}

start();

})( document );
