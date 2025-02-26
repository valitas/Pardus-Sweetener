// This object implements graphics we need to display maps and minimaps.
//
// No, we don't use HTML tables for those. That would be much easier, and in
// fact we tried it first, but problem is: there are big sectors in Pardus. The
// Pardus Core itself is nearly 100x100 tiles - which means that, rendered as a
// table, it requires us to insert 10,000 nodes in the DOM tree. Now Chrome is
// fast, but that's just evil, it would bring any browser down to its knees. And
// it does. And the last thing you need is to spend half your CPU drawing a
// minimap, when you need to be navving or whatever.
//
// And so, since it's 2013 and that, we use the HTML5 Canvas.

class SectorMap {
  #canvas;
  #bgCanvas;
  #distanceDiv;
  #sector;
  #ukey;
  #cols;
  #rows;
  #configured = false;
  #navigation = 0;
  #visc;

  // dimensions in pixels
  #tileSize;
  #width;
  #height;

  // Whether to draw a grid. This is false if the map is too small to have a
  // grid.
  #grid;

  #mouseX = -1;
  #mouseY = -1;
  #shipX = -1;
  #shipY = -1;
  #mouselock = false;

  // The path displayed ephemerally on the minimap while you hover the pointer
  // over it.
  #savedPath;

  // The path "fixed" by clicking the mouse. This is stored in chrome.storage,
  // and highlighted on the nav area, too.
  #storedPath;

