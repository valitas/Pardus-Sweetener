// Common stuff to do in combat screens.

function sweetenCombatPage(config) {
  if(config.highestRounds)
    selectHighestRounds();
  if(config.missileAutoAll)
    checkAllMissiles();

  var pts = parseInt(config.autobotsPoints);
  var str = parseInt(config.autobotsStrength);
  if(pts && str) {
    fillBots(pts, str);
  }
}

function selectHighestRounds() {
  var elts = document.getElementsByName('rounds');
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
}

function checkAllMissiles() {
  var am = document.getElementById("allmissiles");
  if(am)
    am.checked = true;
  // this is what the game's javascript does in this case, more or less:
  var ms = document.getElementsByTagName('input');
  for(var i = 0; i < ms.length; i++) {
    var m = ms[i];
    if(m.type == 'checkbox' && m.name.indexOf('_missile') != -1)
      m.checked = true;
  }
}

function fillBots(pts, str) {
  var ns = document.evaluate(
    "//tr[td/img[@alt = 'Robots']]/td[position() = 2] |" +
    "//tr[td/img[@alt = 'Robots']]/td/input[@name = 'amount'] |" +
    "//tr/td/font/text()[starts-with(., 'Armor points:')]",
    document, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
  if(ns) {
    var available = ns.iterateNext();
    var input = ns.iterateNext();
    var armour = ns.iterateNext();
    if(available && input && armour) {
      armour = armour.textContent;
      armour = parseInt(armour.substr(armour.indexOf(':') + 1));
      if(armour < pts) {
        available = parseInt(available.textContent);
        var n = Math.floor((pts - armour) / str);
        if(n > available)
          n = available;
        if(n > 0)
          input.value = n;
      }
    }
  }
}
