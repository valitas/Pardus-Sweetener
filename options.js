// Pardus Sweetener
// The wiring of the options page.

'use strict';

(function( doc ) {

var controls, extraControls, port;

function start() {
	doc.addEventListener( 'DOMContentLoaded', onDOMContentLoaded );
}

function onDOMContentLoaded() {
	var keys, i, end;

	controls = {};
	extraControls = {};

	// Find all these elements in the document, save references to
	// them in xControls.
	keys = [
		'showAlarmGroup', 'showCombatGroup', 'showGeneralGroup',
		'showHelpGroup', 'alarmGroup', 'combatGroup', 'generalGroup',
		'helpGroup', 'testAlarm', 'testNotification', 'version'
	];

	for ( i = 0, end = keys.length; i < end; i++ ) {
		var key = keys[ i ];
		extraControls[ key ] = doc.getElementById( key );
	}

	// Find the rest of the controls, save references to them in
	// controls, and install event listeners.
	//
	// That's a lot of initialisation... we'll define a helper
	// function.
	function setupControls() {
		var event = arguments[0], listener = arguments[1];

		for ( var i = 2, end = arguments.length; i < end; i++ ) {
			var key = arguments[ i ], control = doc.getElementById( key );
			controls[ key ] = control;
			control.addEventListener( event, listener );
		}
	};

	// 1. Checkboxes
	setupControls ( 'click', onCheckboxClick,
		'muteAlarm', 'alarmCombat', 'alarmAlly', 'alarmWarning', 'alarmPM',
		'alarmMission', 'alarmTrade', 'alarmPayment', 'desktopCombat',
		'desktopAlly', 'desktopWarning', 'desktopPM', 'desktopMission',
		'desktopTrade', 'desktopPayment', 'clockUTC', 'clockAP', 'clockB',
		'clockP', 'clockS', 'clockL', 'clockE', 'clockN', 'clockZ', 'clockR',
		'pvpMissileAutoAll', 'pvpHighestRounds', 'pvmMissileAutoAll',
		'pvmHighestRounds', 'pvbMissileAutoAll', 'displayDamage', 'autobots',
		'navShipLinks', 'navEquipmentLink', 'navTradeLink',
		'navBlackMarketLink', 'navHackLink', 'navBulletinBoardLink',
		'navBountyBoardLink', 'navShipyardLink', 'navCrewQuartersLink',
		'navFlyCloseLink', 'allianceQLsArtemisEnabled',
		'personalQLArtemisEnabled', 'allianceQLsOrionEnabled',
		'personalQLOrionEnabled', 'allianceQLsPegasusEnabled',
		'personalQLPegasusEnabled', 'overrideAmbushRounds',
		'fitAmbushRounds', 'miniMap', 'sendmsgShowAlliance', 'onlinelistEnabled', 
		'pathfindingEnabled');

	// 2. Free-form strings
	setupControls ( 'input', onControlInput,
		'personalQLArtemis', 'personalQLOrion', 'personalQLPegasus', 'onlinelist' );

	// 3. Numeric fields
	setupControls ( 'input', onNumericControlInput,
		'autobotsArtemisPoints', 'autobotsOrionPoints',
		'autobotsPegasusPoints', 'pathfindingPercentage');

	// 4. Selects
	setupControls ( 'change', onControlInput,
		'alarmSound', 'autobotsArtemisPreset', 'autobotsOrionPreset',
		'autobotsPegasusPreset', 'miniMapPlacement' );

	// 5. Selects that we store as numbers, cause we use the value
	setupControls ( 'change', onNumericControlInput,
		'autobotsArtemisStrength', 'autobotsOrionStrength',
		'autobotsPegasusStrength');

	extraControls.version.textContent = chrome.runtime.getManifest().version;

	// Install additional listeners
	function wireGroupSwitch( button, group ) {
		var listener = function() { onShowGroupClick( button, group ); };
		button.addEventListener( 'click', listener );
	}
	wireGroupSwitch( extraControls.showAlarmGroup,
					 extraControls.alarmGroup );
	wireGroupSwitch( extraControls.showCombatGroup,
					 extraControls.combatGroup );
	wireGroupSwitch( extraControls.showGeneralGroup,
					 extraControls.generalGroup );
	wireGroupSwitch( extraControls.showHelpGroup,
					 extraControls.helpGroup);

	extraControls
		.testAlarm.addEventListener( 'click', onTestAlarmClick );
	extraControls.testNotification
		.addEventListener( 'click', onTestNotificationClick );
	controls.muteAlarm
		.addEventListener( 'click', updateAlarmControlsDisable );
	controls.autobots
		.addEventListener( 'click', updateAutobotControlsDisable );
	controls.miniMap
		.addEventListener( 'click', updateMiniMapControlsDisable );

	function wireAutobotsPreset( preset, points ) {
		var
		presetListener =
			function() { onAutobotsPresetChange( preset, points ); },
		pointsListener =
			function() { onAutobotsPointsInput( preset, points ); };

		preset.addEventListener( 'change', presetListener );
		points.addEventListener( 'input', pointsListener );
	}
	wireAutobotsPreset( controls.autobotsArtemisPreset,
						controls.autobotsArtemisPoints );
	wireAutobotsPreset( controls.autobotsOrionPreset,
						controls.autobotsOrionPoints );
	wireAutobotsPreset( controls.autobotsPegasusPreset,
						controls.autobotsPegasusPoints );
	// We steal some functions from other controls to wire the pathfinding.
	wireAutobotsPreset( controls.pathfindingEnabled,
						controls.pathfindingPercentage );
	wireQLControls ( controls.pathfindingEnabled,
					 controls.pathfindingPercentage );
	// And another shorthand
	function wireQLControls( enabled, ql ) {
		var listener = function() { onQLEnabledClick( enabled, ql ); };
		enabled.addEventListener( 'change', listener );
	}
	wireQLControls( controls.personalQLArtemisEnabled,
					controls.personalQLArtemis );
	wireQLControls( controls.personalQLOrionEnabled,
					controls.personalQLOrion );
	wireQLControls( controls.personalQLPegasusEnabled,
					controls.personalQLPegasus );
	wireQLControls( controls.onlinelistEnabled,
					controls.onlinelist );
					
	// Request the configuration
	chrome.storage.local.get( Object.keys( controls ),
							  onConfigurationReady );
}

function onConfigurationReady( items ) {
	for ( var key in items ) {
		var control = controls[ key ];
		if ( control ) {
			updateControlState( control, items[ key ] );
		}
	}

	// Listen for changes in configuration.
	chrome.storage.onChanged.addListener( onConfigurationChange );

	// Connect to the extension and ask for updates on alarm state.
	port = chrome.extension.connect();
	port.onMessage.addListener( onPortMessage );
	port.postMessage({ watchAlarm: true });
}

function onConfigurationChange( changes, area ) {
	if ( area == 'local' ) {
		for ( var key in changes ) {
			var control = controls[ key ];
			if ( control ) {
				updateControlState( control, changes[key].newValue );
			}
		}
	}
}

function onPortMessage( msg ) {
	if ( msg.hasOwnProperty( 'alarmState' ) ) {
		extraControls.testAlarm.value = msg.alarmState ? 'Stop' : 'Test';
	}
}

function onShowGroupClick( groupButton, group ) {
	var i, end, keys;

	keys = [ 'showAlarmGroup', 'showCombatGroup', 'showGeneralGroup',
			 'showHelpGroup' ];
	for ( i = 0, end = keys.length; i < end; i++ ) {
		extraControls[ keys[i] ].parentNode.classList.remove( 'selected' );
	}

	keys = [ 'alarmGroup', 'combatGroup', 'generalGroup', 'helpGroup' ];
	for ( i = 0, end = keys.length; i < end; i++ ) {
		extraControls[ keys[i] ].classList.remove( 'selected' );
	}

	groupButton.parentNode.classList.add( 'selected' );
	group.classList.add( 'selected' );
	group.scrollIntoView( true );
}

function onTestAlarmClick() {
	var message = { alarm: ( extraControls.testAlarm.value == 'Test' ) };
	port.postMessage( message );
}

function onTestNotificationClick() {
	var message = {
		desktopNotification: 'You requested a sample desktop notification.',
		timeout: 4000
	};

	chrome.runtime.sendMessage( message, function(){} );
}

function onCheckboxClick( event ) {
	var target = event.target, items = {};

	items[ target.id ] = target.checked;
	chrome.storage.local.set( items );
}

function onControlInput( event ) {
	var target = event.target, items = {};

	items[ target.id ] = target.value;
	chrome.storage.local.set( items );
}

// This is like the above, but only allows numeric values greater than
// 1.  One day we may need more sophistication...
function onNumericControlInput( event ) {
	var target = event.target, m = /^\s*(\d+)\s*$/.exec( target.value ),
		value = m ? parseInt( m[1] ) : NaN;

	if ( value > 0 ) {
		target.style.color = null;
		var items = {};
		items[ target.id ] = value;
		chrome.storage.local.set( items );
	}
	else {
		target.style.color = 'red';
	}
}

function updateControlState( control, value ) {
	switch ( control.type ) {
	case 'checkbox':
		control.checked = value;
		switch ( control.id ) {
		case 'autobots':
			updateAutobotControlsDisable();
			break;
		case 'muteAlarm':
			updateAlarmControlsDisable();
			break;
		case 'personalQLArtemisEnabled':
		case 'personalQLOrionEnabled':
		case 'personalQLPegasusEnabled':
		case 'onlinelistEnabled':
			updateQLControlsDisable();
			break;
		case 'miniMap':
			updateMiniMapControlsDisable();
		}
		break;
	case 'select-one':
		updateSelectState( control, value );
		break;
	case 'text':
	case 'textarea':
		control.value = value;
	}
}

// Find the option with a given value (not name or id), and select it
function updateSelectState( control, value ) {
	var options = control.options;

	for ( var i = 0, end = options.length; i < end; i++ ) {
		var option = options[ i ];

		if ( option.value == value ) {
			option.selected = true;
			return;
		}
	}
}

function updateAlarmControlsDisable() {
	var disabled = controls.muteAlarm.checked,
		keys = [ 'alarmSound', 'alarmCombat', 'alarmAlly', 'alarmWarning',
			'alarmPM', 'alarmMission', 'alarmTrade', 'alarmPayment' ];

	extraControls.testAlarm.disabled = disabled;
	for ( var i = 0, end = keys.length; i < end; i++ ) {
		controls[ keys[i] ].disabled = disabled;
	}
}

function updateAutobotControlsDisable() {
	var disabled = !controls.autobots.checked,
		keys = [ 'autobotsArtemisPreset', 'autobotsArtemisPoints',
			'autobotsArtemisStrength', 'autobotsOrionPreset',
			'autobotsOrionPoints', 'autobotsOrionStrength',
			'autobotsPegasusPreset', 'autobotsPegasusPoints',
			'autobotsPegasusStrength' ];

	for ( var i = 0, end = keys.length; i < end; i++ ) {
		controls[ keys[i] ].disabled = disabled;
	}
}

function onAutobotsPresetChange( preset, points ) {
	var presetPoints, items;

	presetPoints = parseInt( preset.value );
	if ( presetPoints > 0 ) {
		points.value = presetPoints;
	}

	items = {};
	items[ points.id ] = presetPoints;
	chrome.storage.local.set( items );
}

function onAutobotsPointsInput( preset, points ) {
	var items;

	if ( parseInt(points.value) != parseInt(preset.value) ) {
		preset.selectedIndex = 0;
		items = {};
		items[ preset.id ] = '0';
		chrome.storage.local.set( items );
	}
}

function onQLEnabledClick( enabledCheckbox, qlField ) {
	qlField.disabled = !enabledCheckbox.checked;
}

function updateQLControlsDisable() {
	controls.personalQLArtemis.disabled =
		!controls.personalQLArtemisEnabled.checked;
	controls.personalQLOrion.disabled =
		!controls.personalQLOrionEnabled.checked;
	controls.personalQLPegasus.disabled =
		!controls.personalQLPegasusEnabled.checked;
	controls.onlinelist.disabled = 
		!controls.onlinelistEnabled.checked;
}

function updateMiniMapControlsDisable() {
	controls.miniMapPlacement.disabled = !controls.miniMap.checked;
}

// Start the ball
start( doc );

})( document );
