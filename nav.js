// Additions to the nav page

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
var scheduledShowLinks;
var cleanup;

function messageHandler(msg) {
  if(msg.op == 'updateValue') {
    var info = LINKS[msg.key];
    if(!info)
      return;
    enabledLinks[msg.key] = msg.value;
    if(Object.keys(enabledLinks).length == NLINKS) {
      // configuration is complete
      linksConfigured = true;
      showLinks();
    }
  }
}

function mutationHandler(e) {
  if(linksConfigured)
    showLinks();
}

function showLinks() {
  // find the commands tab
  var ctab = document.getElementById('commands_content');
  if(!ctab)
    return;

  // remove the mutation listener, we don't want to hear of our own fiddling
  ctab.parentNode.removeEventListener('DOMSubtreeModified', mutationHandler, false);

  // remove any links if any.
  while(cleanup.length > 0) {
    var e = cleanup.pop();
    e.parentNode.removeChild(e);
  }

  // find the "Land on planet", "Land on starbase" or "Enter building"
  // div. We look for the link to planet.php, starbase.php or
  // building.php really; if we find one of those, we use the parent
  // div.
  var planet, keys, i;
  var as = ctab.getElementsByTagName('a');
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
    var doc = ctab.ownerDocument;
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
        e.style.fontSize = '10px';
        // remember this element so we can remove it later
        cleanup.push(e);
        ctab.insertBefore(e, here);
      }
    }
  }
  // else no planet

  // add the mutation listener back
  ctab.parentNode.addEventListener('DOMSubtreeModified', mutationHandler, false);
}

function run() {
  enabledLinks = new Object();
  cleanup = new Array();

  port = chrome.extension.connect();
  port.onMessage.addListener(messageHandler);
  port.postMessage({ op: 'subscribe', keys: Object.keys(LINKS) });

  var ctab = document.getElementById('commands_content');
  if(ctab)
    ctab.parentNode.addEventListener('DOMSubtreeModified', mutationHandler, false);
}

run();
