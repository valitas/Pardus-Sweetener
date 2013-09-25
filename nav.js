// Additions to the nav page
// Load shiplinks.js before this.

function PSNavPageDriver(doc) { this.initialise(doc); }

PSNavPageDriver.prototype = {

  // Ordinarily, we'd wait for DOMContentLoaded before doing all the
  // initialisation below. However, this being a content script, we
  // rely on Chrome to call us at the proper time, and assume doc is
  // ready by now.

  initialise: function(doc) {
    this.doc = doc;
    this.enabledLinks = new Object();

    this.port = chrome.extension.connect();
    this.port.onMessage.addListener(this.onMessage.bind(this));

    var keys = Object.keys(this.LINKS);

    // Remember how many link options we'll request. We use this
    // later to notice when we have them all.
    this.linkOptionCount = keys.length;

    keys.push('navShipLinks');
    this.port.postMessage({ op: 'subscribe', keys: keys });

    var box = doc.getElementById('commands');
    if(box)
      // this element gets a new div (id=commands_content) inserted
      // into it when the game javascript updates the commands box. we
      // listen to that to update our own stuff.
      box.addEventListener('DOMNodeInserted', this.onCBoxMutation.bind(this));
    box = doc.getElementById('otherships');
    if(box)
      // this element gets a new div (id=otherships_content) inserted
      // into it when the game javascript updates the ships box. we
      // listen to that to update our own stuff.
      box.addEventListener('DOMNodeInserted', this.onSBoxMutation.bind(this));
  },

  LINKS: {
    navEquipmentLink:   { href: 'ship_equipment.php',
                          name: 'Ship equipment'      },
    navPlanetTradeLink: { href: 'planet_trade.php',
                          name: 'Trade with planet'   },
    navSBTradeLink:     { href: 'starbase_trade.php',
                          name: 'Trade with starbase' },
    navBldgTradeLink:   { href: 'building_trade.php',
                          name: 'Trade with building' },
    navBMLink:          { href: 'blackmarket.php',
                          name: 'Black market'        },
    navHackLink:        { href: 'hack.php',
                          name: 'Hack information'    },
    navBBLink:          { href: 'bulletin_board.php',
                          name: 'Bulletin board'      }
  },

  PSBKEYS: {
    '/planet.php':   [ 'navEquipmentLink',
                       'navPlanetTradeLink',
                       'navBMLink',
                       'navHackLink',
                       'navBBLink' ],
    '/starbase.php': [ 'navEquipmentLink',
                       'navSBTradeLink',
                       'navBMLink',
                       'navHackLink',
                       'navBBLink' ],
    '/building.php': [ 'navBldgTradeLink',
                       'navHackLink' ]
  },

  //var port;
  //var enabledLinks;
  //var linksConfigured;
  //var shipLinksEnabled;

  matchId: function(url) {
    var r;

    // This matches strings of the form:
    //   javascript:scanId(22324, "player")
    // or
    //   javascript:scanId(25113, "opponent")
    var m = /^javascript:scanId\((\d+),\s*['"]([^'"]+)['"]\)|main\.php\?scan_details=(\d+)&scan_type=([A-Za-z]+).*$/.exec(url);
    if(m) {
      var id = m[1];
      if(id)
        r = { type: m[2], id: parseInt(id) };
      else
        r = { type: m[4], id: parseInt(m[3]) };
    }

    return r;
  },

  onMessage: function(msg) {
    if(msg.op != 'updateValue')
      return;

    var doc = this.doc, info = this.LINKS[msg.key];
    if(info) {
      this.enabledLinks[msg.key] = msg.value;
      if(Object.keys(this.enabledLinks).length == this.linkOptionCount) {
        // configuration is complete
        this.linksConfigured = true;
        var cbox = doc.getElementById('commands_content');
        if(cbox)
          this.setupLinks(cbox);
      }
    }
    else if(msg.key == 'navShipLinks' && msg.value) {
      this.shipLinksEnabled = true;
      var sbox = doc.getElementById('otherships_content');
      if(sbox) {
        var ships =
          getShips(sbox, "table/tbody/tr/td[position() = 2]/a", this.matchId);
        addShipLinks(ships);
      }
    }
  },

  setupLinks: function(cbox) {
    // find the "Land on planet", "Land on starbase" or "Enter
    // building" div. We look for the link to planet.php, starbase.php
    // or building.php really; if we find one of those, we use the
    // parent div.
    var planet, keys, i, end;
    var as = cbox.getElementsByTagName('a');
    for(i = 0, end = as.length; i < end; i++) {
      var a = as[i];
      keys = this.PSBKEYS[a.pathname];
      if(keys) {
        planet = a.parentNode;
        break;
      }
    }

    if(planet) {
      // rock and roll.

      // add the enabled links then
      var here = planet.nextSibling;
      var doc = cbox.ownerDocument;
      for(i = 0, end = keys.length; i < end; i++) {
        var key = keys[i];
        if(this.enabledLinks[key]) {
          var info = this.LINKS[key];
          var e = doc.createElement('div');
          e.className = 'psw-plink';
          var a = doc.createElement('a');
          a.href = info.href;
          a.textContent = info.name;
          e.appendChild(a);
          // don't ask me, this weird positioning is how pardus does it...
          e.style.position = 'relative';
          e.style.top = '6px';
          e.style.left = '6px';
          e.style.fontSize = '11px';
          cbox.insertBefore(e, here);
        }
      }
    }
  },

  onCBoxMutation: function(event) {
    var cbox = event.target;
    if(this.linksConfigured && cbox.id == 'commands_content')
      this.setupLinks(cbox);
  },

  onSBoxMutation: function(event) {
    var sbox = event.target;
    if(this.shipLinksEnabled && sbox.id == 'otherships_content') {
      var ships =
        getShips(sbox, "table/tbody/tr/td[position() = 2]/a", matchId);
      addShipLinks(ships);
    }
  }
};

var ps_pagedriver = new PSNavPageDriver(document);
