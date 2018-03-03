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

		if ( this.canvas ) {
			this.initCanvas();
		}
		
		this.canvas.addEventListener('mousemove', logCoords.bind( this, this.canvas.getBoundingClientRect() ) );
		function logCoords( boundingRect, event ) {
			let x = event.screenX - boundingRect.left, y = event.clientY - boundingRect.top ;
			let row = Math.floor( y / ( this.tileSize + 1 ) ) ;
			let col = Math.floor( x / ( this.tileSize + 1 ) );
			this.clear( this.get2DContext() );
			this.markTile( this.get2DContext(), col, row, '#ccc' );
		}
	},

	setCanvas: function( canvas ) {
		this.canvas = canvas;
		if ( this.configured ) {
			this.initCanvas();
		}
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

	// Convert pixel x,y coordinates on the canvas to map row,col.
	// For this purpose, if the map has a grid, points on the grid are
	// assumed to belong on the tile to the right/bottom. If result is
	// ommitted, a new object is created to return the result.
	xyToColRow: function( x, y, result ) {
		if ( !result ) {
			result = {};
		}
		result.col = Math.floor( x / this.size );
	},


	// Below is "private" stuff which you shouldn't need to use from
	// outside this object.

	COLOUR: {
		b: '#158',    // hard energy
		e: '#0e2944', // energy
		f: '#000',    // fuel
		g: '#a00',    // gas
		m: '#0c0',    // exotic matter
		o: '#666',    // ore
		v: '#0f0'     // viral
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

		// We don't need this any more, release the reference
		delete this.sector;
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
