// The My Alliance page driver.
// Require slicer.js.

'use strict';

(function( doc, TreeSlicer ){

var
	// The names of the config keys we use
	allianceQLsKey, allianceQLsEnabledKey, allianceQLsMTimeKey,
	// The current configuration
	config,
	// The state of the page
	pageScanTimestamp, pageQLs, pageAddedElements, highlightedQL;

function start() {
	var m, universe, universeName, keys;

	m = /^([^.]+)\.pardus\.at$/.exec( doc.location.hostname );
	if ( !m ) {
		// No universe?!
		return;
	}

	universe = m[ 1 ];

	// We use the universe name to build configKeys. We need it
	// capitalised.
	universeName =
		universe.substr( 0, 1 ).toUpperCase() +
		universe.substr( 1 );

	allianceQLsKey = 'allianceQLs' + universeName;
	allianceQLsEnabledKey = allianceQLsKey + 'Enabled';
	allianceQLsMTimeKey = allianceQLsKey + 'MTime';

	// Request our configuration.
	keys = [ allianceQLsKey, allianceQLsEnabledKey, allianceQLsMTimeKey];
	chrome.storage.local.get( keys, onConfigurationReady );
}

function onConfigurationReady( items ) {
	config = items;

	// If enabled, we do our thing here.
	if ( config[ allianceQLsEnabledKey ] ) {
		getPageQLs();
		storePageQLs();
	}

	// Listen for chhanges in configuration.
	chrome.storage.onChanged.addListener( onConfigurationChange );
}

function onConfigurationChange( changes, area ) {
	if ( area != 'local' ) {
		return;
	}

	// Update our copies of the config values.

	for ( var key in changes ) {
		if ( config.hasOwnProperty( key ) ) {
			config[ key ] = changes[ key ].newValue;
		}
	}

	// Now react to the user enabling or disabling alliance QLs in
	// this universe.

	if ( changes.hasOwnProperty( allianceQLsEnabledKey ) ) {
		if ( config[ allianceQLsEnabledKey ] ) {
			if ( pageScanTimestamp ) {
				// It got re-enabled.  Just show all icons again,
				// update if needed.
				for ( var name in pageAddedElements ) {
					pageAddedElements[ name ].icon.style.display = null;
				}
			}
			else {
				// It was disabled when we loaded the page, and now
				// it's on.  Scan the page then.
				getPageQLs();
			}

			// And (re) store the page QLs (unless stale).
			storePageQLs();
		}
		else {
			// Alliance QLs were disabled. Ordinarily, we'll remove
			// all of our changes and leave a pristine document.
			// However, that'd be too much faff for this page - the
			// slicer makes a lot of changes.  So instead we'll just
			// hide them.
			highlightQL( null );
			for ( var name in pageAddedElements ) {
				pageAddedElements[ name ].icon.style.display = 'none';
			}
		}
	}
}

// This scans the document, and irreversibly changes it.  Make sure it
// runs only once.
function getPageQLs() {
	var tabstyleTables, i, end;

	if ( pageScanTimestamp ) {
		throw new Error( 'getQLs running twice' );
	}

	pageScanTimestamp = Math.floor( Date.now() / 1000 );
	pageQLs = [];
	pageAddedElements = {};
	highlightedQL = null;

	// My Alliance has a table with class "tabstyle".  I don't suppose
	// there could be more than one of those, but we don't care, we
	// check them all cause we can and it's easy.

	tabstyleTables = document.getElementsByClassName( 'tabstyle' );
	for ( i = 0, end = tabstyleTables.length; i < end; i++ ) {
		processTabstyleTable( tabstyleTables[ i ], pageQLs );
	}

	fixNames( pageQLs );

	// Get icons and spans out from pageQLs, so we can store pageQLs
	// if we have to.
	for ( i = 0, end = pageQLs.length; i < end; i++ ) {
		var entry = pageQLs[ i ], name = entry.name, spans = entry.spans;

		pageAddedElements[ name ] = {
			icon: entry.icon,
			spans: spans
		};

		delete entry.icon;
		delete entry.spans;

		// Also add a mouseover handler to the spans, for extra feedback
		for ( var j = 0, jend = spans.length; j < jend; j++ ) {
			var span = spans[ j ];
			span.addEventListener( 'mouseover', highlightQL );
			span.title = name;
		}
	}
}

// This runs once the page QLs have been scanned, and again if
// allianceQLsEnabled is disabled and then re-enabled for the
// universe.  It compares the configured value with what's on the
// page.  If it's not the same, updates the configuration.
function storePageQLs() {
	var notification, items, message;

	if ( config[ allianceQLsMTimeKey ] >= pageScanTimestamp ) {
		// Configuration is up-to-date or is even more recent than the
		// time when when we scanned the page.
		return;
	}

	items = {};
	notification = compareQLLists( config[ allianceQLsKey ], pageQLs );

	if ( notification ) {
		message = {
			desktopNotification: notification,
			title: 'Alliance QLs'
		};
		chrome.runtime.sendMessage( message, function(){} );
		items[ allianceQLsKey ] = pageQLs;
	}

	items[ allianceQLsMTimeKey ] = pageScanTimestamp;

	// If QLs were updated, this will trigger onConfigurationChange,
	// which will updated config.
	chrome.storage.local.set( items );
}

function processTabstyleTable( table, qls ) {
	var slicer, match, text, name, qltext, offset,
		spans, child, icon, entry;

	// The infamous QL regexp. This is actually properly documented,
	// but not here, that'd be too much. See
	// https://github.com/valitas/Pardus-Sweetener/wiki/QL-parsing

	var rx = /(?:\{\s*([A-Za-z0-9](?:[-+_/#&()A-Za-z0-9 \t\u00a0]{0,58}[A-Za-z0-9)])?)\s*\}|\[\s*([A-Za-z0-9](?:[-+_/#&()A-Za-z0-9 \t\u00a0]{0,58}[A-Za-z0-9)])?)\s*\]|^\s*?([A-Z](?:[-+_/#&()A-Za-z0-9 \t\u00a0]{0,58}[A-Za-z0-9)])?)(?:\s*:)?)?\s*((?:d|r(?:\d*)?);m?;t?;r?;[efn]{0,3};[feun]{0,4};b?;[f:0-9\s]*;[e:0-9\s]*;[u:0-9\s]*;[n:0-9\s]*;[gl:0-9\s]*;[0-6\s]*;[0-9,\s]*;[0-9,\s]*;[fn\s]*;[feun\s]*;[gl:0-9\s]*;[0-6\s]*;[0-9,\s]*;[0-9,\s]*;[0-9\s]*[0-9](?:\s*;\s*[es])?)/gm;

	slicer = new TreeSlicer( table );
	text = slicer.text;

	while (( match = rx.exec( text ) )) {
		name = match[ 1 ] || match[ 2 ];
		if ( name ) {
			// Delimited ("SG" style), we capitalise here.
			name = name.toUpperCase();
		}
		else {
			// Free form.  If no name was found, we use "QL #n", where
			// n is the ordinal of the QL as it appears on the page.
			// This means there may be, e.g., an "Op QL" and a
			// "QL #2".  This is what we want.
			//name = match[ 3 ] || ( 'QL #' + (qls.length + 1) );
			name = ( 'QL #' + (qls.length + 1) );
		}

		qltext = match[ 4 ];
		offset = match.index + match[ 0 ].length - qltext.length;

		// This modifies the document, and gives us an array of the
		// added spans.
		spans = slicer.slice( offset, offset + qltext.length );

		// Add a tiny sweetener icon to the first span, to make
		// visible where we parsed a QL.
		child = spans[0].firstChild;
		icon = document.createElement( 'img' );
		icon.src = chrome.extension.getURL( 'icons/16.png' );
		icon.alt = name;
		icon.title = name;
		spans[ 0 ].insertBefore( icon, child );
		spans[ 0 ].insertBefore( document.createTextNode( ' ' ), child );

		entry = {
			name: name,
			ql: qltext.replace( /\s+/g, '' ),

			// These two we'll save here temporarily, so we can get
			// back to them after fixNames.  We need to delete both
			// before storing this entry in config, though.
			icon: icon,
			spans: spans
		};

		qls.push( entry );
	}
}

function highlightQL( event ) {
	var target = event ? event.target : null,
		name = target ? target.title : null,
		spans, i, end;

	if ( name == highlightedQL ) {
		return;
	}

	if ( highlightedQL ) {
		spans = pageAddedElements[ highlightedQL ].spans;
		for ( i = 0, end = spans.length; i < end; i++ ) {
			spans[ i ].style.color = null;
		}
	}

	highlightedQL = name;

	if ( config[ allianceQLsEnabledKey ] && highlightedQL ) {
		spans = pageAddedElements[ highlightedQL ].spans;
		for ( i = 0, end = spans.length; i < end; i++ ) {
			spans[ i ].style.color = '#3984c6';
		}
	}
}

// We don't want QLs with duplicate names.  If there are any duplicate
// names, change them to "name #1", "name #2", etc.  Where a "name #n"
// already existed, use the next n available.
//
// This renaming may cause unexpected results if the alliance page
// itself was using the "#n" suffix, and using it inconsistently.  But
// that's pathological, so we'll press forward. We will be consistent,
// and we won't have duplicates, even in that case.

function fixNames( qls ) {
	var inUse = {}, counters = {}, i, end, ql, name, n, newName;

	for ( i = 0, end = qls.length; i < end; i++ ) {
		ql = qls[ i ];
		name = ql.name;

		if ( inUse[ name ] ) {
			inUse[ name ] += 1;
		}
		else {
			inUse[ name ] = 1;
		}
	}

	for ( i = 0, end = qls.length; i < end; i++ ) {
		ql = qls[ i ];
		name = ql.name;
		if ( inUse[ name ] > 1 ) {
			n = counters[ name ];
			if ( !n ) {
				n = counters[ name ] = 1;
			}

			// Find the first n that is not in use in a name.
			do {
				newName = name + ' #' + n;
				n += 1;
			} while ( inUse[newName] );

			ql.name = newName;
			counters [ name ] = n;
		}
	}
}

// See if there were any changes between two sets of QLs.  This is to
// fix #29.  While we're at it, build a human notice suitable for a
// desktop notification.

function compareQLLists( first, second ) {
	var key, entry, i, end, a = {}, b = {},
		added = 0, removed = 0, changed = 0, r, n;

	for ( i = 0, end = first.length; i < end; i++) {
		entry = first[ i ];
		a[ entry.name ] = entry;
	}

	for ( i = 0, end = second.length; i < end; i++) {
		entry = second[ i ];
		key = entry.name;
		b[ key ] = true;

		if ( a.hasOwnProperty( key ) ) {
			if ( a[ key ].ql != entry.ql ) {
				changed++;
			}
		}
		else {
			added++;
		}
	}

	for ( key in a ) {
		if ( !b.hasOwnProperty( key ) ) {
			removed++;
		}
	}

	r = [];

	if ( added ) {
		r.push( 'added ' + added );
		n = added;
	}
	if ( changed ) {
		r.push( 'updated ' + changed );
		n = changed;
	}
	if ( removed ) {
		r.push( 'removed ' + removed );
		n = removed;
	}

	if ( r.length == 0 ) {
		return null;
	}

	r = r.join( ', ' );

	return r.substr( 0, 1 ).toUpperCase() + r.substr( 1 ) + ' alliance ' +
		( n == 1 ? 'QL' : 'QLs' ) +
		'.';
}

// Start the ball.
start();

})( document, TreeSlicer );
