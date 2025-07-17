'use strict';

(function( doc, ConfigurationSet, Universe ) {

var
	// The current configuration
	config,
	// The elements of the page that we care about:
	form, container, readListTextarea, applyQLButton, roundsSelect,
	confirmButton,
	// A flag that we found all the above:
	pageScanned,
	// Stuff we add to the page, and may need to remove:
	addedElements;

function start() {
	var cs = new ConfigurationSet(),
		universeName = Universe.getName( doc );

	cs.addKey( 'allianceQLs' + universeName, 'allianceQLs' );
	cs.addKey( 'allianceQLs' + universeName + 'Enabled', 'allianceQLsEnabled' );
	cs.addKey( 'allianceQLs' + universeName + 'MTime', 'allianceQLsMTime' );
	cs.addKey( 'personalQL' + universeName, 'personalQL' );
	cs.addKey( 'personalQL' + universeName + 'Enabled', 'personalQLEnabled' );
	cs.addKey( 'fitAmbushRounds' );
	cs.addKey( 'overrideAmbushRounds' );

	config = cs.makeTracker( applyConfiguration );
}

function applyConfiguration() {
	if ( !pageScanned &&
			( config.allianceQLsEnabled || config.personalQL ||
			  config.fitAmbushRounds || config.overrideAmbushRounds ) ) {
		scanPage();
	}

	if ( addedElements ) {
		removeUI();
	}

	if ( config.allianceQLsEnabled || config.personalQLEnabled ) {
		addQLsUI();
	}

	if ( config.fitAmbushRounds ) {
		setupFitRounds();
	}

    if ( config.overrideAmbushRounds ) {
        selectHighestRounds();
    }
}

// Finds elements we're interested in this page:
// * the TBODY of the TABLE containing the legend ('Ambush mode'),
//   which is where we do all our stuff (we call this 'container')
// * the 'readlist' textarea
// * the 'apply_ql' input
// * the 'rounds' input
function scanPage() {
	if ( pageScanned ) {
		// only run once
		throw new Error( 'scanPage running twice' );
	}

	form = doc.forms.modes;
	// sanity check
	if ( !form || form.children.length < 1 ||
		 form.children[0].children.length < 1 ) {
		return;
	}

	container = form.children[0].children[0];
	// sanity check
	if ( container.tagName.toLowerCase() != 'tbody' ) {
		return;
	}

	readListTextarea = form.elements['readlist'];
	roundsSelect = form.elements['rounds'];
	applyQLButton = form.elements['apply_ql'];
	confirmButton = form.elements['confirm'];

	// sanity check
	if ( !readListTextarea || !roundsSelect ||
		!applyQLButton || !confirmButton ) {
		return;
	}

	// all is well
	pageScanned = true;
}

function addQLsUI() {
	var first, tr, th, td, img, font, div, b, a, span, text, input, br,
		allianceQLs, ql, age, i, end;

	if ( addedElements ) {
		throw new Error( 'addQLsUI running twice without removing UI first' );
	}

	addedElements = [];

	first = container.firstChild;

	tr = doc.createElement( 'tr' );
	th = doc.createElement( 'th' );
	img = doc.createElement( 'img' );
	img.src = chrome.runtime.getURL( 'icons/16.png' );
	img.style.verticalAlign = 'middle';
	img.style.position = 'relative';
	img.style.top = '-2px';
	// Yes, an ugly deprecated <font> below. But this is what Pardus
	// does, and we care more about blending in nicely, than we do
	// about correctness.
	font = doc.createElement( 'font' );
	font.size = 3;
	font.appendChild( img );
	text = doc.createTextNode( ' Fast ambush options' );
	font.appendChild( text );
	th.appendChild( font );
	tr.appendChild( th );
	container.insertBefore( tr, first );
	addedElements.push( tr );

	tr = doc.createElement( 'tr' );
	td = doc.createElement( 'td' );
	// more ugliness
	td.align = 'center';
	// td.style.padding = '17px';

	// If alliance QLs are enabled, add them.
	if ( config.allianceQLsEnabled ) {
		allianceQLs = config.allianceQLs;
		div = doc.createElement( 'div' );
		div.style.margin = '17px';

		if ( allianceQLs.length > 0 ) {
			b = doc.createElement( 'b' );
			span = doc.createElement( 'span' );
			age = Math.floor( Date.now() / 1000 ) - config.allianceQLsMTime;
			if ( age < 0 ) {
				age = 0;
			}
			text = doc.createTextNode( 'last updated ' + timeAgo(age) );
			span.appendChild( text );
			if ( age > 84600 ) {
				span.style.color = 'red';
			}
			text = doc.createTextNode( 'Alliance quick lists ' );
			b.appendChild( text );
			b.appendChild( span );
			text = doc.createTextNode( ':' );
			b.appendChild( text );
			div.appendChild( b );
			br = doc.createElement( 'br' );
			div.appendChild( br );

			for ( i = 0, end = allianceQLs.length; i < end; i++) {
				ql = allianceQLs[ i ];
				addQLUI( div, ql.name, ql.ql );
			}
		}
		else {
			// Alliance QLs on, but no QLs
			a = doc.createElement( 'a' );
			a.href = '/myalliance.php';
			a.textContent = 'My Alliance';
			b = doc.createElement( 'b' );
			text = doc.createTextNode(
				'No alliance quick lists on record. ' +
				'You may try and load some from ' );
			b.appendChild( text );
			b.appendChild( a );
			b.appendChild( doc.createTextNode('.') );
			div.appendChild( b );
		}

		td.appendChild( div );
	}

	// If personal QLs is enabled, add it.
	if ( config.personalQLEnabled ) {
		div = doc.createElement( 'div' );
		div.style.margin = '17px';
		ql = config.personalQL;
		if ( ql && ql.length > 0 ) {
			b = doc.createElement( 'b' );
			b.textContent = 'Personal quick list:';
			div.appendChild( b );
			br = doc.createElement( 'br' );
			div.appendChild( br );
			addQLUI( div, 'Personal QL', ql );
		}
		else {
			b = doc.createElement( 'b' );
			b.textContent =
				'No personal quick list defined. ' +
				'Set one in the Pardus Sweetener options.';
			div.appendChild( b );
		}

		td.appendChild( div );
	}

	tr.appendChild( td );
	container.insertBefore( tr, first );
	addedElements.push( tr );

	tr = doc.createElement( 'tr' );
	td = doc.createElement( 'td' );
	td.align = 'center';
	td.style.paddingBottom = '17px';
	input = doc.createElement( 'input' );
	input.type = 'submit';
	input.name = 'confirm';
	input.value = 'Lay Ambush';
	input.style.backgroundColor = '#600';
	input.style.color = '#fff';
	input.style.fontWeight = 'bold';
	input.style.padding = '3px';
	td.appendChild( input );
	tr.appendChild( td );
	container.insertBefore( tr, first );
	addedElements.push( tr );

	// And while we're at this, lets make the other "lay ambush"
	// button red, too.
	confirmButton.style.backgroundColor = '#600';
	confirmButton.style.color = '#fff';
}

function addQLUI( container, qlname, ql ) {
	var input, applyListener, copyListener, img, rows;

	input = doc.createElement( 'input' );
	input.type = 'button';
	input.name = 'apply' + qlname.replace( /\s/g, '-' );
	input.value = 'Apply ' + qlname;
	applyListener = function() {
		readListTextarea.value = ql;
		applyQLButton.click();
	};

	input.addEventListener( 'click', applyListener );
	container.appendChild( input );

	img = doc.createElement( 'img' );
	img.src = chrome.runtime.getURL( 'icons/down.png' );
	img.alt = 'view';
	img.title = 'Copy ' + qlname + ' to quicklist field below';
	img.style.verticalAlign = 'middle';
	rows = 2 + Math.floor( ql.length / 80 );
	copyListener = function() {
		readListTextarea.value = ql;
		readListTextarea.cols = 80;
		readListTextarea.rows = rows;
		scrollTo( readListTextarea );
	};

	img.addEventListener( 'click', copyListener );
	container.appendChild( img );
	container.appendChild( doc.createTextNode("\n") );
}

function removeUI() {
	var elt;

	while ( addedElements.length > 0 ) {
		elt = addedElements.pop();
		elt.parentNode.removeChild( elt );
	}

	addedElements = undefined;

	form.removeEventListener( 'submit', onFormSubmit );
}

function timeAgo( seconds ) {
	var n;

	if ( seconds < 60 ) {
		return 'just now';
	}

	if ( seconds < 3600 ) {
		n = Math.round( seconds / 60 );
		return ( n == 1 ? 'a minute' : n + ' minutes' ) + ' ago';
	}

	if ( seconds < 86400 ) {
		n = Math.round( seconds/ 3600 );
		return ( n == 1 ? 'an hour' : n + ' hours' ) + ' ago';
	}

	n = Math.round( seconds/86400 );
	return ( n == 1 ? 'yesterday' : n + ' days ago' );
}

// utility method, may move elsewhere
function scrollTo( element ) {
	var x = 0, y = 0;

	while ( element ) {
		x += element.offsetLeft;
		y += element.offsetTop;
		element = element.offsetParent;
	}

	doc.defaultView.scrollTo( x, y );
}

function getHighestRoundsOption() {
	var elt, highest, highestElt, opts, i, end, opt, n;

	elt = roundsSelect;
	highest = -1;
	highestElt = null;
	opts = elt.options;
	for ( i = 0, end = opts.length; i < end; i++) {
		opt = opts[ i ];
		n = parseInt( opt.value );
		if ( n > highest) {
			highest = n;
			highestElt = opt;
		}
	}

	return highestElt;
}

// Perhaps this could be merged with the rounds function in combat.js.
function selectHighestRounds() {
	getHighestRoundsOption().selected = true;
}

function setupFitRounds() {
	form.addEventListener( 'submit', onFormSubmit );
}

function onFormSubmit( event ) {
	var ql, newQL, match, option, rounds, maxRounds;

	if ( !pageScanned ) {
		console.warn( 'Trapping submits before page scan, this is a bug' );
		return;
	}

	// Figure out if the readListTextarea value ends with a number of
	// rounds, and optionally a QL exclude mode.
	ql = readListTextarea.value;
	match = /;\s*([0-9][0-9\s]*)(?:;\s*([es])\s*)?$/.exec( ql );

	if ( match ) {
		// Ok, now see if the number of rounds is larger than the
		// maximum option in the rounds select.
		rounds = parseInt( match[ 1 ].replace( /\s+/g, '' ) );
		maxRounds = parseInt ( getHighestRoundsOption().value );

		if ( rounds > maxRounds ) {
			// Yup. We need to fix this and replace the textarea value.
			newQL = ql.substr( 0, match.index ) + ';' + maxRounds;
			if ( match[ 2 ] ) {
				newQL += ( ';' + match[ 2 ] );
			}
			readListTextarea.value = newQL;
		}
	}
}

start();

})( document, ConfigurationSet, Universe );
