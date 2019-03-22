 // The nav driver.
// Require shiplinks.js

'use strict';

(function( top, doc, ShipLinks, SectorMap, Sector ){

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

var HIGHLIGHTED_RX = /^\s*linear-gradient/;
var UNHIGHLIGHT_RX = /^\s*linear-gradient.*?, (url\(.*)$/;

// These variables hold state for the different bits and bobs on this
// page:
var config, configured, userloc, ajax, shiplinks,
	showingLoclinks, minimap, minimapSector, minimapContainer,
	fieldsTotal, navSizeHor, navSizeVer, tileRes;

// Pathfinder stuff, these are updated by updatePathfinding().  `navtable` is a
// reference to the table actually containing the visible map tiles, it can be
// #navarea or #navareatransition.  `tileidx` is an index of the visible tiles
// in the navtable, keyed by ID.  `highlightedTiles` is an array containing
// references to the tiles that have been highlighted, so we can undo the
// highlighting quickly.  navscanXEval is an XPathEvaluator for quickly finding
// all TDs of a a table; it's precompiled because we do this many times, every
// time we update tileidx. `highlightedRPTiles` is as above, but for the
// routeplanning.
var navtable, navidx, highlightedTiles, navTilesXEval, highlightedRPTiles;

//milliseconds
var oneHour = 3600000;
var halfHour = 1800000;

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
	cs.addKey( 'pathfindingEnabled' );
	cs.addKey( 'navigationCoordinates' );
	cs.addKey( 'clockD' );
	cs.addKey( 'displayNavigationEnabled' );
	cs.addKey( 'miniMapNavigation' );
	cs.addKey( 'clockStim' );
	cs.addKey( 'missionDisplay' );
	cs.addKey( 'displayVisited' );
    cs.addKey( 'displayVisitedDecay' );
    
    let ukey = Universe.getServer( document ).substr( 0, 1 );
    cs.addKey( ukey + 'storedPath' );

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

		updatePathfinding();
		updateNavigationGrid();

		let ukey = Universe.getServer( doc ).substr( 0, 1 );

		if ( config.displayNavigationEnabled ) {
			let name = ukey + 'storedPath';
			chrome.storage.local.get( name , updateRoutePlanner );
		}
		if ( config.missionDisplay ) {
			chrome.storage.local.get( [ ukey + 'mlist' ], showMissions );
		}
        if ( config.displayVisited ) {
            chrome.storage.local.get( [ ukey + 'visit' ], highlightVisited );
        } else {
            chrome.storage.local.remove( [ ukey + 'visit' ] );
        }
	}
	else {
		// Instead, we only want to do this the first time we run,
		// because we only want to do it once.  We didn't do it in
		// start() because we didn't want to receive messages from the
		// game until we were properly configured.  But now we are.

		navTilesXEval = doc.createExpression( 'tbody/tr/td', null );
		highlightedTiles = [];

		// Insert a bit of script to execute in the page's context
		// and send us what we need. And add a listener to receive
		// the call.  This will call us back immediately, and
		// again whenever a partial refresh completes.
		doc.defaultView.addEventListener( 'message', onGameMessage );
		var script = doc.createElement( 'script' );
		script.type = 'text/javascript';
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

	// sending userloc to storage
	let saveData = {};
	saveData[ Universe.getName( document )[0] + 'loc' ] = userloc;
	chrome.storage.local.set( saveData );

	// The shiplinks box is usually clobbered by partial refresh, so
	// we need a new container. This is cheap anyway.
	shiplinks.setContainer( doc.getElementById('otherships_content') );
	shiplinks.update( config.navShipLinks );

	// Likewise, the commands box may have been wiped.
	updateLocationLinks();

	updateMinimap();
	updateNavigationGrid();
	updatePathfinding();
	addDrugTimer();
	addStimTimer();

	let ukey = Universe.getServer ( doc ).substr( 0, 1 );
	if ( config.displayNavigationEnabled ) {
		let name = ukey + 'storedPath';
		chrome.storage.local.get( name , updateRoutePlanner );
	}
	if ( config.missionDisplay ) {
		chrome.storage.local.get( [ ukey + 'mlist' ], showMissions );
	}
    if ( config.displayVisited ) {
        chrome.storage.local.get( [ ukey + 'visit' ], highlightVisited );
    } else {
        chrome.storage.local.remove( [ ukey + 'visit' ] );
    }
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
	rx = /^javascript:scanId\((\d+),(?: |%20)*['"]([^'"]+)['"]\)|main\.php\?scan_details=(\d+)&scan_type=([A-Za-z]+).*$/;
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
		minimap.setShipCoords( coords.col, coords.row );
		minimap.markShipTile( ctx );
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
	var canvas, div, container, size;

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

	// Create the map canvas
	canvas = doc.createElement( 'canvas' );
	
	// Create the div that will hold distance calculations
	div = doc.createElement( 'div' );
	div.style.paddingTop = '4px';
	div.style.display = 'none';

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
		newtd.appendChild( div );
		container.appendChild( newtd );
		tbody.insertBefore( container, tr.nextSibling );
		size = 180;
	}
	else if ( config.miniMapPlacement == 'navbox' || config.miniMapPlacement == 'navboxXL') {
		// Add the map at the under the navigation box.
		// This allows for the biggest navigation area.

		var td = doc.getElementById( 'tdSpaceChart' );

		if ( !td ) {
			return;
		}

		container = doc.createElement( 'div' );
		container.style.textAlign = 'center';
		if ( config.miniMapPlacement == 'navbox' ) {
			size = doc.getElementById("navarea").offsetWidth;
		}
		else {
			size = td.offsetWidth;
		}
		
		//put the distance text on top
		container.style.margin = '0 2px 24px auto';
		canvas.style.border = '1px outset #a0b1c9';
		container.appendChild( div );
		container.appendChild( canvas );
		td.appendChild( container );
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
		container.appendChild( div );
		td.insertBefore( container, td.firstChild );
		size = 200;
	}

	// At this point we already have the canvas in the document. So
	// just configure it, and remember the pertinent variables.
	minimap = new SectorMap();
	minimap.setCanvas( canvas, div );
	minimap.configure( sector, size );
	minimapContainer = container;
	minimapSector = sector;

	if (config.miniMapNavigation) {
		minimap.enablePathfinding();
	}

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
	if( !config.pathfindingEnabled ) {
		if( navtable ) {
			navtable.removeEventListener( 'mouseover', showpath, false);
			navtable.removeEventListener( 'mouseout', clearpath, false);
		}
		if( highlightedTiles )
			clearpath();
		navtable = null;
		navidx = null;
		return;
	}

	// Yes, Pardus is a mess.
	navtable = doc.getElementById( 'navareatransition' );
	if ( !navtable )
		navtable = doc.getElementById( 'navarea' );
	if ( !navtable )
		return;

	navidx = new Object();
	var xpr = navTilesXEval.evaluate(
		navtable, XPathResult.UNORDERED_NODE_ITERATOR_TYPE, null ),
		td;
	while(( td = xpr.iterateNext() ))
		navidx[ td.id ] = td;

	navtable.addEventListener( 'mouseover', showpath, false);
	navtable.addEventListener( 'mouseout', clearpath, false);
}

//manages the navigation co-ords grid.

function updateNavigationGrid() {
	//yes, pardus is a mess
	navtable = doc.getElementById( 'navareatransition' );
	if ( !navtable )
		navtable = doc.getElementById( 'navarea' );
	if ( !navtable )
		return;

	if( !config.navigationCoordinates ) {
		//remove the navgiation grid, reset the nav area
		Array.from(document.getElementsByClassName("coordGrid")).forEach( f => f.remove() )
		navtable.parentNode.parentNode.parentNode.style.padding = ""
		//spaceChart.className = ""; // should remove this but would need to check if it's there first...
		//navtable.style.borderSpacing = "";
		return;
	}
	var spaceChart = document.getElementById("tdSpaceChart")
	if (!spaceChart) {
		//console.log("no spaceChart i guess you're in dock?")
		return;
	}
	
	if (!spaceChart.className) {
		//overall style changes
		//maybe add only to bottom and right?
		navtable.parentNode.parentNode.parentNode.style.padding = "15px"
		spaceChart.className = "sweetener-grid";
	}

	//adding space, maybe make optional
	//honestly i find it a bit nauseating
	//navtable.style.borderSpacing = "1px";

	//removing old griders so we can replace them
	//they call this "job security"
	//todo: optimize by reducing number of replacements to only when the pilot actually moves
	//todo: optimize by only popping and shifting elements as needed?
	Array.from(document.getElementsByClassName("coordGrid")).forEach( f => f.remove() )

	//general formatting
	var _trs = spaceChart.getElementsByTagName("tr")
	var topD = _trs[0].children[1];
	var bottomD = _trs[_trs.length-1].children[1];
	var leftD = _trs[2].children[0];
	var rightD = _trs[2].children[2];
	leftD.style.position = "relative";
	rightD.style.position = "relative";

	//guesstimate nav size
	var navAreaDimensions = [ _trs[3].children.length, navtable.getElementsByTagName("tr").length ];
	//in case people play on sizes other than 64
	//tile sizes are nf = 64, nf96 = 96, nf128 = 128
	var navTileSize = {'nf' : 64, 'nf96' : 96, 'nf128' : 128}[_trs[3].children[0].getElementsByTagName('img')[0].className];
	//use nav size to figure out what numbers should be
	//store the numbers as 2 arrays - one for row (aka y) and one for colum (x)
	//get user's current coordinates
	var _pilotCoords = getCurrentCoords();
	var _columns = [];
	for (var i = 0; i < navAreaDimensions[0]; i ++ ) {
		_columns.push(_pilotCoords.col + i - Math.floor(navAreaDimensions[0] / 2))
	}
	var _rows = [];
	for (var i = 0; i < navAreaDimensions[1]; i ++ ) {
		_rows.push(_pilotCoords.row + i - Math.floor(navAreaDimensions[1] / 2))
	}
	
	//defining girders
	var topDiv = document.createElement("div");
	var bottomDiv = document.createElement("div");
	var leftDiv = document.createElement("div");
	var rightDiv = document.createElement("div");

	topDiv.className = "coordGrid coordGridTop";
	bottomDiv.className = "coordGrid coordGridBottom";
	leftDiv.className = "coordGrid coordGridLeft";
	rightDiv.className = "coordGrid coordGridRight";

	//dynamic setting spacing. would prefer to inject to CSS rather than per element but oh well.
	topDiv.style.width = navTileSize + "px";
	bottomDiv.style.width = navTileSize + "px";
	leftDiv.style.lineHeight = navTileSize + "px";
	rightDiv.style.lineHeight = navTileSize + "px";
	
	//for all the numbers, add girders (wrong word?) to the nav box area thing
	_columns.forEach(e=>{
		addGirder(e, topDiv, topD)
		addGirder(e, bottomDiv,bottomD)
	});

	_rows.forEach(e=>{
		addGirder(e, leftDiv, leftD)
		addGirder(e, rightDiv,rightD)
	});

	//minor helper function
	function addGirder(number, element, parent) {
		element.innerText = number;
		parent.innerHTML += element.outerHTML //thanks i hate this
	}
}

// Given the TD corresponding to a tile, update its style and that of the image
// inside it for path highlighting.

function highlightTileInPath( td ) {
	// Pardus does things messy, as usual.  If a tile is empty, then pardus
	// inserts the background image as a IMG child of the TD.  If the tile
	// is not empty though (has a building or NPC), then the background
	// image is set with CSS (as background-image) and the IMG child becomes
	// the NPC.

	var bimg = td.style.backgroundImage;
	if( bimg ) {
		// don't do this twice
		if( !HIGHLIGHTED_RX.test(bimg) ) {
			// if (!type) {
				td.style.backgroundImage =
				'linear-gradient(to bottom, rgba(255,105,180,0.15), rgba(255,105,180,0.15)),' 
                + bimg;
			// } else {
				// td.style.backgroundImage =
				// 'radial-gradient(rgba(255,105,180,0.15),rgba(255,125,180,0.15)), '
				// + bimg;
			}
	}
	else {
			// if ( !type ) {
				if ( !td.style.backgroundColor ) {
					td.style.backgroundColor = 'rgba(255,105,180,1)';
			// } else {
				// td.style.backgroundColor = 'rgba(255,125,180,1)';
			}
			var img = td.firstElementChild;
			img.style.opacity = 0.85;
	}
	// if (!type) 
			highlightedTiles.push( td );
}

// Revert the effect of the above only in case of ship path highlighting
function clearHighlightTileInPath( td ) {
	var bimg = td.style.getPropertyValue( 'background-image' );
	if( bimg ) {
		var m = UNHIGHLIGHT_RX.exec( bimg );
		if( m ) {
			td.style.backgroundImage = m[1];
		}
	}
	else {
        td.style.backgroundColor = null;
        var img = td.firstElementChild;
        img.style.opacity = null;
	}
}

function showpath( event ){
	var cell = event.target;
	while( cell && cell.nodeName != 'TD' )
		cell = cell.parentElement;
	if( !cell )
		return;

	//checks if the cell's stringified ID contains nav field. 
	//captures null IDs for compatibility with navigation coords, hopefully.
	if( !(cell.getAttribute('id') + "").includes('tdNavField') ) {
		return;
	}
	if( cell.classList.contains('navImpassable') )
		return;

	highlightTileInPath( cell );

	var increment,x = 0;
	var selected = parseInt( cell.getAttribute('id').split('tdNavField')[1] );
	var centerx = Math.floor( navSizeHor/2 ) + 1;
	var centery = Math.floor( navSizeVer/2 ) + 1;
	var selectedx = selected % navSizeHor - centerx + 1;
	var selectedy = -( Math.floor(selected / navSizeHor) - centery + 1 ); // (0,0) is current position)
	var n = ( centery - 1 )*navSizeHor + centerx - 1;

	var td = navidx[ 'tdNavField' + n ];

	highlightTileInPath( td );

	for (var i = 0, end = Math.max( Math.abs(selectedx), Math.abs(selectedy) ); i < end ; i++) {
		if( i < Math.min( Math.abs(selectedx), Math.abs(selectedy) ) )
			n += -Math.sign(selectedy)*navSizeHor + Math.sign(selectedx);
		else if (i > Math.abs(selectedy))
			n += Math.sign(selectedx);
		else if (i > Math.abs(selectedx))
			n += -Math.sign(selectedy)*navSizeHor;

		var cur_tile = navidx[ 'tdNavField' + n ];
		if (!cur_tile.classList.contains('navImpassable')) {
			highlightTileInPath( cur_tile );
		}
	}
}

function clearpath() {
	var i, end, td;

	for( i = 0, end = highlightedTiles.length; i < end; i++ ) {
		td = highlightedTiles[ i ];
		clearHighlightTileInPath( td );
	}

	highlightedTiles.length = 0;
}

// This is called when the page loads, and again after any "AJAX" interaction,
// including ship movement and all that.  Also when the "use resources" form
// opens, and that's the case we detect.

function addDrugTimer() {
	let useform = doc.getElementById( 'useform' );
	if ( !useform ||
	     !useform.elements.resid ||
	     useform.elements.resid.value != 51 )
		return;

	let usebtn = useform.elements.useres;
	if ( !usebtn || usebtn.dataset.pardusSweetener )
		return;

	// Don't add the event handler twice
	usebtn.dataset.pardusSweetener = true;

	let ukey = Universe.getServer ( doc ).substr( 0, 1 );
	usebtn.addEventListener( 'click', usedDrugs.bind(null, useform, ukey) );
	chrome.storage.sync.get(
		[ ukey + 'drugTimerLast', ukey + 'drugTimerClear' ],
		displayDrugTimer.bind(null, ukey, usebtn) );
}

function addStimTimer() {
	let useform = doc.getElementById( 'useform' );
	if ( !useform ||
	     !useform.elements.resid ||
	     !(useform.elements.resid.value == 29 ||
	       useform.elements.resid.value == 30 ||
	       useform.elements.resid.value == 31 ||
	       useform.elements.resid.value == 32 
	      )
	     )

		return;

	let usebtn = useform.elements.useres;
	if ( !usebtn || usebtn.dataset.pardusSweetener )
		return;

	// Don't add the event handler twice
	usebtn.dataset.pardusSweetener = true;

	let ukey = Universe.getServer ( doc ).substr( 0, 1 );
	usebtn.addEventListener( 'click', usedStims.bind(null, useform, ukey) );
	chrome.storage.sync.get(
		[ ukey + 'stimTimerLast', ukey + 'stimTimerClear' ],
		displayStimTimer.bind(null, ukey, usebtn) );
}

function displayDrugTimer ( ukey, usebtn, data ) {
	if ( !config[ 'clockD' ] )
		return;

	var timerDiv = doc.createElement('div');
	var diff;

	timerDiv.id = 'drugTimer';
	usebtn.parentNode.appendChild( timerDiv );
	timerDiv.appendChild ( doc.createElement( 'br' ) );


	var now = Math.floor( Date.now() / 1000 );
	var stimTime = chrome.storage.sync.get(
				[ ukey + 'stimTimerClear' ],
				getStimClearTime.bind( this, now, ukey )
			);
	function getStimClearTime( now, ukey, data ) {
			var t = Math.floor(
				data[ ukey + 'stimTimerClear' ]
					/ 1000 );
			if ( t > now ) {
			timerDiv.appendChild ( doc.createElement( 'br' ) );
				timerDiv.appendChild(
					doc.createTextNode('Stim free in:') );
			timerDiv.appendChild( doc.createElement('br') );
			diff = getTimeDiff(
				data[ ukey + 'stimTimerClear'], Date.now() );
			timerDiv.appendChild (
				doc.createTextNode(
					diff[ 'hr' ] + 'h' +
					diff[ 'min' ] + 'm' +
					diff[ 'sec' ] + 's' ) ) ;

			timerDiv.appendChild( doc.createElement('br') );
			} 
		}

	if (!data[ ukey + 'drugTimerClear'] ) {
		// No data, so make some nice comments
		timerDiv.appendChild(
			doc.createTextNode('No drugs used yet.') );
	}
	else {
		// We have data, display current addiction
		timerDiv.appendChild( doc.createTextNode('Drugs/stims used:') );
		timerDiv.appendChild( doc.createElement('br') );

		diff = getTimeDiff(
			Date.now(), data[ ukey + 'drugTimerLast'] );
		timerDiv.appendChild(
			doc.createTextNode(
				diff[ 'hr' ] + 'h' +
					diff[ 'min' ] + 'm' +
					diff[ 'sec' ] + 's ago' ) );
		timerDiv.appendChild( doc.createElement( 'br' ) );

		if (data[ ukey + 'drugTimerClear'] > Date.now() ) {
			timerDiv.appendChild(
				doc.createTextNode('Drug/stim free in:') );
			timerDiv.appendChild( doc.createElement('br') );
			diff = getTimeDiff(
				data[ ukey + 'drugTimerClear'], Date.now() );
			timerDiv.appendChild (
				doc.createTextNode(
					diff[ 'hr' ] + 'h' +
						diff[ 'min' ] + 'm' +
						diff[ 'sec' ] + 's' ) ) ;
			timerDiv.appendChild( doc.createElement('br') );
		}
		else {
			timerDiv.appendChild(
				document.createTextNode('You are undrugged.') );
		}
	}
}

function displayStimTimer ( ukey, usebtn, data ) {
	if ( !config[ 'clockStim' ] )
		return;

	var timerDiv = doc.createElement('div');
	var diff;

	timerDiv.id = 'stimTimer';
	usebtn.parentNode.appendChild( timerDiv );
	timerDiv.appendChild ( doc.createElement( 'br' ) );


	var now = Math.floor( Date.now() / 1000 );
	var drugTime = chrome.storage.sync.get(
				[ ukey + 'drugTimerClear' ],
				getDrugClearTime.bind( this, now, ukey )
			);
	function getDrugClearTime( now, ukey, data ) {
			var t = Math.floor(
				data[ ukey + 'drugTimerClear' ]
					/ 1000 );
			if ( t > now ) {
			timerDiv.appendChild ( doc.createElement( 'br' ) );
				timerDiv.appendChild(
					doc.createTextNode('Drug free in:') );
			timerDiv.appendChild( doc.createElement('br') );
			diff = getTimeDiff(
				data[ ukey + 'drugTimerClear'], Date.now() );
			timerDiv.appendChild (
				doc.createTextNode(
					diff[ 'hr' ] + 'h' +
					diff[ 'min' ] + 'm' +
					diff[ 'sec' ] + 's' ) ) ;
			} 
			
		}
	if (!data[ ukey + 'stimTimerClear'] ) {
		// No data, so make some nice comments
		timerDiv.appendChild(
			doc.createTextNode('No stims used yet.') );
	}
	else {
		// We have data, display current addiction
		timerDiv.appendChild( doc.createTextNode('Stims used:') );
		timerDiv.appendChild( doc.createElement('br') );

		diff = getTimeDiff(
			Date.now(), data[ ukey + 'stimTimerLast'] );
		timerDiv.appendChild(
			doc.createTextNode(
				diff[ 'hr' ] + 'h' +
					diff[ 'min' ] + 'm' +
					diff[ 'sec' ] + 's ago' ) );
		timerDiv.appendChild( doc.createElement( 'br' ) );

		if (data[ ukey + 'stimTimerClear'] > Date.now() ) {
			timerDiv.appendChild(
				doc.createTextNode('Stim free in:') );
			timerDiv.appendChild( doc.createElement('br') );
			diff = getTimeDiff(
				data[ ukey + 'stimTimerClear'], Date.now() );
			timerDiv.appendChild (
				doc.createTextNode(
					diff[ 'hr' ] + 'h' +
						diff[ 'min' ] + 'm' +
						diff[ 'sec' ] + 's' ) ) ;
		}
		else {
			timerDiv.appendChild(
				document.createTextNode('You are unstimmed.') );
		}
	}

}

//returns the amount of drugs effectively taken, reduces drug intake in ratio, which is the conservative method.
function compensateDoctor( amount, ukey, doctorType, extraConsumable) {
	var doctorFactor = 0;
	if (doctorType == "Primary") {
		doctorFactor = 2;
	} else if (doctorType == "Secondary") {
		doctorFactor = 4;
	}

	if (doctorFactor > 1) {
		var leftOverConsumables = (amount + extraConsumable) % doctorFactor; // the leftover amount of consumables to be stored for next time.
		amount -=  Math.floor( (amount + extraConsumable) * (1/doctorFactor) ) // negate this amount of consumables, the amount that is the "effective" amount taken and the reduction factor
		return [amount, leftOverConsumables];
	} else {
		return [amount, extraConsumable];
	}
}

function usedDrugs( useform, ukey ) {
	let amount = parseInt( useform.elements.amount.value );
	if ( amount > useform.childNodes[3].textContent.substring(1) )
		return;
	if (amount > 0) {
		chrome.storage.sync.get(
			[ukey + 'drugTimerLast', ukey + 'drugTimerClear', ukey + 'doctor', ukey + 'extraDrug'],
			usedDrugs2.bind(null, amount, ukey) );
	}
}

function usedDrugs2( amount, ukey, data ) {
	if (!data[ ukey + 'drugTimerClear'] ) {
		data = new Object();
		data[ ukey + 'drugTimerClear'] = 0;
		data[ ukey + 'extraDrug'] = 0;
	}
	var doctorCompensation = compensateDoctor(amount, ukey, data[ukey + 'doctor'], data[ukey + 'extraDrug']);
	amount = doctorCompensation[0];
	data[ ukey + 'extraDrug'] = doctorCompensation[1];
	var now = Date.now();
	if (data[ ukey + 'drugTimerClear'] > now )
		data[ ukey + 'drugTimerClear'] += amount * oneHour;
	else {
		var lastTick = new Date().setUTCHours(0,59,3,0); 
		lastTick += oneHour * Math.floor((now - lastTick) / oneHour);
		data[ ukey + 'drugTimerClear' ] = amount * oneHour + lastTick;
	}
	data[ ukey + 'drugTimerLast' ] = now;
	chrome.storage.sync.set ( data );
}


function usedStims( useform, ukey ) {
	let amount = parseInt( useform.elements.amount.value );
	if ( amount > useform.childNodes[3].textContent.substring(1) )
		return;
	if ( amount > 0 ) {

		//29 is the resid of green stims.
		if (useform.elements.resid.value == 29 )
			amount *= 2;

		chrome.storage.sync.get(
			[ ukey + 'stimTimerLast', ukey + 'stimTimerClear', ukey + 'doctor', ukey + 'extraStim'],
			usedStims2.bind(null, amount, ukey ) );
	}
}


function usedStims2( amount, ukey, data ) {
	if (!data[ ukey + 'stimTimerClear'] ) {
		data = new Object();
		data[ ukey + 'stimTimerClear'] = 0;
		data[ ukey + 'extraStim'] = 0;
	}
	var doctorCompensation = compensateDoctor(amount, ukey, data[ukey + 'doctor'], data[ukey + 'extraStim']);
	amount = doctorCompensation[0];
	data[ ukey + 'extraStim'] = doctorCompensation[1];

	var now = Date.now();
	if (data[ ukey + 'stimTimerClear'] > now)
		data[ ukey + 'stimTimerClear'] += amount * halfHour;
	else {
		var lastTick = new Date().setUTCHours(0,29,3,0); 
		lastTick += halfHour * Math.floor((now - lastTick) / halfHour);
		data[ ukey + 'stimTimerClear'] = amount * halfHour + lastTick;
		}
	data[ ukey + 'stimTimerLast' ] = now;
	chrome.storage.sync.set ( data );
}

function getTimeDiff ( time1, time2 ) {
	// Fucntion returns an object with keys 'day', 'hr', 'min', 'sec' which are the time differences between input 1 and 2.
	var diff = new Object()

	diff [ 'sec' ] = (Math.floor( time1 / 1000 ) - Math.floor( time2 / 1000 ) ) % 60 ;
	diff [ 'min' ] = Math.floor( ( ( Math.floor( time1 / 1000) - Math.floor( time2 / 1000 ) ) % ( 60 * 60 ) ) / 60 );
	diff [ 'hr' ] = Math.floor( ( ( Math.floor( time1 / 1000) - Math.floor( time2 / 1000 ) ) % ( 60 * 60 * 24 ) ) / 3600 );
	diff [ 'day' ] = Math.floor( ( ( Math.floor( time1 / 1000) - Math.floor( time2 / 1000 ) ) / ( 60 * 60 * 24 ) ) );

	return diff
}

//planned route highlighter
function updateRoutePlanner( data ) {
    if ( highlightedRPTiles ) {
        // Clear up first
        for( let i=0; i < highlightedRPTiles.length; i++ ) {
            highlightedRPTiles[i].setAttribute( 'class', 
                highlightedRPTiles[i].getAttribute( 'class' ).replace(
                'sweetener-routeplanner', '') );
        }
    }
    highlightedRPTiles = [];
        
	let ukey = Universe.getServer ( doc ).substr( 0, 1 );
	let idList = data[ ukey + 'storedPath' ];

	if ( !idList || idList.length === 0 )
		return;

	navtable = doc.getElementById( 'navareatransition' );
	if ( !navtable )
		navtable = doc.getElementById( 'navarea' );
	if ( !navtable )
		return;

	let a = Array.prototype.slice.call( navtable.getElementsByTagName( 'a' ) );

	a.sort( function compare(a ,b) {
		if ( a.getAttribute( 'onclick' ) === null )
			return b
		if ( b.getAttribute( 'onclick' ) === null )
			return a
		return parseInt( a.getAttribute( 'onclick' ).split(/[()]/g)[1] ) - parseInt( b.getAttribute( 'onclick' ).split(/[()]/g)[1] );
		});

	idList.sort();
	for ( var j = 0; j < a.length; j++ ) {
		if ( a[ j ].getAttribute( 'onclick' ) !== null && idList.includes( parseInt( a[ j ].getAttribute( 'onclick' ).split(/[()]/g)[1] ) ) ) {
            a[ j ].parentNode.setAttribute( 'class' , a[ j ].parentNode.getAttribute( 'class' ) + ' sweetener-routeplanner' );
			highlightedRPTiles.push( a[ j ].parentNode );
		}
	}
}

function highlightVisited( data ) {
	let ukey = Universe.getServer ( doc ).substr( 0, 1 );

    // initial setup
    if ( !data[ ukey + 'visit' ] ) {
        data[ ukey + 'visit' ] = {};
    }
    if( !config.displayVisitedDecay ) {
        decayTime = 180000; //3 minutes
    } else {
        var decayTime = 1000*config.displayVisitedDecay;
    }
    
    //maybe have the visited tiles be sorted by age rather than an object
    //makes for faster removing of old tiles, better performance
    /*(data[ ukey + 'visit' ].push([ [ userloc ],Date.now() ]);
    for (var i = 0; i < data[ ukey + 'visit' ].length; i++) {
        if (Date.now() - data[ ukey + 'visit' ][i][1] >= decayTime) {
            data[ ukey + 'visit'].splice(0, i);
            break;
        }
    }*/

    // directly save that we are on this tile;
    data[ ukey + 'visit' ][ userloc ] = Date.now();

    //clear out old tiles. kind of slow due to iterating over every tile every time
    for (var location in data[ ukey + 'visit' ]) {
        if (Date.now() - data[ ukey + 'visit' ][location] >= decayTime) {
           delete data[ ukey + 'visit'][location];
        }
    }
    chrome.storage.local.set( data );

    // highlight the tiles according to the time visited
    var locs = Object.keys( data[ ukey + 'visit' ] );
    var navtable = doc.getElementById( 'navareatransition' );
	if ( !navtable )
		navtable = doc.getElementById( 'navarea' );
	if ( !navtable )
		return;    
    
    var a = navtable.getElementsByTagName( 'a' );
    //todo: add a special case soemtime for user's location which may not always have an onclick()
    //iterates over all onclick tiles and checks if the tile is in the recently visited list.
    //adds colouring as appropriate
    for ( var i=0; i< a.length; i++ ) {
        if (!a[i].getAttribute('onclick'))
            continue;
        let loc = a[i].getAttribute('onclick').split(/\(|\)/g)[1];
        if ( locs.includes( loc ) ) {
        	let decayProportion = Math.round(10 * (Date.now() - data[ ukey + 'visit' ][ loc ]) / decayTime) / 10 ;
            let red = 0;
            let green = 255;
            let opacity = Math.max( 0.5, 1.1 - decayProportion ); // don't go too transparent
            let fade = Math.min( 220, Math.round( 255 * decayProportion )); // don't go full colour
            red += fade;
            green -= fade;

            setClass( a[i].parentNode );
            setClass( a[i].firstChild );
            
            function setClass( node ) {
                let cl = node.getAttribute( 'class' );
                node.setAttribute( 'class', cl + ' sweetener-visited' );
                    node.style.backgroundColor = 'rgba( '+red+', '+green+', 0, ' +opacity+ ' )'; 
            }
        }
    }
}

// mission display
function showMissions( data ) {
	let ukey = Universe.getServer ( doc ).substr( 0, 1 );

	if ( !data[ ukey + 'mlist' ] ) {
		// we got nothing.
		return;
	}
	if ( !( data[ ukey + 'mlist' ].length > 0 ) ) {
		// we got no missions.
		return;
	}
	
	var list = data[ ukey + 'mlist' ];
	var getList = [];
	for( var i = 0; i < list.length; i++ ) {
		getList.push( ukey + 'm' + list[ i ] )
	}
	
	chrome.storage.local.get( getList, displayMissions.bind( null, list ) );

	// clean wh mission 
	if( document.getElementById( 'aCmdCleanWh' ) ) {
		document.getElementById( 'aCmdCleanWh' ).addEventListener( 'click' , Mission.removeMission.bind( null, data, userloc ) );
	}
	
	function displayMissions( list, data ) {
		// DOM stuff below.
		
		var t = document.createElement( 'table' );
		t.width = 210;
		t.setAttribute( 'cellpadding', 0 );
		t.setAttribute( 'cellspacing', 0 );
		t.border = 0;
		t.id = 'missionDisplayTable';
		
		var tr = t.appendChild( document.getElementById( 'cargo' ).firstChild.lastChild.cloneNode( true ) );
		tr.firstChild.firstChild.setAttribute( 'style', 'transform: rotateX(0.5turn);' );
		
		tr = t.appendChild( document.createElement( 'tr' ) );
		var td = tr.appendChild( document.createElement( 'td' ) );
		td.style = "background-image:url('//static.pardus.at/img/stdhq/panel.png');background-repeat:repeat-y;text-align:left;";
		var div = td.appendChild( document.createElement( 'div' ) );
		div.style = "margin:0 18px;";
		t.appendChild( document.getElementById( 'cargo' ).firstChild.lastChild.cloneNode( true ) );
		
		var tInside = div.appendChild( document.createElement( 'table' ) );
		tInside.width = '100%';
		
		while ( document.getElementById( 'sweetener-mission' ) ) {
			document.removeChild( document.getElementById( 'sweetener-mission' ) ); 
		}

		var _navTable;

		for( var i = 0; i < list.length; i++ ) {
			var mission = data[ ukey + 'm' + list[ i ] ];
			tr = tInside.appendChild ( document.createElement( 'tr' ) );
						
			td = tr.appendChild( document.createElement( 'td' ) );
			var img = td.appendChild( document.createElement( 'img' ) );
			img.src = mission.image;
			img.height = 16;
			td = tr.appendChild( document.createElement( 'td' ) );
			if ( mission.locId > 0 ) {
				td.textContent = mission.sector + " [" + mission.coords.x + ',' + mission.coords.y + ']' ;
			} else {
				td.textContent = mission.amountDone + '/' + mission.amount;
			}
			td = tr.appendChild( document.createElement( 'td' ) );
			td.textContent = mission.reward;
			td = tr.appendChild( document.createElement( 'td' ) );
			td.textContent = mission.total;
			/*td = tr.appendChild( document.createElement( 'td' ) );
			td.textContent = mission.acceptTime + mission.;*/

			//adds a little red dot to all tiles that have a mission going to them
			//might be a bit slow for people who have lots of missions?
			if (mission.locId) {
				if ( Sector.getIdFromLocation( userloc ) === Sector.getIdFromLocation( mission.locId ) ) {
					
                    if ( minimap ) {
                        // display of red mission markers
                        let coords = Sector.getCoords( Sector.getIdFromLocation( mission.locId ), mission.locId );
                        minimap.markTile( minimap.get2DContext(), coords.x, coords.y ,'#ff0000');
					}
                    
                    if ( !_navTable ) {
						_navTable = document.getElementById( 'navareatransition' );
						if (!_navTable) {
							_navTable = document.getElementById( 'navarea' );
						}
					}
					
					var a;
					a = document.evaluate( "../table[contains(@id, " + _navTable.id + ")]//tr/td//a[contains(@onclick, '(" + mission.locId + ")')]" ,
					   _navTable, null, XPathResult.ANY_UNORDERED_NODE_TYPE,
					   null ).singleNodeValue;
					//catches for transport targets, only applies if the mission target is
					//where the pilot is and
					// there's a standard command (i.e., starbase/planet -- or building, though those should be
					//irrelevant here)
					if (a == null && userloc == mission.locId) {
						a = document.getElementById("stdCommand");
					}

					if ( a ) {
						var reddiv = document.createElement( 'div' );
						reddiv.className = 'sweetener-mission';
						a.appendChild( reddiv );
					}
				}
			}
		}
		tr = tInside.appendChild( document.createElement( 'tr' ) );
		td = tr.appendChild(  document.createElement( 'td' ) );
		td.setAttribute( 'colspan', 4 );
		td.align = 'center';
		var btn = td.appendChild( document.createElement( 'button' ) );
		btn.textContent = 'clear';
		btn.addEventListener( 'click', Mission.clearMissionStorage.bind( 
			null, function() { 
				document.getElementById( 'missionDisplayTable' ).remove(); 
				} ,
				list ) );
		
		if ( !document.getElementById( 'missionDisplayTable' ) ) {
			document.getElementById( 'cargo' ).parentNode.insertBefore( t, document.getElementById( 'cargo' ) );
		}
		function clearMissionStorage( list, data ) {
			for( var i = 0; i < list.length; i++ ) {
				chrome.storage.local.remove( ukey + 'm' + list[ i ] );
			}
			chrome.storage.local.remove( ukey + 'mlist' );
		}
	}
}

start();

})( top, document, ShipLinks, SectorMap, Sector );
