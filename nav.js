// The nav driver.
// Require shiplinks.js

'use strict';

(function( top, doc, ShipLinks, SectorMap ){

var LOCATION_LINKS = {
		planet: [
			{ key: 'navEquipmentLink',
			  text: 'Ship equipment',
			  url: 'ship_equipment.php' },
			{ key: 'navTradeLink',
			  text: 'Trade with planet',
			  url: 'planet_trade.php' },
			{ key: 'navBlackMarketLink',
			  text: 'Black market',
			  url: 'blackmarket.php' },
			{ key: 'navHackLink',
			  text: 'Hack information',
			  url: 'hack.php' },
			{ key: 'navBulletinBoardLink',
			  text: 'Bulletin board',
			  url: 'bulletin_board.php' },
			{ key: 'navBountyBoardLink',
			  text: 'Bounty board',
			  url: 'bounties.php' },
			{ key: 'navShipyardLink',
			  text: 'Shipyard',
			  url: 'shipyard.php' },
			{ key: 'navCrewQuartersLink',
			  text: 'Crew quarters',
			  url: 'crew_quarters.php' }
		],
		starbase: [
			{ key: 'navEquipmentLink',
			  text: 'Ship equipment',
			  url: 'ship_equipment.php' },
			{ key: 'navTradeLink',
			  text: 'Trade with starbase',
			  url: 'starbase_trade.php' },
			{ key: 'navBlackMarketLink',
			  text: 'Black market',
			  url: 'blackmarket.php' },
			{ key: 'navHackLink',
			  text: 'Hack information',
			  url: 'hack.php' },
			{ key: 'navBulletinBoardLink',
			  text: 'Bulletin board',
			  url: 'bulletin_board.php' },
			{ key: 'navBountyBoardLink',
			  text: 'Bounty board',
			  url: 'bounties.php' },
			{ key: 'navShipyardLink',
			  text: 'Shipyard',
			  url: 'shipyard.php' },
			{ key: 'navCrewQuartersLink',
			  text: 'Crew quarters',
			  url: 'crew_quarters.php' },
			{ key: 'navFlyCloseLink',
			  text: 'Fly close',
			  url: 'main.php?entersb=1' } ],
		building: [
			{ key: 'navTradeLink',
			  text: 'Trade with building',
			  url: 'building_trade.php' },
			{ key: 'navHackLink',
			  text: 'Hack information',
			  url: 'hack.php' }
		]
	};

// These variables hold state for the different bits and bobs on this
// page:
var config, configured, userloc, ajax, shiplinks,
	showingLoclinks, minimap, minimapSector, minimapContainer,
	fieldsTotal, navSizeHor, navSizeVer, tileRes ;

function start() {
	var cs = new ConfigurationSet();

	cs.addKey( 'navShipLinks' );
	cs.addKey( 'miniMap' );
	cs.addKey( 'miniMapPlacement' );

	cs.addKey( 'navEquipmentLink' );
	cs.addKey( 'navShipyardLink' );
	cs.addKey( 'navCrewQuartersLink' );
	cs.addKey( 'navTradeLink' );
	cs.addKey( 'navBlackMarketLink' );
	cs.addKey( 'navHackLink' );
	cs.addKey( 'navBulletinBoardLink' );
	cs.addKey( 'navBountyBoardLink' );
	cs.addKey( 'navFlyCloseLink' );
	
	cs.addKey( 'onlinelist' ); 
	
	shiplinks = new ShipLinks.Controller
		( 'table/tbody/tr/td[position() = 2]/a', matchShipId );
	config = cs.makeTracker( applyConfiguration );

}

function applyConfiguration() {
	if ( configured ) {
		// Skipping these the first time we run because we know
		// there's an upcoming game message which will call these
		// anyway.  Subsequent calls are configuration changes tho,
		// then we want to act.

		shiplinks.update( config.navShipLinks );
		updateLocationLinks();

		// This may be a bit wasteful: we reinstall the minimap even
		// if unrelated parameters changed.  Configuration changes are
		// infrequent, though.
		removeMinimap();
		updateMinimap();
	}
	else {
		// Instead, we only want to do this the first time we run,
		// because we only want to do it once.  We didn't do it in
		// start() because we didn't want to receive messages from the
		// game until we were properly configured.  But now we are.

		// Insert a bit of script to execute in the page's context
		// and send us what we need. And add a listener to receive
		// the call.  This will call us back immediately, and
		// again whenever a partial refresh completes.
		doc.defaultView.addEventListener( 'message', onGameMessage );
		var script = doc.createElement( 'script' );
		script.type = 'text/javascript';
		//script.textContent = "(function() {var fn=function(){window.postMessage({pardus_sweetener:1,loc:typeof(userloc)=='undefined'?null:userloc,ajax:typeof(ajax)=='undefined'?null:ajax},window.location.origin);};if(typeof(addUserFunction)=='function')addUserFunction(fn);fn();})();";
		script.textContent = "(function() {var fn=function(){window.postMessage({pardus_sweetener:1,loc:typeof(userloc)=='undefined'?null:userloc,ajax:typeof(ajax)=='undefined'?null:ajax,navSizeVer:typeof(navSizeVer)=='undefined'?null:navSizeVer,navSizeHor:typeof(navSizeHor)=='undefined'?null:navSizeHor,fieldsTotal:typeof(fieldsTotal)=='undefined'?null:fieldsTotal,tileRes:typeof(tileRes)=='undefined'?null:tileRes},window.location.origin);};if(typeof(addUserFunction)=='function')addUserFunction(fn);fn();})();";
		doc.body.appendChild( script );
		
		configured = true;
	}
}

// Arrival of a message means the page contents were updated.  The
// message contains the value of the userloc variable, too.
function onGameMessage( event ) {
	var data = event.data;

	if ( !data || data.pardus_sweetener != 1 ) {
		return;
	}
	
	userloc = parseInt( data.loc );
	fieldsTotal = parseInt( data.fieldsTotal );
	navSizeHor = parseInt( data.navSizeHor );
	navSizeVer = parseInt( data.navSizeVer );
	tileRes = parseInt( data.tileRes );
	ajax = data.ajax;

	// The shiplinks box is usually clobbered by partial refresh, so
	// we need a new container. This is cheap anyway.
	shiplinks.setContainer( doc.getElementById('otherships_content') );
	shiplinks.update( config.navShipLinks );

	// Likewise, the commands box may have been wiped.
	updateLocationLinks();

	updateMinimap();

	updatePathfinding();

	configured = true;
}

// This does a bit more work than may be needed. It's called when a
// partial refresh completes, and also when configuration changes.
// The possibly wasteful computations are:
//
// * It may remove elements with class 'psw-plink' after partial
//   refresh just clobbered the commands_content box, so there won't
//   be any such elements anyway.  We don't know if we can ascertain
//   cheaply that we still have the old box, though, so we could do
//   the removal conditionally.  In any case, we don't do the removal
//   if the previous call resulted in no links, which means the
//   majority of times we won't do it anyway.
//
// * It will reinstall the location links when unrelated configuration
//   parameter change.  Specifically: navShipLinks, minimap,
//   minimapPlacement.  This, however, is very infrequent; we'd waste
//   a lot more time checking whether loclinks options changed, every
//   time.

function updateLocationLinks() {
	var loctype, cbox, anchor, loclinks, here;

	cbox = doc.getElementById( 'commands_content' );

	if ( showingLoclinks ) {
		// Remove all links we may have added before.
		ShipLinks.removeElementsByClassName( cbox, 'psw-plink' );
		showingLoclinks = false;
	}

	// Find the "Land on planet", "Land on starbase" or "Enter
	// building" anchor.
	if (( anchor = doc.getElementById( 'aCmdPlanet' ) )) {
		loctype = 'planet';
	}
	else if (( anchor = doc.getElementById('aCmdStarbase') )) {
		loctype = 'starbase';
	}
	else if (( anchor = doc.getElementById('aCmdBuilding') )) {
		loctype = 'building';
	}
	else {
		return;
	}

	loclinks = LOCATION_LINKS[ loctype ];
	here = anchor.parentNode.nextSibling;
	for ( var i = 0, end = loclinks.length; i < end; i++ ) {
		var spec = loclinks[ i ];

		if ( config[ spec.key ] ) {
			var e = doc.createElement( 'div' ),
				a = doc.createElement( 'a' );

			e.className = 'psw-plink';
			a.href = spec.url;
			a.textContent = spec.text;
			e.appendChild( a );

			// don't ask me, this weird positioning is how pardus does it...
			e.style.position = 'relative';
			e.style.top = '6px';
			e.style.left = '6px';
			e.style.fontSize = '11px';
			cbox.insertBefore( e, here );

			showingLoclinks = true;
		}
	}
}

function matchShipId( url ) {
	var rx, r, m;

	// This matches strings of the form:
	//   javascript:scanId(22324, "player")
	// or
	//   javascript:scanId(25113, "opponent")
	rx = /^javascript:scanId\((\d+),\s*['"]([^'"]+)['"]\)|main\.php\?scan_details=(\d+)&scan_type=([A-Za-z]+).*$/;
	m = rx.exec( url );
	if ( m ) {
		var id = m[ 1 ];
		if ( id ) {
			r = { type: m[2], id: parseInt( id ) };
		}
		else {
			r = { type: m[4], id: parseInt( m[ 3 ] ) };
		}
	}

	return r;
}

function updateMinimap() {
	var sectorName;
	
	if ( !config.miniMap ) {
		return;
	}

	sectorName = getCurrentSectorName();
	if ( sectorName ) {
		// If we have a map, and the sector currently displayed is the
		// one we're in, just refresh the map to show our current
		// position.
		if ( minimap && minimapSector && minimapSector.sector == sectorName ) {
			refreshMinimap();
		}
		else {
			// We need to reconfigure the map.  See if we have the map
			// data cached in the top window.  If we do, we can save a
			// lot of time: no message shuffling, no XMLHttpRequest in
			// the event page, no JSON parsing.
			var sector = top.psMapData && top.psMapData[ sectorName ];
			if ( sector ) {
				configureMinimap( sector );
			}
			else {
				// Nope, request it
				chrome.runtime.sendMessage( { requestMap: sectorName },
											configureMinimap );
			}
		}
	}
	else {
		// If we don't know in which sector we are, there's no point
		// in showing a map at all.
		removeMinimap();
	}
}

// This assumes we have a working map.
function refreshMinimap() {
	var ctx = minimap.get2DContext(), coords = getCurrentCoords();

	minimap.clear( ctx );

	if ( coords ) {
		minimap.markTile( ctx, coords.col, coords.row, '#0f0' );
	}
}

function removeMinimap() {
	minimap = undefined;
	minimapSector = undefined;
	if ( minimapContainer ) {
		minimapContainer.parentNode.removeChild( minimapContainer );
		minimapContainer = undefined;
	}
}

// This is called when we receive the sector data from the extension.
function configureMinimap( sector ) {
	var canvas, container, size;

	// If we were showing a map, get shot of it, we're rebuilding it
	// anyway.
	removeMinimap();
	
	if ( sector.error ) {
		return;
	}

	// Cache the sector data, so we don't ask for it again.
	if ( !top.psMapData ) {
		top.psMapData = {};
	}
	top.psMapData[ sector.sector ] = sector;

	canvas = doc.createElement( 'canvas' );

	// Figure out where to place the map and what size it should be.

	if ( config.miniMapPlacement == 'statusbox' ) {
		// Inside the status box.  This is a table with id "status",
		// which contains three rows. The first and last are graphic
		// stuff, contain pics showing the top and bottom of a box -
		// all very early 2000's HTML, this.  The middle row contains
		// a td which in turn contains a div with id "status_content",
		// where all the status stuff is shown.
		//
		// Now the "status_content" div gets clobbered by partial
		// refresh, so we don't add our canvas to it - we want it to
		// outlive partial refresh.  Also, partial refresh *appends* a
		// new "status_content" div to the td that contained the old
		// one, so we can't add our map in that same td either, or
		// else the new status_content would end up below the old map
		// after the first partial refresh.
		//
		// So what we do instead is: we add a new tr to the status
		// table, right after the tr that contains status_content, and
		// before the tr with the bottom picture.  And our map lives
		// in that new tr.

		var tbody, tr, td, newtd;

		// Right then, so first we find the td that contains
		// "status_content"...
		td = doc.evaluate( "//tr/td[div[@id = 'status_content']]",
						   doc, null, XPathResult.ANY_UNORDERED_NODE_TYPE,
						   null ).singleNodeValue;
		if ( !td ) {
			return;
		}

		// ... and its parent tr, and whatever contains that (tbody of
		// course, but we don't care what exactly it is).
		tr = td.parentNode;
		tbody = tr.parentNode;

		// Then we shallow-clone both, so we get their attributes,
		// which include their styling.  The new td will contain the
		// map canvas and the new tr will be the single element that
		// we'll insert in the document (read: the one that would have
		// to be removed to restore the document to its pristine
		// state).
		container = tr.cloneNode( false );
		newtd = td.cloneNode( false );

		// Tweak a bit for looks.  This is needed because Pardus'
		// tables are off centre with respect to the borders drawn as
		// background images.  Crusty HTML there, I tell you.
		newtd.style.textAlign = 'center';
		newtd.style.paddingRight = '3px';

		// Finally, add the canvas and assemble the table row.
		newtd.appendChild( canvas );
		container.appendChild( newtd );
		tbody.insertBefore( container, tr.nextSibling );
		size = 180;
	}
	else {
		// Add the map at the top of the right-side bar.  This is
		// easier: there's a td that contains the whole sidebar, so we
		// just insert a div as first element.

		var td = doc.getElementById( 'tdTabsRight' );

		if ( !td ) {
			return;
		}

		container = doc.createElement( 'div' );
		container.style.textAlign = 'center';
		container.style.width = '208px';
		container.style.margin = '0 2px 24px auto';
		canvas.style.border = '1px outset #a0b1c9';
		container.appendChild( canvas );
		td.insertBefore( container, td.firstChild );
		size = 200;
	}

	// At this point we already have the canvas in the document. So
	// just configure it, and remember the pertinent variables.
	minimap = new SectorMap();
	minimap.setCanvas( canvas );
	minimap.configure( sector, size );
	minimapContainer = container;
	minimapSector = sector;

	// And draw the map.
	refreshMinimap();
}

function getCurrentSectorName() {
	var elt = doc.getElementById( 'sector' );
	return elt ? elt.textContent : null;
}

function getCurrentCoords( result ) {
	var elt = doc.getElementById( 'coords' );
	if ( elt ) {
		var m = /^\[(\d+),(\d+)\]$/.exec( elt.textContent );
		if ( m ) {
			if ( !result ) {
				result = new Object();
			}
			result.col = parseInt( m[1] );
			result.row = parseInt( m[2] );
			return result;
		}
	}

	return null;
}

function updatePathfinding() {
	
	var navDiv = doc.getElementById("nav").parentNode;
	var horpix = navSizeHor * tileRes ;
    var verpix = navSizeVer * tileRes ;
	navDiv.style.width = (horpix + 2*navSizeHor).toString() + 'px';
    navDiv.style.height = (verpix + 2*navSizeVer).toString() + 'px';
	
    for (var i = 0 ; i< fieldsTotal ; i++) {
        var theCell = doc.getElementById('tdNavField'+String(i));
        theCell.addEventListener('mouseover',function(){showpath(this);}, false);
        theCell.addEventListener('mouseout',function(){clearpath();}, false);
        theCell.style.borderWidth = "1px";
        theCell.style.borderStyle = "solid";
        theCell.style.borderColor = "black";
    }
}

function showpath(cell){
    cell.style.borderColor = "red";
    var increment,x,APs = 0;
    var selected = parseInt(cell.getAttribute('id').split('tdNavField')[1]);
    var centerx = Math.floor(navSizeHor/2)+1;
    var centery = Math.floor(navSizeVer/2)+1;
	var selectedx = selected % navSizeHor - centerx + 1;
    var selectedy = -(Math.floor(selected / navSizeHor) - centery + 1); // (0,0) is current position)
    var n = (centery-1)*navSizeHor + centerx - 1;

    document.getElementById('tdNavField' + String(n)).style.borderColor = "red";

    for (var i = 0 ; i < Math.max(Math.abs(selectedx),Math.abs(selectedy)) ; i++) {

		if (i < Math.min(Math.abs(selectedx),Math.abs(selectedy))) {
			n += -Math.sign(selectedy)*navSizeHor + Math.sign(selectedx);
			}
		else if (i > Math.abs(selectedy)) {
            n += Math.sign(selectedx);
        }
        else if (i > Math.abs(selectedx)) {
            n += -Math.sign(selectedy)*navSizeHor;
        }
        var cur_tile = document.getElementById('tdNavField' + String(n));
        cur_tile.style.borderColor = "red";

    }
}

function clearpath() {
    for (var i = 0 ; i< fieldsTotal ; i++) {
        var theCell = document.getElementById('tdNavField'+String(i));
        theCell.style.borderColor = "black";
	}
}
	
start();

})( top, document, ShipLinks, SectorMap );
