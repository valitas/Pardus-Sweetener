// This object implements graphics we need to display maps and
// minimaps.
//
// No, we don't use HTML tables for those.  That would be much easier,
// and in fact we tried it first, but problem is: there are big
// sectors in Pardus.  The Pardus Core itself is nearly 100x100 tiles
// - which means that, rendered as a table, it requires us to insert
// 10,000 nodes in the DOM tree.  Now Chrome is fast, but that's just
// evil, it would bring any browser down to its knees.  And it does.
// And the last thing you need is to spend half your CPU drawing a
// minimap, when you need to be navving or whatever.
//
// And so, since it's 2013 and that, we use the HTML5 Canvas.

'use strict';

function SectorMap() {}
SectorMap.prototype = {

	configure: function( sector, maxPixelSize ) {
		this.sector = sector;

		var cols = sector.width, rows = sector.height, tiles = sector.tiles;

		if ( tiles.length != cols*rows ) {
			throw new Error( "Tile data and map dimensions do not match" );
		}

		if ( cols > rows ) {
			// This is a wide map. We use cols to determine
			// size. Height will be less than required.
			this.computeGrid( cols, maxPixelSize );
		}
		else {
			// A tall map, use rows instead.
			this.computeGrid( rows, maxPixelSize );
		}

		if ( this.grid ) {
			this.width = cols * ( this.tileSize + 1 ) - 1;
			this.height = rows * ( this.tileSize + 1 ) - 1;
		}
		else {
			this.width = cols * this.tileSize;
			this.height = rows * this.tileSize;
		}
		this.cols = cols;
		this.rows = rows;
		this.configured = true;
		
		//mouseover support
		this.mouseX = -1;
		this.mouseY = -1;
		this.shipX = -1;
		this.shipY = -1;
		this.mouselock = false;

		if ( this.canvas ) {
			this.initCanvas();
		}
		
		var universe = Universe.getServer( document );
		chrome.storage.local.get( [ universe + 'advSkills' ], setVisc.bind( this, universe ) );
		function setVisc( universe, data ) {
			var VISC = { 
				'f': 11, // fuel -> space
				'g': 16, // nebula gas
				'v': 18,
				'e': 20,
				'o': 25, // ore -> asteriods
				'm': 36  // Exotic Matter
			};
			
			// Parsing Navigation adv. skill.
			if ( data[ universe + 'advSkills' ] ) { // checking if it's set first 
				if ( data[ universe + 'advSkills' ][41] > 0 ) {
					VISC[ 'o' ] -= 1;
				}
				if ( data[ universe + 'advSkills' ][41] > 1 ) {
					VISC[ 'g' ] -= 1;
				}
				if ( data[ universe + 'advSkills' ][41] > 2 ) {
					VISC[ 'e' ] -= 1;
				}
				this.Navigation = data[ universe + 'advSkills' ][41]; // saving the number for our speed calculation later
			} else {
				this.Navigation = 0;
			}
			this.VISC = VISC;
		}
		
	},

	setCanvas: function( canvas, div ) {
		this.canvas = canvas;
		this.distanceDiv = div;
		
		if ( this.configured ) {
			this.initCanvas();
		}
	},
	
	//attach events for mouseover path calculation
	enablePathfinding: function(travelCosts) {
		this.travelCosts = travelCosts;
		this.attachMouseEvents(this.canvas);
		this.distanceDiv.style.display = "block";
		this.savedPath = [];
	},

	// Just gets the 2D context of the canvas. You'll want this to
	// clear the map and mark tiles.
	get2DContext: function() {
		return this.canvas.getContext( '2d' );
	},

	// This "clears" the canvas, restoring the sector map. So this
	// effectively draws the sector map. The idea being: you'll want
	// to clear, then overlay dynamic stuff on the "background" map.
	clear: function( ctx ) {
		ctx.drawImage( this.bgCanvas, 0, 0 );
		this.distanceDiv.innerText = "";
		if (this.mouselock) {
			this.drawSavedPath(ctx);
		}
	},

	// This draws a marker on a tile.
	markTile: function( ctx, col, row, style ) {
		var grid = this.grid, size = this.tileSize,
			gstep = grid ? size+1 : size, x = col*gstep, y = row*gstep;

		// If the tiles are large enough, make the mark smaller so
		// the background shows a bit, let you know what type of tile
		// the marker is on.
		if ( size > 10 ) {
			x += 2;
			y += 2;
			size -= 4;
		}
		else if ( size > 5 ) {
			x += 1;
			y += 1;
			size -= 2;
		}

		ctx.fillStyle = style;
		ctx.fillRect( x, y, size, size );
	},
	
	// This draws the saved path, for if we navigate with the minimap locked
	drawSavedPath: function ( ctx ) {
		this.savedPath.forEach(function (e) {
			this.markTile(ctx, e[0], e[1], "#080");
		}.bind(this));
	},

	// This sets the current ship coords, for navigation
	setShipCoords: function( col, row ) {
		this.shipX = col;
		this.shipY = row;
	},
	
	// This marks the current ship tile
	markShipTile: function( ctx ) {
		this.markTile( ctx, this.shipX, this.shipY, '#0f0' );
	},

	// Convert pixel x,y coordinates on the canvas to map row,col.
	// For this purpose, if the map has a grid, points on the grid are
	// assumed to belong on the tile to the right/bottom. 
	xyToColRow: function( x, y ) {
		var gstep = this.grid ? this.tileSize+1 : this.tileSize;
		
		x = Math.floor( x / gstep );
		y = Math.floor( y / gstep );
		
		if (y < 0 || y >= this.sector.height || x < 0 || x >= this.sector.width) return null;
		return { x: x, y: y };
	},


	// Below is "private" stuff which you shouldn't need to use from
	// outside this object.

	COLOUR: {
		b: '#158',	// hard energy
		e: '#0e2944', // energy
		f: '#000',	// fuel
		g: '#a00',	// gas
		m: '#0c0',	// exotic matter
		o: '#666',	// ore
		v: '#ee0'	 // viral
	},
	
	initCanvas: function() {
		this.canvas.width = this.width;
		this.canvas.height = this.height;
		// We actually paint most of the map here
		this.setupBgCanvas();
	},

	setupBgCanvas: function() {
		var doc = this.canvas.ownerDocument;
		if ( !doc ) {
			// We can't draw anyway
			return;
		}

		var ctx, x, y, px0, row, col,
			rows = this.rows, cols = this.cols, c,
			sector = this.sector, data = sector.tiles,
			width = this.width, height = this.height,
			size = this.tileSize, grid = this.grid,
			colour = this.COLOUR, canvas = doc.createElement( 'canvas' );

		canvas.width = width;
		canvas.height = height;
		this.bgCanvas = canvas;

		ctx = canvas.getContext( '2d' );

		if ( grid ) {
			// When the grid is enabled, we paint tiles of side
			// size+1. The extra pixel is really part of the grid
			// line, but painting in the tile colour first makes the
			// map prettier.
			size += 1;

			// Since there is one less grid line than there are rows
			// (or columns), one of these "tile plus grid pixel" areas
			// has to be 1px smaller.  We feel it looks better if this
			// is the first row and the first column.  So we paint 1px
			// up and to the left, and let the canvas clip it.
			px0 = -1;
		}
		else {
			px0 = 0;
		}

		for ( row = 0, y = px0; row < rows; row++, y += size ) {
			for ( col = 0, x = px0; col < cols; col++, x += size ) {
				c = data[ row*cols + col ];
				ctx.fillStyle = colour[ c ];
				ctx.fillRect( x, y, size, size );
			}
		}

		if ( grid ) {
			ctx.fillStyle = 'rgba(128, 128, 128, 0.25)';
			for ( y = size-1; y < height; y += size ) {
				ctx.fillRect( 0, y, width, 1 );
			}
			for ( x = size-1; x < width; x += size ) {
				ctx.fillRect( x, 0, 1, height );
			}
		}

		// Paint beacons
		for ( var beacon_name in sector.beacons ) {
			var beacon = sector.beacons[ beacon_name ], style;
			switch ( beacon.type ){
			case 'wh':
				style = '#c6f';
				break;
			default:
				style = '#fff';
			}
			this.markTile( ctx, beacon.x, beacon.y, style );
		}
	},
	
	//attach the mouse events for path calculation
	attachMouseEvents: function (canvas) {
		canvas.addEventListener('click', function (e) {
			//lock if unlocked, unlock and clear if locked
			var ukey = Universe.getServer ( document ).substr( 0, 1 );
			if (this.mouselock) {
				this.clear(this.get2DContext());
				this.markShipTile(this.get2DContext());
				chrome.storage.local.remove( [ ukey + 'savedPath' ] );
			} else {
				let save = {};
				save[ ukey + 'savedPath' ] = this.savedPath;
				chrome.storage.local.set( save );
			}
			this.mouselock = !this.mouselock;
		}.bind(this));
		
		['mousemove', 'click'].forEach(function (evt) {
			canvas.addEventListener(evt, function (e) {
				//determine client location, and calculate path to it if needed
				if (this.mouselock) return;
				
				var rect = canvas.getBoundingClientRect(), 
					scaleX = canvas.width / rect.width, 
					scaleY = canvas.height / rect.height;
				var loc = this.xyToColRow((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
				if (!loc) return;
				
				if (loc.x != this.mouseX || loc.y != this.mouseY) {
					this.drawPath(loc);
	
					//if there's a waypoint, why not draw it
					for (var n in this.sector.beacons) {
						var e = this.sector.beacons[n];
						if (e.x == loc.x && e.y == loc.y)
							this.distanceDiv.innerHTML += "<br>" + (e.type == "wh" ? "Wormhole to " : "") + n;
					}
				}
			}.bind(this));
		}.bind(this));
		
		canvas.addEventListener('mouseout', function (e) {
			//clear the map when mouse leaves it
			if (this.mouselock) return;
			
			this.clear(this.get2DContext());
			this.markShipTile(this.get2DContext());
			this.mouseX = -1;
			this.mouseY = -1;
		}.bind(this));
	},
	
	//draw the path from the current ship location to the mouse location, and
	//calculate AP costs for it
	drawPath: function (loc) {
		this.clear(this.get2DContext());
		this.markShipTile(this.get2DContext());
		
		//these fields must match those in options.js and map.js
		var fields = ["Space", "Nebula", "Virus", "Energy", "Asteroid", "Exotic"];
		var travelCosts = this.travelCosts;

		var speed = getSpeed.call( this );

		var tc = {
			b: -1,
			'f': this.VISC[ 'f' ] - speed, // fuel -> space
			'g': this.VISC[ 'g' ] - speed, // nebula gas
			'v': this.VISC[ 'v' ] - speed,
			'e': this.VISC[ 'e' ] - speed,
			'o': this.VISC[ 'o' ] - speed, // ore -> asteriods
			'm': this.VISC[ 'm' ] - speed  // Exotic Matter
		};
		
		//here, we do a BFS across the entire sector with respect to the cost, stopping when either the state is the same for 100 AP's (unreachable) or we've reached the location
		var i,j;
		var bfsState = [];
		var costFromTile = []; //quickly lookup the cost of travelling from any tile, without string fluffery
		
		for (i=0;i<this.sector.height;i++) {
			bfsState.push([]);
			costFromTile.push([]);
			for (j=0;j<this.sector.width;j++) {
				bfsState[i].push([-1, -1, -1]); //[previous X, previous Y, distance]
				costFromTile[i].push(~~tc[this.sector.tiles.charAt(i * this.sector.width + j)]);
			}
		}
		bfsState[this.shipY][this.shipX] = [0, this.shipY, this.shipX]; //mark current location as zero distance
		
		var apsSpent = 0;
		//if current tile is unreachable, then lol
		if (costFromTile[loc.y][loc.x] != -1) {
			var unreachableCounter = 0; //reset on map state change, incremented on 1AP spent, marked unreachable when it reaches 100
			while (unreachableCounter < 100) {
				//copy bfsState
				var nextBfsState = [];
				for (i=0;i<this.sector.height;i++) {
					nextBfsState.push([]);
					for (j=0;j<this.sector.width;j++) nextBfsState[i].push(bfsState[i][j].slice());
				}
				
				for (i=0;i<this.sector.height;i++) for (j=0;j<this.sector.width;j++) {
					if (bfsState[i][j][0] == -1) continue; //not visited yet
					
					var processPath = function (curX, curY, nextX, nextY, isDiagonal) { //isDiagonal is used to favor non-diagonal movement when costs are equal, because humans click those easier
						if (nextX < 0 || nextX >= this.sector.height || nextY < 0 || nextY >= this.sector.width) return;
						
						var cost = bfsState[curX][curY][0] + costFromTile[curX][curY];
						if (costFromTile[nextX][nextY] == -1) return; //the way is blocked, cannot go
						if (cost > apsSpent) return; //too much cost currently
						
						if (nextBfsState[nextX][nextY][0] == -1 || nextBfsState[nextX][nextY][0] > cost || (nextBfsState[nextX][nextY][0] == cost && !isDiagonal)) {
							nextBfsState[nextX][nextY] = [cost, curX, curY];
							if (nextBfsState[nextX][nextY].join(",") != bfsState[nextX][nextY].join(","))
								unreachableCounter = 0;
						}
					}.bind(this);
					
					processPath(i, j, i-1, j-1, true);
					processPath(i, j, i-1, j  , false);
					processPath(i, j, i-1, j+1, true);
					processPath(i, j, i  , j-1, false);
					processPath(i, j, i  , j+1, false);
					processPath(i, j, i+1, j-1, true);
					processPath(i, j, i+1, j  , false);
					processPath(i, j, i+1, j+1, true);
				}
				
				bfsState = nextBfsState;
				
				/* //uncomment to debug
				var d = "";
				for (i=0;i<this.sector.height;i++) {
					for (j=0;j<this.sector.width;j++) {
						d += bfsState[i][j][0] + "\t";
					}
					d += "\n"
				}
				console.log(d);
				//*/
				
				//break if we've found a path
				if (bfsState[loc.y][loc.x][0] != -1) break;
				
				unreachableCounter++;
				apsSpent++;
				
				if (apsSpent >= 10000) break; //sanity check
			}
		}
		
		var endState = bfsState[loc.y][loc.x];
		if (endState[0] == -1) {
			apsSpent = "&infin;";
			this.savedPath = [[loc.x, loc.y]];
		} else {
			//if we have found a path, we know it's min length because all the previous iterations did not end here.
			//now we iterate backwards until we get to the ship
			i = loc.y;
			j = loc.x;
			var path = [];
			var sanityCheck = 0;
			while (!(i == this.shipY && j == this.shipX) && sanityCheck++ < 10000) {
				path.push([j, i]);
				var state = bfsState[i][j];
				i = state[1];
				j = state[2];
			}
			path.push([this.shipX, this.shipY]);
			this.savedPath = path;
		}
		this.drawSavedPath(this.get2DContext());
		this.markShipTile(this.get2DContext());
		this.distanceDiv.innerHTML = "Distance to " + this.sector.sector + " [" + loc.x + ", " + loc.y + "]: " + apsSpent + " APs"; //innerHTML to accomodate infinity symbol
		
		// I put the function at the end to keep clutter down. Currently only used in drawpath.
		function getSpeed() {
			// function calculates speed (as in the Pardus Manual), allowing for boost, stims, etc. XXX still needs to be tested with legendary.
			
			let currentTileType = this.sector.tiles[ this.shipX + this.sector.width * this.shipY ];
			let moveField = document.getElementById('tdStatusMove').childNodes;
			let speed = 0;
			if ( moveField.length > 1 ) { //something modifies our speed 
				speed -= parseInt( moveField[1].childNodes[0].textContent );
			}
			speed -= parseInt( moveField[0].textContent );
			speed += this.VISC[ currentTileType ];
			
			if ( ( this.Navigation == 1 && currentTileType == 'o' )
				|| ( this.Navigation == 2 && currentTileType == 'g' )
			    || ( this.Navigation == 3 && currentTileType == 'e' ) ) {
					speed += 1;
				}
			return speed;
		}
	},

	// Compute the tile size and whether we'll draw grid lines.
	//
	// The aim is to fit the given number of tiles in the given number
	// of pixels.  Our tiles are square, so we only really compute
	// this for one dimension.
	//
	// Our tiles are of uniform size. This means we don't really
	// output a map of the requested dimensions, but the largest size
	// we can create, while keeping our cells square and uniform size,
	// that is still less than or equal than the specified pixel size.
	//
	// We want thin 1px grid lines if the tiles are big enough. When
	// the map is so large that the tiles become tiny, we don't want
	// to waste pixels in those.
	computeGrid: function( tiles, maxPixels ) {
		if ( !( tiles > 0 && maxPixels > 0 ) ) {
			throw new Error( 'Invalid parameters' );
		}

		if ( tiles > maxPixels ) {
			throw new Error( 'Cannot draw ' + tiles + ' tiles in ' +
							 maxPixels + ' pixels');
		}

		var grid, size = Math.floor( (maxPixels + 1) / tiles );

		// A tile would be size-1 pixels per side, the extra pixel is
		// for the grid. All our tiles fit in the allowed pixels
		// because there is one less grid line than there are tiles.
		if ( size < 4 ) {
			// This means our tiles would be 2 pixels per side. We
			// don't want grid lines in this case.
			size = Math.floor( maxPixels / tiles );
			grid = false;
		}
		else {
			size -= 1;
			grid = true;
		}

		this.tileSize = size;
		this.grid = grid;
	}
};