  // Wait for completion to be sure the minimap is configured
  async configure(sector, maxPixelSize) {
    this.#sector = sector;
    this.#ukey = Universe.getServer(document).substr(0, 1);
    this.#savedPath = [];
    this.#storedPath = [];

    const cols = sector.width,
      rows = sector.height,
      tiles = sector.tiles;

    if (tiles.length !== cols * rows) {
      throw new Error("Tile data and map dimensions do not match");
    }

    if (cols > rows) {
      // This is a wide map. We use cols to determine
      // size. Height will be less than required.
      this.#computeGrid(cols, maxPixelSize);
    } else {
      // A tall map, use rows instead.
      this.#computeGrid(rows, maxPixelSize);
    }

    if (this.#grid) {
      this.#width = cols * (this.#tileSize + 1) - 1;
      this.#height = rows * (this.#tileSize + 1) - 1;
    } else {
      this.#width = cols * this.#tileSize;
      this.#height = rows * this.#tileSize;
    }
    this.#cols = cols;
    this.#rows = rows;
    this.#configured = true;

    if (this.#canvas) {
      this.#initCanvas();
    }

    const universe = Universe.getServer(document);
    const storedPathKey = `${this.#ukey}storedPath`;
    const advSkillsKey = `${universe}advSkills`;

    // get configuration
    const { [storedPathKey]: storedPath, [advSkillsKey]: advSkills } =
      await chrome.storage.local.get([storedPathKey, advSkillsKey]);

    // restore the path to highlight, if any
    if (storedPath) {
      const sid = Sector.getId(this.#sector.sector);
      for (const tid of storedPath) {
        const { x: x, y: y } = Sector.getCoords(sid, tid);
        this.#storedPath.push([x, y]);
      }
    }
    this.#drawSavedPath(this.get2DContext(), this.#storedPath);

    // parse Navigation adv. skill and set movement costs
    const visc = {
      f: 11, // space
      g: 16, // nebula
      v: 18, // viral cloud
      e: 20, // energy
      o: 25, // asteriods
      m: 36, // ematter
    };

    if (advSkills) {
      this.#navigation = advSkills[41];
      // checking if it's set first
      if (this.#navigation > 0) {
        visc["o"] -= 1;
      }
      if (this.#navigation > 1) {
        visc["g"] -= 1;
      }
      if (this.#navigation > 2) {
        visc["e"] -= 1;
      }
    } else {
      this.#navigation = 0;
    }
    this.#visc = visc;
    //console.debug("navigation %d visc %o", this.#navigation, visc);
  }

  setCanvas(canvas, div) {
    this.#canvas = canvas;
    this.#distanceDiv = div;

    if (this.#configured) {
      this.initCanvas();
    }
  }

  //attach events for mouseover path calculation
  enablePathfinding() {
    this.#attachMouseEvents(this.#canvas);
    this.#distanceDiv.style.display = "block";
  }

  // This sets the current ship coords, for navigation
  setShipCoords(col, row) {
    this.#shipX = col;
    this.#shipY = row;
  }

  // This marks the current ship tile
  markShipTile(ctx) {
    this.markTile(ctx, this.#shipX, this.#shipY, "#0f0");
  }

  // Just gets the 2D context of the canvas. You'll want this to
  // clear the map and mark tiles.
  get2DContext() {
    return this.#canvas.getContext("2d");
  }

  // This "clears" the canvas, restoring the sector map. So this effectively
  // draws the sector map. The idea being: you'll want to clear, then overlay
  // dynamic stuff on the "background" map.
  clear(ctx) {
    ctx.drawImage(this.#bgCanvas, 0, 0);
    // XXX remove this bullshit!!!
    this.#distanceDiv.innerHTML = "&nbsp;<br>&nbsp;";
    this.#drawSavedPath(ctx, this.#storedPath);
  }

  // This draws a marker on a tile.
  markTile(ctx, col, row, style) {
    var grid = this.#grid,
      size = this.#tileSize,
      gstep = grid ? size + 1 : size,
      x = col * gstep,
      y = row * gstep;

    // If the tiles are large enough, make the mark smaller so
    // the background shows a bit, let you know what type of tile
    // the marker is on.
    if (size > 10) {
      x += 2;
      y += 2;
      size -= 4;
    } else if (size > 5) {
      x += 1;
      y += 1;
      size -= 2;
    }

    ctx.fillStyle = style;
    ctx.fillRect(x, y, size, size);
  }

  #drawSavedPath(ctx, path) {
    let style;

    if (path) {
      style = "#880";
    } else {
      path = this.#savedPath;
      style = "#080";
    }

    for (const [x, y] of path) {
      this.markTile(ctx, x, y, style);
    }
  }

  // Convert pixel x,y coordinates on the canvas to map row,col.
  //
  // For this purpose, if the map has a grid, points on the grid are assumed to
  // belong on the tile to the right/bottom.
  xyToColRow(x, y) {
    var gstep = this.#grid ? this.#tileSize + 1 : this.#tileSize;

    x = Math.floor(x / gstep);
    y = Math.floor(y / gstep);

    if (y < 0 || y >= this.#sector.height || x < 0 || x >= this.#sector.width)
      return null;
    return { x: x, y: y };
  }

  // Below is private stuff only used within this object.

  static #COLOUR = {
    b: "#158", // hard energy
    e: "#0e2944", // energy
    f: "#000", // fuel
    g: "#a00", // gas
    m: "#0c0", // exotic matter
    o: "#666", // ore
    v: "#ee0", // viral
  };

  #initCanvas() {
    this.#canvas.width = this.#width;
    this.#canvas.height = this.#height;
    // We actually paint most of the map here
    this.#setupBgCanvas();
  }

  #setupBgCanvas() {
    var doc = this.#canvas.ownerDocument;
    if (!doc) {
      // We can't draw anyway
      return;
    }

    var ctx,
      x,
      y,
      px0,
      row,
      col,
      rows = this.#rows,
      cols = this.#cols,
      c,
      sector = this.#sector,
      data = sector.tiles,
      width = this.#width,
      height = this.#height,
      size = this.#tileSize,
      grid = this.#grid,
      colour = SectorMap.#COLOUR,
      canvas = doc.createElement("canvas");

    canvas.width = width;
    canvas.height = height;
    this.#bgCanvas = canvas;

    ctx = canvas.getContext("2d");

    if (grid) {
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
    } else {
      px0 = 0;
    }

    for (row = 0, y = px0; row < rows; row++, y += size) {
      for (col = 0, x = px0; col < cols; col++, x += size) {
        c = data[row * cols + col];
        ctx.fillStyle = colour[c];
        ctx.fillRect(x, y, size, size);
      }
    }

    if (grid) {
      ctx.fillStyle = "rgba(128, 128, 128, 0.25)";
      for (y = size - 1; y < height; y += size) {
        ctx.fillRect(0, y, width, 1);
      }
      for (x = size - 1; x < width; x += size) {
        ctx.fillRect(x, 0, 1, height);
      }
    }

    // Paint beacons
    for (var beacon_name in sector.beacons) {
      var beacon = sector.beacons[beacon_name],
        style;
      switch (beacon.type) {
        case "wh":
          style = "#c6f";
          break;
        default:
          style = "#fff";
      }
      this.markTile(ctx, beacon.x, beacon.y, style);
    }
  }

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
  #computeGrid(tiles, maxPixels) {
    if (!(tiles > 0 && maxPixels > 0)) {
      throw new Error("Invalid parameters");
    }

    if (tiles > maxPixels) {
      throw new Error(
        "Cannot draw " + tiles + " tiles in " + maxPixels + " pixels",
      );
    }

    var grid,
      size = Math.floor((maxPixels + 1) / tiles);

