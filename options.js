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
	keys = [ 'testAlarm', 'testNotification', 'version', 'aresetDrugAndStim', 'oresetDrugAndStim', 'presetDrugAndStim' ];

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
		'navShipLinks', 'navWeaponLink',
		'navBlackMarketLink', 'navHackLink', 'navBulletinBoardLink',
		'navBountyBoardLink', 'navShipyardLink', 'navCrewQuartersLink',
		'navFlyCloseLink', 'allianceQLsArtemisEnabled',
		'personalQLArtemisEnabled', 'allianceQLsOrionEnabled',
		'personalQLOrionEnabled', 'allianceQLsPegasusEnabled',
		'personalQLPegasusEnabled', 'overrideAmbushRounds',
		'fitAmbushRounds', 'miniMap', 'miniMapNavigation', 'sendmsgShowAlliance',
		'artemisOnlineListEnabled', 'orionOnlineListEnabled',
		'pegasusOnlineListEnabled', 'pathfindingEnabled','displayNavigationEnabled',
		'missionDisplay', 'navigationCoordinates', 'displayVisited'
	);

	// 2. Free-form strings
	setupControls (
		'input', onControlInput,
		'personalQLArtemis', 'personalQLOrion', 'personalQLPegasus',
		'artemisOnlineList', 'orionOnlineList', 'pegasusOnlineList' );

	// 3. Numeric fields
	setupControls ( 'input', onNumericControlInput,
		'autobotsArtemisPoints', 'autobotsOrionPoints',
		'autobotsPegasusPoints', 'displayVisitedDecay');

	// 4. Selects
	setupControls ( 'change', onControlInput,
		'alarmSound', 'autobotsArtemisPreset', 'autobotsOrionPreset',
		'autobotsPegasusPreset', 'miniMapPlacement', 'adoctor', 'odoctor', 'pdoctor' ); 

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
	controls.miniMapNavigation
		.addEventListener( 'click', updateMiniMapNavigationDisable );
	extraControls
		.aresetDrugAndStim.addEventListener( 'click', onResetDrugAndStimClick );
	extraControls
		.oresetDrugAndStim.addEventListener( 'click', onResetDrugAndStimClick );
	extraControls
		.presetDrugAndStim.addEventListener( 'click', onResetDrugAndStimClick );

		//pretty sure these doctor listeners won't do anything, remove.
	controls.adoctor.addEventListener('change', doctorListener);
	controls.odoctor.addEventListener('change', doctorListener);
	controls.pdoctor.addEventListener('change', doctorListener);

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
    wireQLControls( controls.displayVisited,
            controls.displayVisitedDecay );

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

//resets the drug and stim timers to 0 for the universe.
function onResetDrugAndStimClick(inputElement) {
	var u = inputElement.target.alt;
	var data = new Object();
	data[ u + 'stimTimerLast' ] = 0;
	data[ u + 'stimTimerClear' ] = 0;
	data[ u + 'drugTimerLast' ] = 0;
	data[ u + 'drugTimerClear' ] = 0;
	data[ u + 'extraStim' ] = 0;
	data[ u + 'extraDrug' ] = 0;
	chrome.storage.sync.set ( data );
}

//sets the doctor legendary for the universe
function  doctorListener (inputElement) {
	var data = new Object();
	var target = inputElement.target
	data[target.id] =target.value
	chrome.storage.sync.set(data);
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
		case 'miniMapNavigation':
			updateMiniMapNavigationDisable();
            break;
        case 'displayVisited':
            updateVisitedDisable()
            break;
		}
		break;
	case 'select-one':
		updateSelectState( control, value );
		break;
	case 'text':
	case 'textarea':
    case 'number':
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

function updateMiniMapNavigationDisable() { //when disable checkbox is checked/unchecked
	var disabled = !controls.miniMapNavigation.checked;
	
	doc.querySelectorAll("#miniMapNavigationCosts input,#miniMapNavigationCosts select").forEach(function (e) {
		e.disabled = disabled;
		if (e.getAttribute("moveSpeed") && parseInt(e.value) != e.value) e.value = e.getAttribute("moveSpeed") - 1;
	});
}
function onMiniMapNavigationPresetChange(uni) { //when dropdown is selected
	var driveSpeed = doc.getElementById("miniMapNavigationPreset" + uni).value;
	if (driveSpeed == 1000) return; //Custom setting
	
	doc.querySelectorAll('#miniMapNavigationCosts input[universe="'+uni+'"]').forEach(function (e) {
		e.value = e.getAttribute("moveSpeed") - driveSpeed;
		onControlInput({target: e});
	});
	onControlInput({target: controls["miniMapNavigationPreset" + uni]});
}
function onMiniMapNavigationPointsChange(uni) { //when numbers are changed
	//try to auto detect if it was changed back to a default set of numbers
	var driveSpeed = moveSpeeds[0] - doc.getElementById("travelCost" + uni + fields[0]).value;
	
	if (moveSpeeds.indexOf(driveSpeed) == -1) driveSpeed = 1000;
	else {
		doc.querySelectorAll('#miniMapNavigationCosts input[universe="'+uni+'"]').forEach(function (e) {
			if (e.value != e.getAttribute("moveSpeed") - driveSpeed) driveSpeed = 1000;
			onControlInput({target: e});
		});
	}
	
	controls["miniMapNavigationPreset" + uni].value = driveSpeed;
	onControlInput({target: controls["miniMapNavigationPreset" + uni]});
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

function updateVisitedDisable() {
	controls.displayVisitedDecay.disabled = !controls.displayVisited.checked;
}

// Start the ball
start( doc );

})( document );
