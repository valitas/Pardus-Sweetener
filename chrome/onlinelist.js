'use strict';

(function( doc, ConfigurationSet, Universe ) {

var config, configured;

function start() {
	var cs = new ConfigurationSet();
	var universe = Universe.getServer( doc );

	cs.addKey( universe + 'OnlineListEnabled', 'onlineListEnabled' );
	cs.addKey( universe + 'OnlineList', 'onlineList' );

	config = cs.makeTracker( applyColor );
}

// Parse the list as typed by the user into a map of names, and return it.
// Split on commas, tabs, or newlines; index by downcased name, so we get fast
// case-insensitive lookups.
function parseList( str ) {
	var names, name, index;

	names = str.split( /[,\t\n]+/ );
	index = new Object();

	for(var i = 0, end = names.length; i < end; i++ ) {
		name = names[ i ].trim();
		if ( name !== '' )
			index[ name.toLowerCase() ] = name;
	}

	return index;
}

function applyColor () {
	var table, names, name, i, end, xpr, a, links;

	if( configured || !config.onlineListEnabled )
		return;

	configured = true;
	names = parseList( config.onlineList );
	links = [];

	// Find the online list table.  It'll be the one with heading
	// "Online Users Total"
	xpr = doc.evaluate(
		"//table[tbody/tr/th/text() = 'Online Users Total']",
		doc, null, XPathResult.ANY_UNORDERED_NODE_TYPE, null);
	if( !xpr )
		return;
	table = xpr.singleNodeValue;

	// Scan the names in this table
	xpr = doc.evaluate(
		"tbody/tr/td/a",
		table, null, XPathResult.UNORDERED_NODE_ITERATOR_TYPE, null);
	while(( a = xpr.iterateNext() )) {
		name = a.textContent.toLowerCase();
		if( names[name] ) {
			a.style.color = '#f69';
			links.push( a );
		}
	}

	// Add the "people of interest" table if there are any.
	if( links.length > 0 ) {
		var container = table.parentElement;
		var poitable = createNamesTable( links );
		container.insertBefore( poitable, table );
		container.insertBefore( document.createElement('br'), table );
		container.insertBefore( document.createElement('br'), table );
	}
}

function createNamesTable( links ) {
	var tab = doc.createElement( 'table' );
	tab.className = 'messagestyle';
	var tbody = doc.createElement( 'tbody' );
	tab.appendChild( tbody );
	var tr = doc.createElement( 'tr' );
	tbody.appendChild(tr);
	var td = doc.createElement( 'th' );
	td.colSpan = 4;
	var label;
	if( links.length == 1 )
		label = '1 Person of Interest';
	else
		label = '' + links.length + ' People of Interest';
	td.appendChild( doc.createTextNode(label) );
	tr.appendChild( td );

	var column = 0;
	for( var i = 0, end = links.length, row = 0; i < end; i++, column++ ) {
		if( column == 4 ) {
			column = 0;
			row++;
		}
		if( column == 0 ) {
			tr = doc.createElement( 'tr' );
			if( row % 2 == 1 )
				tr.className = 'alternating';
			tbody.appendChild( tr );
		}
		td = doc.createElement( 'td' );
		td.appendChild( links[i].cloneNode(true) );
		tr.appendChild( td );
	}

	for( ; column < 4; column++ ) {
		td = doc.createElement( 'td' );
		tr.appendChild( td );
	}

	return tab;
}

start();

})( document, ConfigurationSet, Universe );
