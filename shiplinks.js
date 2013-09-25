// Routines for adding the attack and trade icons to ships in the otherships box

// This one extracts a list of ships/opponents from a container
// element. xpath is evaluated from container, and is expected to find
// the links that matchId will match.

function getShips(container, xpath, matchId) {
  var doc = container.ownerDocument;
  if(!doc)
    doc = container;
  var ships = [];
  var xpr = doc.evaluate(xpath, container, null,
                         XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
  var a, entry;
  while((a = xpr.iterateNext())) {
    var href = a.href;
    var m = matchId(href);
    if(m) {
      entry = m;
      entry.name = a.textContent;
      entry.td = a.parentNode;
      ships.push(entry);

      /* one day we'll have use for this; it works
      if(entry.type == 'player') {
        // see if we find an alliance link
        var xpr2 = doc.evaluate("font/b/a",
                                entry.td, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE,
                                null);
        var aa;
        while((aa = xpr2.iterateNext())) {
          if(aa.pathname == '/alliance.php' && (m = /^\?id=(\d+)$/.exec(aa.search))) {
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

// Very generic, could move somewhere else
function removeElementsByClassName(base, className) {
  var elts = base.getElementsByClassName(className), a = [], i, end;
  // Add to a proper array first, cause if we modify the document
  // while traversing the HTMLCollection, funky things would happen.
  for(i = 0, end = elts.length; i < end; i++)
    a.push(elts[i]);
  // Now remove them.
  for(i = 0, end = a.length; i < end; i++) {
    var elt = a[i];
    elt.parentNode.removeChild(elt);
  }
}

function addShipLinks(ships) {
  for(var i = 0, end = ships.length; i < end; i++) {
    var entry = ships[i];
    var player = entry.type == 'player';
    var doc = entry.td.ownerDocument;
    var div = doc.createElement('div');
    div.className = 'psw-slink';
    div.style.fontSize = '10px';
    div.style.fontWeight = 'bold';
    var a = doc.createElement('a');
    if(player)
      a.href = 'ship2ship_combat.php?playerid=' + entry.id;
    else
      a.href = 'ship2opponent_combat.php?opponentid=' + entry.id;
    a.style.color = '#cc0000';
    a.title = 'Attack ' + entry.name;
    a.appendChild(doc.createTextNode('Attack'));
    div.appendChild(a);

    if(player) {
      div.appendChild(doc.createTextNode(' '));
      a = doc.createElement('a');
      a.href = 'ship2ship_transfer.php?playerid=' + entry.id;
      a.style.color = '#a1a1af';
      a.title = 'Trade with ' + entry.name;
      a.appendChild(doc.createTextNode('Trade'));
      div.appendChild(a);
    }

    entry.td.appendChild(div);
  }
}
