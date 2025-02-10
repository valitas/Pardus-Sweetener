// Attack and trade links to ships in the otherships box.
//
// An instance of ShipLinks manages the display of ship links in a document or
// document element. It knows the current state, that is, whether links are
// being shown or not; and based on this, it knows whether to add the links,
// remove them, or do nothing, when told to turn the links on or off.
//
// The class also has static methods that do most of the work.

class ShipLinks {
  // Instantiation is cheap, has no side effects, and the controller needs no
  // cleanup.
  constructor(xpath, matchId) {
    this.container = null;
    this.state = false;
    this.xpath = xpath;
    this.matchId = matchId;
  }

  // Container is where we're adding and removing links; can be a Document,
  // though an element may be more efficient.
  setContainer(container, state) {
    this.container = container;
    this.state = state;
  }

  update(enable) {
    enable = !!enable;
    if (enable !== this.state && this.container) {
      // First remove all links we may have added before.
      ShipLinks.removeElementsByClassName(this.container, "psw-slink");

      if (enable) {
        let ships = ShipLinks.getShips(
          this.container,
          this.xpath,
          this.matchId,
        );
        ShipLinks.addShipLinks(ships);
      }

      this.state = enable;
    }
    // else state hasn't changed, leave as is
  }

  // Extracts a list of ships/opponents from a container element.
  // Expects matchId to be a function that parses the href of links
  // in the otherships box, and extracts from it the opponent type
  // and id (see this in use in nav.js and combat.js).  xpath is
  // evaluated from container, and is expected to find the anchors
  // that will be tested by matchId.
  static getShips(container, xpath, matchId) {
    var doc = container.ownerDocument,
      ships = [],
      xpr,
      a,
      entry;

    if (!doc) {
      doc = container;
    }

    xpr = doc.evaluate(
      xpath,
      container,
      null,
      XPathResult.ORDERED_NODE_ITERATOR_TYPE,
      null,
    );
    while ((a = xpr.iterateNext())) {
      var href = a.href,
        m = matchId(href);
      if (m) {
        entry = m;
        entry.name = a.textContent;
        entry.td = a.parentNode;
        ships.push(entry);

        /* one day we'll have use for this; it works
				 if (entry.type == 'player') {
				   // see if we find an alliance link
				   var xpr2 = doc.evaluate("font/b/a",
				     entry.td, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE,
				     null);
				   var aa;
				   while ((aa = xpr2.iterateNext())) {
				     if (aa.pathname == '/alliance.php' &&
				         (m = /^\?id=(\d+)$/.exec(aa.search))) {
				       entry.ally_id = parseInt(m[1]);
				       entry.ally_name = aa.textContent;
				       break;
				     }
				   }
				 } */
      }
    }

    return ships;
  }

  // Takes the list of ships built by getShips above, and actually
  // adds the links.
  static addShipLinks(ships) {
    for (var i = 0, end = ships.length; i < end; i++) {
      var entry = ships[i],
        player = entry.type == "player",
        doc = entry.td.ownerDocument,
        div = doc.createElement("div"),
        a;

      div.className = "psw-slink";
      div.style.fontSize = "10px";
      div.style.fontWeight = "bold";
      a = doc.createElement("a");
      if (player) {
        a.href = "ship2ship_combat.php?playerid=" + entry.id;
      } else {
        a.href = "ship2opponent_combat.php?opponentid=" + entry.id;
      }
      a.style.color = "#cc0000";
      a.title = "Attack " + entry.name;
      a.appendChild(doc.createTextNode("Attack"));
      div.appendChild(a);

      if (player) {
        div.appendChild(doc.createTextNode(" "));
        a = doc.createElement("a");
        a.href = "ship2ship_transfer.php?playerid=" + entry.id;
        a.style.color = "#a1a1af";
        a.title = "Trade with " + entry.name;
        a.appendChild(doc.createTextNode("Trade"));
        div.appendChild(a);
      }

      entry.td.appendChild(div);
    }
  }

  // What it says on the tin.  Very general, this one, could move
  // somewhere else...
  static removeElementsByClassName(base, className) {
    var elts = base.getElementsByClassName(className),
      a = [],
      i,
      end;

    // Add to a proper array first, cause if we modify the
    // document while traversing the HTMLCollection, funky things
    // happen.
    for (i = 0, end = elts.length; i < end; i++) {
      a.push(elts[i]);
    }

    // Now remove them.
    for (i = 0, end = a.length; i < end; i++) {
      var elt = a[i];
      elt.parentNode.removeChild(elt);
    }
  }
}