    // A tile would be size-1 pixels per side, the extra pixel is
    // for the grid. All our tiles fit in the allowed pixels
    // because there is one less grid line than there are tiles.
    if (size < 4) {
      // This means our tiles would be 2 pixels per side. We
      // don't want grid lines in this case.
      size = Math.floor(maxPixels / tiles);
      grid = false;
    } else {
      size -= 1;
      grid = true;
    }

    this.#tileSize = size;
    this.#grid = grid;
  }

  #attachMouseEvents(canvas) {
    canvas.addEventListener("mousemove", (e) => this.#setPath(e, canvas));
    canvas.addEventListener("click", (e) => {
      this.#lockPath();
      this.#setPath(e, canvas);
    });
    canvas.addEventListener("mouseout", () => this.#mouseOut());
  }

  // This handler can be a bit slow on big sectors / slow browsers. Try and
  // speed it up if you ever have time.
  #setPath(e, canvas) {
    //determine client location, and calculate path to it if needed
    if (this.#mouselock) return;

    const rect = canvas.getBoundingClientRect(),
      scaleX = canvas.width / rect.width,
      scaleY = canvas.height / rect.height;
    const loc = this.xyToColRow(
      (e.clientX - rect.left) * scaleX,
      (e.clientY - rect.top) * scaleY,
    );
    if (!loc) return;

    if (loc.x !== this.#mouseX || loc.y !== this.#mouseY) {
      this.#drawPath(loc);

      //if there's a waypoint, why not draw it
      for (const n in this.#sector.beacons) {
        const b = this.#sector.beacons[n];
        if (b.x === loc.x && b.y === loc.y) {
          // I hate this so much
          this.#distanceDiv.innerHTML +=
            (b.type === "wh" ? "Wormhole to " : "") + n;
          break;
        }
      }
    }
  }

  //lock if unlocked, unlock and clear if locked
  #lockPath() {
    const storageKey = this.#ukey + "storedPath";
    if (this.#mouselock) {
      const ctx = this.get2DContext();
      this.clear(ctx);
      this.markShipTile(ctx);
      chrome.storage.local.remove([storageKey]);
      this.#mouselock = false;
    } else {
      const sid = Sector.getId(this.#sector.sector);
      const a = [];
      for (let i = 0, end = this.#savedPath.length; i < end; i++) {
        const p = this.#savedPath[i];
        a.push(Sector.getLocation(sid, p[0], p[1]));
      }
      chrome.storage.local.set({ [storageKey]: a });
      this.#mouselock = true;
    }
  }

  // clear the map when mouse leaves it
  #mouseOut() {
    if (this.#mouselock) return;

    let ctx = this.get2DContext();
    this.clear(ctx);
    this.markShipTile(ctx);
    this.#mouseX = -1;
    this.#mouseY = -1;
  }

  //draw the path from the current ship location to the mouse location, and
  //calculate AP costs for it
  #drawPath(loc) {
    const ctx = this.get2DContext();
    this.clear(ctx);
    this.markShipTile(ctx);

    //these fields must match those in options.js and map.js
    //var fields = ["Space", "Nebula", "Virus", "Energy", "Asteroid", "Exotic"];
    //var travelCosts = this.travelCosts;

    if (!this.#sector.mc) {
      // Compute the cost of movement from each tile in the map. This should be
      // done only once per sector, review this.

      const speed = this.#getSpeed();

      var tc = {
        b: -1,
        f: this.#visc["f"] - speed, // fuel -> space
        g: this.#visc["g"] - speed - (this.#navigation > 1 ? 1 : 0), // nebula gas
        v: this.#visc["v"] - speed,
        e: this.#visc["e"] - speed - (this.#navigation > 2 ? 1 : 0),
        o: this.#visc["o"] - speed - (this.#navigation > 0 ? 1 : 0), // ore -> asteriods
        m: this.#visc["m"] - speed, // Exotic Matter
      };

      const mc = new Uint8Array(this.#sector.width * this.#sector.height);
      const tiles = this.#sector.tiles;
      for (let i = 0; i < tiles.length; i++) {
        const c = tiles.charAt(i);
        let n = tc[c];
        if (n === -1) n = 0;
        mc[i] = n;
      }
      this.#sector.mc = mc;
    }

    const route = SectorMap.#findRoute(
      this.#sector,
      this.#shipX,
      this.#shipY,
      loc.x,
      loc.y,
    );

    let apsSpent;
    if (!route) {
      apsSpent = "&infin;";
      this.#savedPath = [[loc.x, loc.y]];
    } else {
      apsSpent = 0;
      for (let i = 0, end = route.length - 1; i < end; i++) {
        const [x, y] = route[i];
        const w = this.#sector.width;
        const mc = this.#sector.mc;
        apsSpent += mc[y * w + x];
      }
      this.#savedPath = route;
    }
    this.#drawSavedPath(ctx);
    this.markShipTile(ctx);
    this.#distanceDiv.innerHTML =
      "Distance to " +
      this.#sector.sector +
      " [" +
      loc.x +
      ", " +
      loc.y +
      "]:<br>" +
      apsSpent +
      " APs<br>&nbsp;"; //innerHTML to accomodate infinity symbol
  }

  // Calculates speed (as in the Pardus Manual), allowing for boost, stims, etc.
  // XXX still needs to be tested with legendary.
  // Currently only used in drawpath.
  #getSpeed() {
    let currentTileType =
      this.#sector.tiles[this.#shipX + this.#sector.width * this.#shipY];
    let moveField = document.getElementById("tdStatusMove").childNodes;
    let speed = 0;
    if (moveField.length > 1) {
      //something modifies our speed
      speed -= parseInt(moveField[1].childNodes[0].textContent);
    }
    speed -= parseInt(moveField[0].textContent);
    speed += this.#visc[currentTileType];

    if (
      (this.#navigation > 0 && currentTileType === "o") ||
      (this.#navigation > 1 && currentTileType === "g") ||
      (this.#navigation > 2 && currentTileType === "e")
    ) {
      speed -= 1;
    }
    return speed;
  }

  static #findRoute(map, startX, startY, endX, endY) {
    const width = map.width;
    const height = map.height;
    const mc = map.mc;

    // Helper function to get tile value at coordinates
    const getTile = (x, y) => {
      if (x < 0 || x >= width || y < 0 || y >= height) return 0;
      return mc[y * width + x];
    };

    // Check if start or end are impassable or out of bounds
    if (getTile(startX, startY) === 0 || getTile(endX, endY) === 0) {
      return null;
    }

    // If start and end are the same
    if (startX === endX && startY === endY) {
      return [[startX, startY]];
    }

    // Possible movements (8 directions)
    const directions = [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0], // up, down, left, right
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1], // diagonals
    ];

    // Heuristic function (Euclidean distance)
    const heuristic = (x1, y1, x2, y2) => {
      const dx = Math.abs(x1 - x2);
      const dy = Math.abs(y1 - y2);
      return Math.sqrt(dx * dx + dy * dy);
    };

    // Priority queue for A* algorithm
    const openSet = new PriorityQueue();
    openSet.enqueue([startX, startY], 0);

    // Track visited nodes and their costs
    const cameFrom = new Map();
    const gScore = new Map(); // Cost from start to current
    const fScore = new Map(); // Estimated total cost (g + h)

    gScore.set(`${startX},${startY}`, 0);
    fScore.set(`${startX},${startY}`, heuristic(startX, startY, endX, endY));

    while (!openSet.isEmpty()) {
      const [currentX, currentY] = openSet.dequeue();

      if (currentX === endX && currentY === endY) {
        // Reconstruct path
        const path = [];
        let current = `${endX},${endY}`;
        while (current) {
          const [x, y] = current.split(",").map(Number);
          path.push([x, y]);
          current = cameFrom.get(current);
        }
        return path.reverse();
      }

      // Check all 8 directions
      for (const [dx, dy] of directions) {
        const nextX = currentX + dx;
        const nextY = currentY + dy;
        const nextTile = getTile(nextX, nextY);

        if (nextTile === 0) continue; // Skip impassable tiles

        // Calculate movement cost (uses tile cost of destination)
        const tentativeGScore =
          gScore.get(`${currentX},${currentY}`) + nextTile;

        const nextKey = `${nextX},${nextY}`;
        if (tentativeGScore < (gScore.get(nextKey) ?? Infinity)) {
          cameFrom.set(nextKey, `${currentX},${currentY}`);
          gScore.set(nextKey, tentativeGScore);
          fScore.set(
            nextKey,
            tentativeGScore + heuristic(nextX, nextY, endX, endY),
          );
          openSet.enqueue([nextX, nextY], fScore.get(nextKey));
        }
      }
    }

    // No path found
    return null;
  }
}

// Simple Priority Queue implementation
class PriorityQueue {
  constructor() {
    this.values = [];
  }

  enqueue(val, priority) {
    this.values.push({ val, priority });
    this.sort();
  }

  dequeue() {
    return this.values.shift().val;
  }

  sort() {
    this.values.sort((a, b) => a.priority - b.priority);
  }

  isEmpty() {
    return this.values.length === 0;
  }
}
