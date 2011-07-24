// Additions to the nav page
// Load shiplinks.js before this.

var LINKS = {
  navEquipmentLink:   { href: 'ship_equipment.php', name: 'Ship equipment'      },
  navPlanetTradeLink: { href: 'planet_trade.php',   name: 'Trade with planet'   },
  navSBTradeLink:     { href: 'starbase_trade.php', name: 'Trade with starbase' },
  navBldgTradeLink:   { href: 'building_trade.php', name: 'Trade with building' },
  navBMLink:          { href: 'blackmarket.php',    name: 'Black market'        },
  navHackLink:        { href: 'hack.php',           name: 'Hack information'    },
  navBBLink:          { href: 'bulletin_board.php', name: 'Bulletin board'      }
};
var NLINKS = Object.keys(LINKS).length;

var PSBKEYS = {
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
};

var port;
var enabledLinks;
var linksConfigured;

var shipLinksEnabled;

// This matches strings of the form:
//   javascript:scanId(22324, "player")
// or
//   javascript:scanId(25113, "opponent")
function matchScanId(url) {
  var r;
  var m = /^javascript:scanId\((\d+),\s*['"]([^'"]+)['"]\)$/.exec(url);
  if(m)
    r = { type: m[2], id: parseInt(m[1]) };

  return r;
}

function messageHandler(msg) {
  if(msg.op == 'updateValue') {
    var info = LINKS[msg.key];
    if(info) {
      enabledLinks[msg.key] = msg.value;
      if(Object.keys(enabledLinks).length == NLINKS) {
        // configuration is complete
        linksConfigured = true;
        var cbox = document.getElementById('commands_content');
        if(cbox)
          setupLinks(cbox);
      }
    }
    else if(msg.key == 'navShipLinks' && msg.value) {
      shipLinksEnabled = true;
      var sbox = document.getElementById('otherships_content');
      if(sbox) {
        var ships = getShips(sbox, "table/tbody/tr/td[position() = 2]/a", matchScanId);
        addShipLinks(ships);
      }
    }
  }
}

function setupLinks(cbox) {
  // find the "Land on planet", "Land on starbase" or "Enter building"
  // div. We look for the link to planet.php, starbase.php or
  // building.php really; if we find one of those, we use the parent
  // div.
  var planet, keys, i;
  var as = cbox.getElementsByTagName('a');
  for(i = 0; i < as.length; i++) {
    var a = as[i];
    keys = PSBKEYS[a.pathname];
    if(keys) {
      planet = a.parentNode;
      break;
    }
  }

  if(planet) {
    // rock and roll. add the enabled links then
    var here = planet.nextSibling;
    var doc = cbox.ownerDocument;
    for(i = 0; i < keys.length; i++) {
      var key = keys[i];
      if(enabledLinks[key]) {
        var info = LINKS[key];
        var e = doc.createElement('div');
        var a = doc.createElement('a');
        a.href = info.href;
        a.appendChild(doc.createTextNode(info.name));
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
}

function cboxMutationHandler(event) {
  if(linksConfigured && event.target.id == 'commands_content')
    setupLinks(event.target);
}

function sboxMutationHandler(event) {
  if(shipLinksEnabled && event.target.id == 'otherships_content') {
    var ships = getShips(event.target, "table/tbody/tr/td[position() = 2]/a", matchScanId);
    addShipLinks(ships);
  }
}

function run() {
  enabledLinks = new Object();

  port = chrome.extension.connect();
  port.onMessage.addListener(messageHandler);
  var keys = Object.keys(LINKS).concat(['navShipLinks']);
  port.postMessage({ op: 'subscribe', keys: keys });

  var box = document.getElementById('commands');
  if(box)
    // this element gets a new div (id=commands_content) inserted
    // into it when the game javascript updates the commands box. we
    // listen to that to update our own stuff.
    box.addEventListener('DOMNodeInserted', cboxMutationHandler, false);
  box = document.getElementById('otherships');
  if(box)
    // this element gets a new div (id=otherships_content) inserted
    // into it when the game javascript updates the ships box. we
    // listen to that to update our own stuff.
    box.addEventListener('DOMNodeInserted', sboxMutationHandler, false);
}

run();
