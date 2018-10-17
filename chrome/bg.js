// This is the extension proper, the event page.  We've taken most
// functionality out from it. What remains is code to sound the alarm,
// display notifications, and obtain sector maps from JSON files
// installed with the extension.

'use strict';

(function( window ) {

// These hold our state
var config, connections, audio, currentSoundId, notificationTimer;

function start() {
	// We set an initial value for config here because, in this
	// particular page, we have no guarantee that onConfigurationReady
	// will be called with a full config.  The very first time the
	// extension runs, it'll be called with an empty 'items', then
	// onInstall will complete and trigger onConfigurationChange.
	// These defaults will then be overwritten with sensible values
	// anyway, but we need config to have the properties by the time
	// onConfigurationChange is called, because of the logic in
	// that function.
	config = { muteAlarm: null, alarmSound: null };

	connections = [];
	chrome.storage.onChanged.addListener( onConfigurationChange );
	chrome.runtime.onInstalled.addListener( onInstalled );
	chrome.runtime.onMessage.addListener( onMessage );
	chrome.runtime.onConnect.addListener( onConnect );
	chrome.storage.local.get( [ 'muteAlarm', 'alarmSound' ],
							  onConfigurationReady );
}

function onConfigurationReady( items ) {
	var key;

	for ( key in items ) {
		config[ key ] = items [ key ];
	}

	updateAlarmState();
}

function onConfigurationChange( changes, area ) {
	var updated, key;

	if ( area != 'local' ) {
		return;
	}

	updated = false;

	for ( key in changes ) {
		if ( config.hasOwnProperty( key ) ) {
			config[ key ] = changes[ key ].newValue;
			updated = true;
		}
	}

	if ( updated ) {
		updateAlarmState();
	}
	else {
		// We do check for a couple things here.
		var items = {}, change, save;

		change = changes[ 'allianceQLsArtemisEnabled' ];
		if ( change && !change.newValue ) {
			items.allianceQLsArtemis = [];
			items.allianceQLsArtemisMTime = 0;
			save = true;
		}

		change = changes[ 'allianceQLsOrionEnabled' ];
		if ( change && !change.newValue ) {
			items.allianceQLsOrion = [];
			items.allianceQLsOrionMTime = 0;
			save = true;
		}

		change = changes[ 'allianceQLsArtemisEnabled' ];
		if ( change && !change.newValue ) {
			items.allianceQLsPegasus = [];
			items.allianceQLsPegasusMTime = 0;
			save = true;
		}

		if ( save ) {
			chrome.storage.local.set( items );
		}
	}
}

function onMessage( request, sender, sendResponse ) {
	var asyncResponse = false;

	if ( sender.tab ) {
		// Show the page action for all tabs sending us messages. This
		// is slightly iffy but hey, it works.
		showPageAction( sender.tab.id );
	}

	if ( request.hasOwnProperty( 'requestMap' ) ) {
		asyncResponse = requestMap( request.requestMap, sendResponse );
	}
	else if ( request.hasOwnProperty( 'desktopNotification' )) {
		if ( request.desktopNotification ) {
			showDesktopNotification(
				request.title || 'Meanwhile, in Pardus...',
				request.desktopNotification, request.timeout );
			sendResponse( true );
		}
		else {
			clearDesktopNotification();
			sendResponse( false );
		}
	}

	return asyncResponse;
}

function showPageAction( tabId ) {
	var icon = ( config && config.muteAlarm ) ?
		'icons/19mute.png' : 'icons/19.png';
	chrome.pageAction.setIcon({ path: icon, tabId: tabId });
	chrome.pageAction.show( tabId );
}

function requestMap( sectorName, callback ) {
	var rq = new XMLHttpRequest(),
		url = chrome.runtime.getURL( 'map/' + sectorName[0] + '/' +
			sectorName.replace( ' ', '_' ) + '.json'),
		listener = function() {
			onMapReadyStateChange( rq, callback );
		};

	rq.onreadystatechange = listener;
	rq.open( 'get', url );
	rq.send();

	return true;
}

function onMapReadyStateChange( rq, callback ) {
	if ( rq.readyState != 4 ) {
		return;
	}

	if ( rq.status == 200 ) {
		callback( JSON.parse( rq.responseText ) );
	}
	else {
		callback({ error: 'No map' });
	}
}

// Alarm stuff.

// We use long-lived ports for control of the alarm.  This is because
// the alarm is an Audio object created by us, the event page, and so
// we don't want to be unloaded by Chrome while the alarm is ringing,
// because that would stop the sound.  However, we also don't want to
// lock the event page in memory whenever a tab is navigating Pardus
// (which was our behaviour on previous versions), and, even more
// importantly, we don't want our racket to go on if the last of the
// tabs that told us to sound the alarm goes away, without telling us
// to shut it.
//
// Ports give us the behaviour we want.  When a tab or the page action
// wants us to sound the alarm, we have it connect to us, and we have
// it keep the connection for as long as it wants the alarm ringing.
// While the port is connected, we can't be unloaded by Chrome.  When
// the last of the tabs holding us for alarm functionality goes away,
// so does its port, and we get notified and act accordingly.
function onConnect ( port ) {
	var connection = { port: port },
		messageListener = function( message ) {
			onPortMessage( connection, message );
		},
		disconnectListener = function() {
			onPortDisconnect( connection );
		};

	connections.push( connection );
	port.onMessage.addListener( messageListener );
	port.onDisconnect.addListener( disconnectListener );
}

function onPortMessage( connection, message ) {
	for ( var key in message ) {
		switch ( key ) {
		case 'alarm':
			connection.alarm = message.alarm;
			updateAlarmState();
			break;
		case 'watchAlarm':
			// assignment, not comparison:
			if (( connection.watchAlarm = message.watchAlarm )) {
				// and give it an immediate update
				var state =
					( audio && audio.readyState == 4 && !audio.paused ) ?
					true : false;
				connection.port.postMessage({ alarmState: state });
			}
		}
	}
}

function onPortDisconnect( connection ) {
	var index = connections.indexOf( connection );
	if ( index != -1 ) {
		connections.splice( index, 1 );
	}
	updateAlarmState();
}

// This function turns the alarm on and off as needed.
function updateAlarmState() {
	if ( alarmWanted() ) {
		// Bring the noise
		if ( audio ) {
			if ( currentSoundId == config.alarmSound ) {
				if ( audio.readyState == 4 ) {
					if ( audio.paused ) {
						audio.play();
						postAlarmState( true );
					}
					// else do nothing, we were already playing
				}
				// else do nothing, the canplay listener will call us again.
			}
			else {
				// We need to change the sound id
				setAlarmSound();
			}
		}
		else {
			// No audio yet, create it
			audio = new Audio();
			audio.loop = true;
			audio.addEventListener( 'canplaythrough', onAudioCanPlayThrough );
			setAlarmSound();
			// and return now. the canplay listener will call us again.
		}
	}
	else {
		// Shut it
		if ( audio && audio.readyState == 4 && !audio.paused ) {
			audio.pause();
			audio.currentTime = 0;
			postAlarmState( false );
		}
		// otherwise do nothing, the alarm isn't playing
	}
}

function onAudioCanPlayThrough() {
	updateAlarmState();
}

// Figure out whether the alarm should be playing now.
function alarmWanted() {
	if ( !config.muteAlarm ) {
		for ( var i = 0, end = connections.length; i < end; i++ )
			if ( connections[ i ].alarm )
				return true;
	}
	return false;
}

// This is always called when audio already exists, we make sure of that.
function setAlarmSound() {
	var soundId = config.alarmSound;

	audio.src = 'sounds/' + soundId + '.ogg';
	currentSoundId = soundId;
}

function postAlarmState( state ) {
	var message = { alarmState: state };
	for ( var i = 0, end = connections.length; i < end; i++ ) {
		var connection = connections[ i ];
		if ( connection.watchAlarm ) {
			connection.port.postMessage( message );
		}
	}
}

function showDesktopNotification( title, text, timeout ) {
	var options = {
		type: 'basic',
		title: title,
		message: text,
		iconUrl: 'icons/48.png'
	};

	if ( notificationTimer ) {
		window.clearTimeout( notificationTimer );
		notificationTimer = undefined;
	}

	if ( timeout > 0 && timeout < 20000 ) {
		notificationTimer = window.setTimeout( onNotificationExpired, timeout );
	}

	chrome.notifications.clear( 'pardus-sweetener', function(){} );
	chrome.notifications.create( 'pardus-sweetener', options, function(){} );
}

function clearDesktopNotification() {
	if ( notificationTimer ) {
		window.clearTimeout( notificationTimer );
		notificationTimer = undefined;
	}

	chrome.notifications.clear( 'pardus-sweetener', function(){} );
}

function onNotificationExpired() {
	notificationTimer = undefined;
	chrome.notifications.clear( 'pardus-sweetener', function(){} );
}

// There should be a way to get this out of the way. It's only needed
// when installing/upgrading, yet it's always here making this script
// fat.

function onInstalled( details ) {
	var cfg;

	switch ( details.reason ) {
	case 'install':
		// default values of all our parameters
		cfg = {
			alarmAlly: false,
			alarmCombat: true,
			alarmInfo: false,
			alarmMission: false,
			alarmPM: false,
			alarmPayment: false,
			alarmSound: 'timex',
			alarmTrade: false,
			alarmWarning: false,
			allianceQLsArtemis: [],
			allianceQLsArtemisEnabled: true,
			allianceQLsArtemisMTime: 0,
			allianceQLsOrion: [],
			allianceQLsOrionEnabled: true,
			allianceQLsOrionMTime: 0,
			allianceQLsPegasus: [],
			allianceQLsPegasusEnabled: true,
			allianceQLsPegasusMTime: 0,
			artemisOnlineList: '',
			artemisOnlineListEnabled: false,
			autobots: false,
			autobotsArtemisPoints: 0,
			autobotsArtemisPreset: 0,
			autobotsArtemisStrength: 36,
			autobotsOrionPoints: 0,
			autobotsOrionPreset: 0,
			autobotsOrionStrength: 36,
			autobotsPegasusPoints: 0,
			autobotsPegasusPreset: 0,
			autobotsPegasusStrength: 36,
			clockAP: true,
			clockB: true,
			clockE: false,
			clockL: false,
			clockN: false,
			clockP: true,
			clockR: false,
			clockS: true,
			clockUTC: false,
			clockZ: false,
			clockD: true,
			clockStim: true,
			desktopAlly: true,
			desktopCombat: true,
			desktopInfo: false,
			desktopMission: false,
			desktopPM: true,
			desktopPayment: false,
			desktopTrade: false,
			desktopWarning: false,
			displayDamage: true,
			fitAmbushRounds: true,
			miniMap: true,
			miniMapPlacement: 'topright',
			muteAlarm: false,
			navBlackMarketLink: true,
			navBountyBoardLink: false,
			navBulletinBoardLink: true,
			navCrewQuartersLink: false,
			navEquipmentLink: true,
			navFlyCloseLink: true,
			navHackLink: true,
			navShipLinks: true,
			navShipyardLink: false,
			navTradeLink: true,
			orionOnlineList: '',
			orionOnlineListEnabled: false,
			overrideAmbushRounds: false,
			pathfindingEnabled: true,
			pegasusOnlineList: '',
			pegasusOnlineListEnabled: false,
			personalQLArtemis: '',
			personalQLArtemisEnabled: false,
			personalQLOrion: '',
			personalQLOrionEnabled: false,
			personalQLPegasus: '',
			personalQLPegasusEnabled: false,
			pvbMissileAutoAll: true,
			pvmHighestRounds: false,
			pvmMissileAutoAll: false,
			pvpHighestRounds: true,
			pvpMissileAutoAll: true,
			sendmsgShowAlliance: true
		};

		chrome.storage.local.clear();
		chrome.storage.local.set( cfg, function(){} );
		break;

	case 'update':
		// localeCompare, aye.  Kinda flaky, this, but we've only
		// released public versions 2.2, 2.3, and 2.4. Should be
		// fine.
		if ( details.previousVersion.localeCompare('2.5') >= 0 )
			return;

		// Here we migrate the previous Sweetener configurations, held
		// on the event page's localStorage, to chrome.storage.

		cfg = new Object();

		// These were strings with the given defaults
		cfg[ 'alarmSound' ] = localStorage[ 'alarmSound' ] || 'timex';
		cfg[ 'personalQLArtemis' ] = localStorage[ 'personalQLArtemis' ] || '';
		cfg[ 'personalQLOrion' ] = localStorage[ 'personalQLOrion' ] || '';
		cfg[ 'personalQLPegasus' ] = localStorage[ 'personalQLPegasus' ] || '';
		cfg[ 'miniMapPlacement' ] =
			localStorage[ 'miniMapPosition' ] || 'topright';

		// All these were booleans with default to false
		var i, end, key, val, keys = [
			'muteAlarm', 'alarmAlly', 'alarmWarning',
			'alarmPM', 'alarmMission', 'alarmTrade', 'alarmPayment',
			'alarmInfo', 'desktopWarning', 'desktopMission',
			'desktopTrade', 'desktopPayment', 'desktopInfo',
			'clockUTC', 'clockL', 'clockE', 'clockN', 'clockZ', 'clockR',
			'clockD', 'ClockStim', 'pvmMissileAutoAll', 'pvmHighestRounds',
			'autobots', 'personalQLArtemisEnabled', 'personalQLOrionEnabled',
			'personalQLPegasusEnabled'
		];
		for ( i = 0, end = keys.length; i < end; i++ ) {
			key = keys[ i ];
			cfg[ key ] = ( localStorage[key] == 'true' );
		}

		// These were booleans with default to true
		keys = [
			'alarmCombat', 'desktopCombat', 'desktopAlly', 'desktopPM',
			'clockAP', 'clockB', 'clockP', 'clockS',
			'pvpMissileAutoAll', 'pvpHighestRounds', 'pvbMissileAutoAll',
			'displayDamage', 'navEquipmentLink', 'navHackLink', 'navShipLinks',
			'allianceQLsArtemisEnabled', 'allianceQLsOrionEnabled',
			'allianceQLsPegasusEnabled', 'miniMap', 'sendmsgShowAlliance'
		];
		for ( i = 0, end = keys.length; i < end; i++ ) {
			key = keys[ i ];
			cfg[ key ] = ( localStorage[key] != 'false' );
		}

		// These three are now just one.  They all defaulted to true.
		// If all three were disabled, we disable the new option.
		cfg[ 'navTradeLink' ] =
			!( localStorage[ 'navPlanetTradeLink' ] == 'false' &&
			   localStorage[ 'navSBTradeLink' ] == 'false' &&
			   localStorage[ 'navBldgTradeLink' ] == 'false' );

		// These two were renamed.  They defaulted to true.
		cfg[ 'navBlackMarketLink' ] = localStorage[ 'navBMLink' ] != 'false';
		cfg[ 'navBulletinBoardLink' ] = localStorage[ 'navBBLink' ] != 'false';

		// These defaulted to '0' and are now integers
		keys = [ 'autobotsArtemisPreset', 'autobotsArtemisPoints',
				 'autobotsOrionPreset', 'autobotsOrionPoints',
				 'autobotsPegasusPreset', 'autobotsPegasusPoints',
				 'allianceQLsArtemisMTime', 'allianceQLsOrionMTime',
				 'allianceQLsPegasusMTime' ];
		for ( i = 0, end = keys.length; i < end; i++ ) {
			key = keys[ i ];
			val = parseInt( localStorage[key] );
			cfg[ key ] = isNaN( val ) ? 0 : val;
		}

		// These defaulted to '36' and are now integers
		val = parseInt( localStorage[ 'autobotsPegasusStrength' ] );
		cfg[ 'autobotsPegasusStrength' ] = isNaN( val ) ? 36 : val;
		val = parseInt( localStorage[ 'autobotsArtemisStrength' ] );
		cfg[ 'autobotsArtemisStrength' ] = isNaN( val ) ? 36 : val;
		val = parseInt( localStorage[ 'autobotsOrionStrength' ] );
		cfg[ 'autobotsOrionStrength' ] = isNaN( val ) ? 36 : val;

		// These were JSON stringified arrays, and we haven't changed
		// the array contents, so we'll just copy as is if they were set.
		keys = [ 'allianceQLsArtemis', 'allianceQLsOrion',
				 'allianceQLsPegasus' ];
		for ( i = 0, end = keys.length; i < end; i++ ) {
			key = keys[ i ];
			try { val = JSON.parse( localStorage[key] ); }
			catch ( x ) { val = null; }
			cfg[ key ] = Array.isArray( val ) ? val : [];
		}

		// We don't migrate previousShipStatus.  It is no longer stored
		// in config.

		// And these are new
		cfg.navShipyardLink     = false;
		cfg.navCrewQuartersLink = false;
		cfg.navFlyCloseLink     = true;

		// Well, overrideAmbushRounds did exist. However, it was a bit
		// hamfisted, and now we have fitAmbushRounds, which is
		// better.  People who had oAR enabled, probably will be
		// better served by fAR; people who had it disabled... well it
		// probably was because of the hamfist thing, and fAR isn't
		// likely to bother them.  So we don't migrate and set the
		// defaults here instead.
		cfg.fitAmbushRounds = true;
		cfg.overrideAmbushRounds = false;

		chrome.storage.local.clear();
		chrome.storage.local.set( cfg, onUpgradeComplete );
	} // switch
}

function onUpgradeComplete() {
	localStorage.clear();
}

// Start the ball
start();

})( window );
