'use strict';

// Let Emacs know of these.
var chrome, PSClock;

(function( document ) {

  var CLOCK_CONFIG_KEYS =
      [ 'clockUTC', 'clockAP', 'clockB', 'clockP', 'clockS',
	'clockL', 'clockE', 'clockN', 'clockZ', 'clockR', 'clockD', 'clockStim' ],
      INDICATOR_CONFIG_KEYS =
      [ 'alarmCombat', 'alarmAlly', 'alarmWarning', 'alarmPM',
        'alarmMission', 'alarmTrade', 'alarmPayment',
        'desktopCombat', 'desktopAlly', 'desktopWarning', 'desktopPM',
        'desktopMission', 'desktopTrade','desktopPayment' ],
      INDICATORS =
      { 'icon_amsg.png':    'Ally',
        'icon_combat.png':  'Combat',
        'icon_mission.png': 'Mission',
        'icon_msg.png':     'PM',
        'icon_pay.png':     'Payment',
        'icon_trade.png':   'Trade',
        'gnome-error.png':  'Warning',
        'gnome-info.png':   'Info' };

  var configured = false,
      msgframeLoaded = false,
      lastRefresh = 0,
      alarmPort = null,
      desktopNotificationShown = false,
      msgframe,
      msgframeURL,
      clock,
      clockConfig,
      indicatorConfig,
      indicators,
      indicatorsFound,
      characterName;

  go();

  // End of execution, content script returns here.  Below are function
  // definitions.

  function go() {
    var keys;
    msgframe = document.getElementById( 'msgframe' );
    if( msgframe ) {
      // Request configuration.
      keys = CLOCK_CONFIG_KEYS.concat( INDICATOR_CONFIG_KEYS );
      chrome.storage.local.get( keys, onConfigurationReady );

      // Schedule this check to run twice a minute.
      document.defaultView.setInterval( onMsgFrameCheck, 30000 );

      // Listen for the msgframe loading.
      //
      // This should be DOMContentLoaded or DOMFrameContentLoaded even, but
      // those things don't work in Chrome.  Is there a way to get a
      // DOMContentLoaded event from a frame, without resorting to injecting
      // script there, or using the webNavigation thing?
      //
      // https://bugs.webkit.org/show_bug.cgi?id=33604
      msgframe.addEventListener( 'load', onMsgFrameLoad, false );

      // And trigger an immediate call if we missed the load event altogether.
      try {
        if ( msgframe.contentDocument.location.pathname == '/msgframe.php' &&
             msgframe.contentDocument.readyState == 'complete' )
          msgframeLoaded = true;
      }
      catch( e ) {}
    }
  }

  function onConfigurationReady( items ) {
    var i, end, key;

    configured = true;

    // Store the initial configurations
    clockConfig = {};
    for ( i = 0, end = CLOCK_CONFIG_KEYS.length; i < end; i++ ) {
      key = CLOCK_CONFIG_KEYS[ i ];
      clockConfig[ key ] = items[ key ];
    }
    indicatorConfig = {};
    for ( i = 0, end = INDICATOR_CONFIG_KEYS.length; i < end; i++ ) {
      key = INDICATOR_CONFIG_KEYS[ i ];
      indicatorConfig[ key ] = items[ key ];
    }

    // Act on configuration changes
    chrome.storage.onChanged.addListener( onConfigurationChange );

    // If the msgframe loaded before we were ready, sort it out.
    if ( msgframeLoaded )
      onMsgFrameLoad( null );
  }

  function onMsgFrameLoad( event ) {
    var doc, i, end, key;

    msgframeLoaded = true;

    // This shouldn't happen, configuration should occur before the frame
    // loads. Still.  If it does happen, we'll be called again by
    // onConfigurationReady.
    if ( !configured )
      return;

    try {
      doc = msgframe.contentDocument;
      lastRefresh = Date.now();
    }
    catch( e ) {
      // This is a security error: when the msg frame fails to load, we can't
      // access contentDocument because that would be "cross-domain".  That's
      // fine.  We didn't update lastRefresh, that's all we need.
    }

    if ( doc ) {
      msgframeURL = doc.location.toString();
      scanMsgFrame( doc );
	  // Initialise the clock instance
	  clock = new PSClock( doc );
      for ( i = 0, end = CLOCK_CONFIG_KEYS.length; i < end; i++ ) {
	    key = CLOCK_CONFIG_KEYS[ i ];
	    setClockConfigurationEntry( key, clockConfig[ key ] );
      }
	  clock.start();
	  // This changes the z-index of the clock so the notification icons, if
	  // any, cover the clock if they overlap. Because we think notifications
	  // are more important than clocks.
	  clock.sink( indicatorsFound );
    }
    else {
      // We lose the reference to the clock. It would be nice to cancel the
      // interval that refreshes it, but by now the window that held the
      // interval is probably dead (hopefully).
      clock = null;
	  indicators = {};
	  indicatorsFound = false;
    }

    notify();
  }

  // If the msgframe hasn't loaded successfully in the last 60 seconds, trigger
  // a reload.
  function onMsgFrameCheck() {
    var now = Date.now();
    if ( now - lastRefresh > 60000 && msgframeURL ) {
      try {
        msgframe.contentWindow.location.replace( msgframeURL );
      }
      catch( e ) {}
    }
  }

  function setClockConfigurationEntry( key, value ) {
    if ( clockConfig.hasOwnProperty( key ) ) {
      clockConfig[ key ] = value;

      // Clocks are named AP, P, S, etc. Keys are clockAP, clockP, clockS, etc.
      clock.setEnabled( key.substr(5), value );
    }
  }

  function onConfigurationChange( changes, area ) {
    if ( area == 'local' ) {
      var indicatorConfigChanged = false;

      for ( var key in changes ) {
        if ( indicatorConfig.hasOwnProperty( key )) {
          indicatorConfig[ key ] = changes[ key ].newValue;
          indicatorConfigChanged = true;
        }
        else
          setClockConfigurationEntry( key, changes[key].newValue );
      }

	  if ( indicatorConfigChanged )
	    notify();
	}
  }

  function notify() {
	var message = {};

	setAlarm( testIndicators( 'alarm' ) );

	if ( testIndicators( 'desktop' ) ) {
	  message.desktopNotification = indicatorsToHuman();
	  chrome.runtime.sendMessage( message, function(){} );
      desktopNotificationShown = true;
	}
	else {
      // Check if notification shown; if so, hide (don't send a message telling
      // the backend to hide a notification that isn't shown, that'll wake it
      // for nothing.
      //
      // All this is a bit of a mess and should be rewritten, really.
      if ( desktopNotificationShown ) {
		message.desktopNotification = null;
		chrome.runtime.sendMessage( message, function(){} );
	  }

      desktopNotificationShown = false;
	}

  }

  function testIndicators( prefix ) {
	for ( var suffix in indicators ) {
	  if ( indicatorConfig[ prefix + suffix ] )
		return true;
	}

	return false;
  }

  // XXX - this should be on bg
  function indicatorsToHuman() {
	var a = [], pendings, warn, notifs, stuff;

	if ( indicators[ 'Warning' ] )
	  warn = 'There is a game warning you should see in the message frame.';
	else if ( indicators[ 'Info' ] )
	  warn = 'There is some information for you in the message frame.';

	if ( indicators[ 'Ally' ] )
	  a.push( 'alliance' );
	if ( indicators[ 'PM' ] )
	  a.push( 'private' );
	if ( a.length > 0 ) {
	  pendings = 'unread ' + a.join(' and ') + ' messages';
	  a.length = 0;
	}

	if ( indicators[ 'Trade' ] || indicators[ 'Payment' ] )
	  a.push( 'money' );
	if ( indicators[ 'Mission' ] )
	  a.push( 'mission' );
	if ( a.length > 0 ) {
	  notifs = a.join(' and ') + ' notifications';
	  a.length = 0;
	}

	if ( pendings )
	  a.push( pendings );
	if ( notifs )
	  a.push( notifs );
	if ( a.length > 0 ) {
	  stuff = a.join(', and ') + '.';
	  a.length = 0;
	}

	if ( warn )
	  a.push( warn );

	if ( indicators[ 'Combat' ] || stuff ) {
	  if ( characterName )
		a.push( ( warn ? 'And your' : 'Your' ) +
                ' character ' + characterName );
	  else
        // XXX - can this happen?
		a.push( ( warn ? 'And a' : 'A' ) + ' character of yours' );

	  if ( indicators[ 'Combat' ] ) {
		a.push( 'has been fighting with someone.' );
		if ( stuff ) {
		  if ( characterName )
			a.push( characterName + ' also has' );
		  else
            // XXX - can this happen?
			a.push( 'You also have' );
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

  function scanMsgFrame( doc ) {
    var imgs;

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
		var Ukey = u.alt[0];
	}

	if ( indicators[ 'Warning' ] ) {
		if ( doc.getElementsByTagName('font')[0].textContent
		     .indexOf('stun') > 0 ) {
			chrome.storage.local.get(
				Ukey + 'loc', stunned.bind( doc ) );
		}
	}
  }

  function stunned( data ) {
	  let td = this.createElement( 'td' );
	  let btn = this.createElement( 'button' );
	  let e = this.getElementsByTagName( 'font' )[0].parentNode;
	  e.parentNode.insertBefore( td, e.nextElementSibling );
	  td.appendChild( btn );
	  btn.textContent = 'Send AM';
	  btn.addEventListener( 'click', stunnedClick.bind( this, data ) );
  }

  function stunnedClick( data ) {
	  for (var key in data) {
		  // will be only one, but now we don't have to get the
		  // specific universe first`
		  let sectorId = Sector.getIdFromLocation( data[ key ] );
		  let coords = Sector.getCoords( sectorId, data[ key ] );
		  let helpString = 'Help! I\'ve hit a stun TB at ' +
		      Sector.getName( sectorId ) + ' [' + coords[ 'x' ] +
		      ',' + coords[ 'y' ] + ']';
		  let subjString = 'Stunned!'
		  var url = '/messages_alliance.php';
            var params = new FormData();
		  params.append( 'sendto_type', 'all' );
		  params.append( 'textfield', subjString );
		  params.append( 'ally_msg', helpString );
		  params.append( 'Send', 'Send' );
		  let http = new XMLHttpRequest();
		  http.open("POST", url, true);
		  http.send(params);
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
		alarmPort = null;
	  }
	  // else it isn't on, nop.
	}
  }

})( document );
