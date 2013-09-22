// This object handles auto-missiles, auto-highest-rounds, bot fill
// and display damage. It's used in the ship v ship and ship v npc
// screens.

// The port is intended to be shared with code outside this object.
// This object will register itself as a message listener on the port,
// but it won't subscribe to the values it needs; this has to be done
// by the caller; the property 'configkeys' in this object contains an
// array of keys that can be passed in a subscribe message (along with
// whatever other keys the page needs).

function PSWCombatScreenDriver(doc, port, configmap) {
  this.doc = doc;
  this.port = port;
  this.configmap = configmap;
  this.configkeys = Object.keys(this.configmap);
  this.configcount = this.configkeys.length;

  this.config = new Object();

  var self = this;

  this.port.onMessage.addListener(function(msg) { self.messageHandler(msg); });
}

PSWCombatScreenDriver.prototype = {
  messageHandler: function(msg) {
    if(msg.op != 'updateValue')
      return;

    var key = this.configmap[msg.key];
    if(key)
      this.config[key] = msg.value;
    if(Object.keys(this.config).length >= this.configcount)
      this.configure();
  },

  // called when configuration is complete
  configure: function() {
    if(this.config.highestRounds)
      this.selectHighestRounds();
    if(this.config.missileAutoAll)
      this.checkAllMissiles();
    if(this.config.autobots)
      this.fillBots();
    if(this.config.displayDamage) {
      this.registerPSSHandlers();
      this.displayDamage();
    }
  },

  selectHighestRounds: function() {
    var elts = this.doc.getElementsByName('rounds');
    for(var i = 0; i < elts.length; i++) {
      var highest = 0, highestElt = null;
      var elt = elts[i];
      var opts = elt.getElementsByTagName('option');
      for(var j = 0; j < opts.length; j++) {
        var opt = opts[j];
        var n = parseInt(opt.value);
        if(n > highest) {
          highest = n;
          highestElt = opt;
        }
      }
      if(highestElt)
        highestElt.selected = true;
    }
  },

  checkAllMissiles: function() {
    var am = this.doc.getElementById("allmissiles");
    if(am)
      am.checked = true;
    // this is what the game's javascript does in this case, more or less:
    var ms = this.doc.getElementsByTagName('input');
    for(var i = 0; i < ms.length; i++) {
      var m = ms[i];
      if(m.type == 'checkbox' && m.name.indexOf('_missile') != -1)
        m.checked = true;
    }
  },

  // This function scans the combat page and extracts the stuff we need
  // for bot autofill.  It doesn't modify anything.  If successful, it
  // returns an object with properties "available" (integer) and "input"
  // (node). Otherwise, it'll return null.

  getBotsInfo: function() {
    if(this.botsInfo !== undefined)
      return this.botsInfo;

    this.botsInfo = null; // run only once
    var tr, xpr, available, input;

    tr = this.doc.evaluate("//tr[td/input[@name = 'resid' and @value = 8]]",
                           this.doc, null, XPathResult.ANY_UNORDERED_NODE_TYPE,
                           null).singleNodeValue;
    if(tr) {
      xpr = this.doc.evaluate("td[position() = 2]|td/input[@name = 'amount']",
                              tr, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
      available = xpr.iterateNext();
      if(available) {
        available = parseInt(available.textContent);
        if(available > 0) {
          input = xpr.iterateNext();
          if(input)
            this.botsInfo = { available: available, input: input };
        }
      }
    }

    return this.botsInfo;
  },

  // This function scans the combat page and extracts stuff we need for
  // bot autofill and damage tracking.  It doesn't modify anything.  If
  // successful, it returns an object with properties "selfHull",
  // "selfArmor" (thusly mispelled grr :P), "otherHull", etc.

  getShipStatus: function() {
    if(this.shipStatus)
      return this.shipStatus;

    this.shipStatus = { };
    this.shipStatusTextElements = { };

    var fs = this.doc.getElementsByTagName('font');
    for(var i = 0; i < fs.length; i++) {
      var f = fs[i];
      var t = f.firstChild;

      if(t && t.nodeType == 3) {
        var m = /^(Hull|Armor|Shield) points(?:: (\d+))?$/.exec(t.nodeValue);
        var key, o;
        if(m) {
          var v = m[2];
          if(v) {
            key = 'self' + m[1];
            o = { value: parseInt(v), accurate: true };
          }
          else {
            key = 'other' + m[1];
            o = { inferred: true };

            var a, n, table = f.nextElementSibling;
            if(table && table.tagName == 'TABLE') {
              a = table.attributes['width'];
              if(a) {
                v = parseInt(a.value);
                o.value = 2*v;
                o.accurate = (v < 300);
              }
            }
          }

          this.shipStatus[key] = o;
          this.shipStatusTextElements[key] = t;
        }
      }
    }

    return this.shipStatus;
  },

  fillBots: function() {
    var pts = parseInt(this.config.autobotsPoints);
    var str = parseInt(this.config.autobotsStrength);
    if(pts && str) {
      var bi = this.getBotsInfo();
      if(bi) {
        var armour = this.getShipStatus().selfArmor;
        if(armour) {
          armour = armour.value;
          if(armour < pts) {
            var n = Math.floor((pts - armour) / str);
            if(n > bi.available)
              n = bi.available;
            if(n > 0)
              bi.input.value = n;
          }
        }
      }
    }
  },

  registerPSSHandlers: function() {
    if(this.pssHandlersRegistered)
      return;
    this.pssHandlersRegistered = true;

    var fs = this.doc.forms;
    var self = this;
    for(var i = 0; i < fs.length; i++) {
      var form = fs[i];
      form.addEventListener('submit', function() { self.savePSS(); }, null);
    }
  },

  savePSS: function() {
    if(this.shipStatus) {
      this.shipStatus.timestamp = Math.floor(Date.now() / 1000);
      var v = JSON.stringify(this.shipStatus);
      port.postMessage({ op: 'setValue', key: 'previousShipStatus', value: v });
    }
  },

  displayDamage: function() {
    if(this.damageDisplayed)
      return;

    this.damageDisplayed = true;
    var ss = this.getShipStatus();
    var pss;

    if(this.config.previousShipStatus) {
      pss = JSON.parse(this.config.previousShipStatus);
      var now = Math.floor(Date.now() / 1000);

      // XXX - hardcoded 5. PSS is saved when the user clicks on combat.
      // so, if we get a new combat screen within 5 seconds of having
      // left another, we assume this is the same combat continuing and
      // show damage.  I don't think this is unreasonable...

      if(!pss.timestamp || Math.abs(now - pss.timestamp) > 5)
        pss = null;
    }

    for(var key in ss) {
      var st = ss[key];
      var te = this.shipStatusTextElements[key];
      var s = te.data;
      var l = s.length;

      if(st.inferred) {
        if(st.accurate)
          s += ': ' + st.value;
        else
          s += ': ' + st.value + '+';
      }

      if(pss) {
        var pst = pss[key];
        if(st.accurate && pst.accurate && st.value != pst.value) {
          var diff = st.value - pst.value;
          if(diff > 0)
            diff = '+' + diff;
          s += ' (' + diff + ')';
        }
      }

      if(l != s.length)
        te.data = s;
    }
  }
};
