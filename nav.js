// Additions to the nav page
// Load shiplinks.js before this.

function PSNavPageDriver(doc) { this.initialise(doc); }

PSNavPageDriver.prototype = {

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

  // Ordinarily, we'd wait for DOMContentLoaded before doing all the
  // initialisation below. However, this being a content script, we
  // rely on Chrome to call us at the proper time, and assume doc is
  // ready by now.

  initialise: function(doc) {
    this.doc = doc;
    this.enabledLinks = new Object();

    this.port = chrome.extension.connect();
    this.port.onMessage.addListener(this.onPortMessage.bind(this));

    var keys = Object.keys(this.LINKS);

    // Remember how many link options we'll request. We use this
    // later to notice when we have them all.
    this.linkOptionCount = keys.length;

    keys.push('navShipLinks');
    this.port.postMessage({ op: 'subscribe', keys: keys });

    // Insert a bit of script to execute in the page's context and
    // send us what we need. And add a listener to receive the call.
    var window = doc.defaultView;
    window.addEventListener('message', this.onMessage.bind(this), false);
    var script = doc.createElement('script');
    script.type = 'text/javascript';
    script.textContent = "(function() {var fn=function(){window.postMessage({pardus_sweetener:1,loc:typeof(userloc)=='undefined'?null:userloc,ajax:typeof(ajax)=='undefined'?null:ajax},window.location.origin);};if(typeof(addUserFunction)=='function')addUserFunction(fn);fn();})();";
    doc.body.appendChild(script);
  },

  // This is a handler for DOM messages coming from the game page.
  // Arrival of a message means the page contents were updated. The
  // message contains the value of the userloc variable, too.
  onMessage: function(event) {
    var data = event.data;
    if(!data || data.pardus_sweetener != 1)
        return;
    this.userloc = parseInt(data.loc);
    this.ajax = data.ajax;

    var doc = this.doc, box = doc.getElementById('commands_content');
    if(box && this.linksConfigured)
      this.setupLinks(box);

    box = doc.getElementById('otherships_content');
    if(box && this.shipLinksEnabled) {
      removeElementsByClassName(box, 'psw-slink');
      var ships =
        getShips(box, "table/tbody/tr/td[position() = 2]/a", this.matchId);
      addShipLinks(ships);
    }
  },

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

  onPortMessage: function(msg) {
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
    else if(msg.key == 'navShipLinks') {
      // First of all, remove all links we may have added before. This
      // function will be called if the configuration changes. The
      // utility function removeElementsByClassName is currently in
      // shiplinks.js, we may move it somewhere else later.
      var sbox = doc.getElementById('otherships_content');
      if(sbox) {
        removeElementsByClassName(sbox, 'psw-slink');
        this.shipLinksEnabled = msg.value;
        // Now, if enabled, add them again.
        if(this.shipLinksEnabled) {
          var ships =
            getShips(sbox, "table/tbody/tr/td[position() = 2]/a", this.matchId);
          addShipLinks(ships);
        }
      }
    }
  },

  setupLinks: function(cbox) {
    // First of all, remove all links we may have added before. This
    // function will be called if the configuration changes. The
    // utility function removeElementsByClassName is currently in
    // shiplinks.js, we may move it somewhere else later.
    removeElementsByClassName(cbox, 'psw-plink');

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
      // rock and roll. add the enabled links then
      var doc = this.doc, here = planet.nextSibling;
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
  }
};

var ps_pagedriver = new PSNavPageDriver(document);
