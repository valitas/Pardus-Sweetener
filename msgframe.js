// Message frame driver. Require clock.

'use strict';

(function( doc, PSClock ) {

// These configuration keys we're interested in. It's convenient to
// keep clocks separate from notifications..
//
// Keep clock options in sync with timers available for the clock.

var
CLOCK_CONFIG_KEYS = [
	'clockUTC', 'clockAP', 'clockB', 'clockP', 'clockS',
	'clockL', 'clockE', 'clockN', 'clockZ', 'clockR'
],
INDICATOR_CONFIG_KEYS = [
	'alarmCombat', 'alarmAlly', 'alarmWarning', 'alarmPM',
	'alarmMission', 'alarmTrade', 'alarmPayment',
	'desktopCombat', 'desktopAlly', 'desktopWarning', 'desktopPM',
	'desktopMission', 'desktopTrade','desktopPayment'
];

// The images that appear in the message frame, and the suffix of the
// related indicator config keys.

var INDICATORS = {
	'icon_amsg.png':    'Ally',
	'icon_combat.png':  'Combat',
	'icon_mission.png': 'Mission',
	'icon_msg.png':     'PM',
	'icon_pay.png':     'Payment',
	'icon_trade.png':   'Trade',
	'gnome-error.png':  'Warning',
	'gnome-info.png':   'Info'
};


var characterName, clockConfig, clock,
	indicatorConfig, indicators, indicatorsFound, alarmPort;

function start() {
	var imgs, keys;

	// Request configuration
	keys = CLOCK_CONFIG_KEYS.concat( INDICATOR_CONFIG_KEYS );
	chrome.storage.local.get( keys, onConfigurationReady );

	// And while it arrives, scan the page to see which indicators we
	// find. These won't change dynamically, they'll always stay the
	// same; if Pardus wants to display a message, it'll clobber the
	// whole document and send a new one.
	//
	// Yeah, feels strangely static after our shenanigans.

	indicators = {};
	indicatorsFound = false;
	imgs = doc.getElementsByTagName( 'img' );
	for ( var i = 0, end = imgs.length; i < end; i++ ) {
		var m = /\/([^/]+)$/.exec( imgs[i].src );
		if ( m ) {
			var suffix = INDICATORS[ m[1] ];
			if ( suffix ) {
				indicators[ suffix ] = indicatorsFound = true;
			}
		}
	}

	// And get the character name while we're at it.

	var u = doc.getElementById( 'universe' );
	if ( u ) {
		var m = /:\s+(.*)$/.exec( u.alt );
		if ( m ) {
			characterName = m[ 1 ];
		}
	}
}

function onConfigurationReady( items ) {
	var i, end, key, value;

	// Initialise the clock instance
	clock = new PSClock( doc );

	// Store the initial configurations
	clockConfig = {};
	for ( i = 0, end = CLOCK_CONFIG_KEYS.length; i < end; i++ ) {
		key = CLOCK_CONFIG_KEYS[ i ];
		value = items[ key ];
		clockConfig[ key ] = value;
		setClockConfigurationEntry( key, value );
	}
	indicatorConfig = {};
	for ( i = 0, end = INDICATOR_CONFIG_KEYS.length; i < end; i++ ) {
		key = INDICATOR_CONFIG_KEYS[ i ];
		indicatorConfig[ key ] = items[ key ];
	}

	// Act on configuration changes
	chrome.storage.onChanged.addListener( onConfigurationChange );

	// And do our thing.
	notify();
	clock.start();

	// This changes the z-index of the clock so the notification
	// icons, if any, cover the clock if they overlap. Because we
	// think notifications are more important than clocks.
	clock.sink( indicatorsFound );
}

function onConfigurationChange( changes, area ) {
	if ( area == 'local' ) {
		var indicatorConfigChanged = false;

		for ( var key in changes ) {
			if ( indicatorConfig.hasOwnProperty( key )) {
				indicatorConfig[ key ] = changes[ key ].newValue;
				indicatorConfigChanged = true;
			}
			else {
				setClockConfigurationEntry( key, changes[key].newValue );
			}
		}

		if ( indicatorConfigChanged ) {
			notify();
		}
	}
}

function setClockConfigurationEntry( key, value ) {
	if ( clockConfig.hasOwnProperty( key ) ) {
		clockConfig[ key ] = value;

		// Clocks are named AP, P, S, etc. Keys are clockAP, clockP,
		// clockS, etc.
		clock.setEnabled( key.substr(5), value );
	}
}

// Sounding the alarm is a little less straightforward than just
// sending a message to the extension, because we need to keep a
// connection open to it for as long as we want the alarm ringing.
// This function takes care of this.

function setAlarm( state ) {
	if ( state ) {
		// Bring the noise
		if ( !alarmPort ) {
			alarmPort = chrome.runtime.connect();
			alarmPort.postMessage({ alarm: true });
		}
		// else it's already on. Never mind then.
	}
	else {
		if ( alarmPort ) {
			// Just disconnect, the extension will shut the alarm.
			alarmPort.disconnect();
			alarmPort = undefined;
		}
		// else it isn't on, nop.
	}
}

function notify() {
	var message = {};

	setAlarm( testIndicators('alarm') );

	if ( testIndicators('desktop') ) {
		message.desktopNotification = indicatorsToHuman();
		chrome.runtime.sendMessage( message, function(){} );
		// Read about this below.
		delete top.psShouldNotHaveToClearDesktopNotifications;
	}
	else {
		// There are no notifications to be shown. We could simply
		// tell the extension to hide the notification, but that means
		// we would be waking up the event page every 30 seconds, most
		// times for doing absolutely nothing.
		//
		// So this is what we do: we make a note in the top window
		// that the last time we ran we displayed no desktop
		// notification.  We check for that note now.  Only if the
		// note *doesn't* exist, we tell the extension to clear the
		// notification.
		if ( !top.psShouldNotHaveToClearDesktopNotifications ) {
			// Double negatives ftw.
			message.desktopNotification = null;
			chrome.runtime.sendMessage( message, function(){} );
		}

		// And we set the note.
		top.psShouldNotHaveToClearDesktopNotifications = true;
	}

}

function testIndicators( prefix ) {
	for ( var suffix in indicators ) {
		if ( indicatorConfig[ prefix + suffix ] ) {
			return true;
		}
	}

	return false;
}

function indicatorsToHuman() {
	var a = [], pendings, warn, notifs, stuff;

	if ( indicators['Warning'] ) {
		warn = 'There is a game warning you should see in the message frame.';
	}
	else if ( indicators[ 'Info' ] ) {
		warn = 'There is some information for you in the message frame.';
	}

	if ( indicators['Ally'] ) {
		a.push( 'alliance' );
	}
	if ( indicators['PM'] ) {
		a.push('private');
	}
	if ( a.length > 0 ) {
		pendings = 'unread ' + a.join(' and ') + ' messages';
		a.length = 0;
	}

	if ( indicators['Trade'] || indicators['Payment'] ) {
		a.push( 'money' );
	}
	if ( indicators['Mission'] ) {
		a.push( 'mission' );
	}
	if ( a.length > 0 ) {
		notifs = a.join(' and ') + ' notifications';
		a.length = 0;
	}

	if ( pendings ) {
		a.push( pendings );
	}
	if ( notifs ) {
		a.push( notifs );
	}
	if ( a.length > 0 ) {
		stuff = a.join(', and ') + '.';
		a.length = 0;
	}

	if ( warn ) {
		a.push( warn );
	}

	if ( indicators['Combat'] || stuff ) {
		if ( characterName ) {
			a.push(
				( warn ? 'And your' : 'Your' ) +
				' character ' + characterName );
		}
		else {
			a.push( ( warn ? 'And a' : 'A' ) + ' character of yours' );
		}

		if ( indicators['Combat'] ) {
			a.push( 'has been fighting with someone.' );
			if ( stuff ) {
				if ( characterName ) {
					a.push( character_name + ' also has' );
				}
				else {
					a.push( 'You also have' );
				}
				a.push( stuff );
			}
		}
		else {
			a.push( 'has' );
			a.push( stuff );
		}
	}

	return a.join( ' ' );
}

// Start the ball.
start();

})( document, PSClock );
