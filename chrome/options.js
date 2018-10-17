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
	keys = [ 'testAlarm', 'testNotification', 'version' ];

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
	setupControls (
		'click', onCheckboxClick,
		'muteAlarm', 'alarmCombat', 'alarmAlly', 'alarmWarning', 'alarmPM',
		'alarmMission', 'alarmTrade', 'alarmPayment', 'desktopCombat',
		'desktopAlly', 'desktopWarning', 'desktopPM', 'desktopMission',
		'desktopTrade', 'desktopPayment', 'clockUTC', 'clockAP', 'clockB',
		'clockP', 'clockS', 'clockL', 'clockE', 'clockN', 'clockZ', 'clockR', 'clockD', 'clockStim',
		'pvpMissileAutoAll', 'pvpHighestRounds', 'pvmMissileAutoAll',
		'pvmHighestRounds', 'pvbMissileAutoAll', 'displayDamage', 'autobots',
		'navShipLinks', 'navEquipmentLink', 'navTradeLink',
		'navBlackMarketLink', 'navHackLink', 'navBulletinBoardLink',
		'navBountyBoardLink', 'navShipyardLink', 'navCrewQuartersLink',
		'navFlyCloseLink', 'allianceQLsArtemisEnabled',
		'personalQLArtemisEnabled', 'allianceQLsOrionEnabled',
		'personalQLOrionEnabled', 'allianceQLsPegasusEnabled',
		'personalQLPegasusEnabled', 'overrideAmbushRounds',
		'fitAmbushRounds', 'miniMap', 'sendmsgShowAlliance',
		'artemisOnlineListEnabled', 'orionOnlineListEnabled',
		'pegasusOnlineListEnabled', 'pathfindingEnabled'
	);

	// 2. Free-form strings
	setupControls (
		'input', onControlInput,
		'personalQLArtemis', 'personalQLOrion', 'personalQLPegasus',
		'artemisOnlineList', 'orionOnlineList', 'pegasusOnlineList' );

	// 3. Numeric fields
	setupControls ( 'input', onNumericControlInput,
		'autobotsArtemisPoints', 'autobotsOrionPoints',
		'autobotsPegasusPoints' );

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
	// Reuse the QL UI handling code for these because it does the same thing
	wireQLControls( controls.artemisOnlineListEnabled,
			controls.artemisOnlineList );
	wireQLControls( controls.orionOnlineListEnabled,
			controls.orionOnlineList );
	wireQLControls( controls.pegasusOnlineListEnabled,
			controls.pegasusOnlineList );

	// Request the configuration
	chrome.storage.local.get( Object.keys( controls ), onConfigurationReady );

	// Install a click handler that we'll use to show/collapse sections.
	doc.body.addEventListener( 'click', onBodyClick, null );
}

function onBodyClick( event ) {
	var h3, section, s, i, end, open;

	h3 = event.target;
	if( !h3 || h3.tagName != 'H3' )
		return;
	section = h3.parentElement;
	if( !section ||
	    section.tagName != 'SECTION' ||
	    section.parentElement != doc.body )
		return;

	event.preventDefault();
	open = section.classList.contains( 'active' );

	var xpr = doc.evaluate('/html/body/section', doc, null,
			       XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null);
	for( i = 0, end = xpr.snapshotLength; i < end; i++ )
		xpr.snapshotItem( i ).classList.remove( 'active' );

	if( !open ) {
		section.classList.add( 'active' );
		section.scrollIntoView( true );
	}
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
	port = chrome.runtime.connect();
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
			updateQLControlsDisable();
			break;
		case 'artemisOnlineListEnabled':
		case 'orionOnlineListEnabled':
		case 'pegasusOnlineListEnabled':
			updateOnlineListControlsDisable();
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
}

function updateOnlineListControlsDisable() {
	controls.artemisOnlineList.disabled =
		!controls.artemisOnlineListEnabled.checked;
	controls.orionOnlineList.disabled =
		!controls.orionOnlineListEnabled.checked;
	controls.pegasusOnlineList.disabled =
		!controls.pegasusOnlineListEnabled.checked;
}

function updateMiniMapControlsDisable() {
	controls.miniMapPlacement.disabled = !controls.miniMap.checked;
}

// Start the ball
start( doc );

})( document );
