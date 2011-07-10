// Routines for adding the attack and trade icons to ships in the otherships box

// 'element' below should be a table.  Pardus shows other ships in
// tables with one row and two columns; one column shows the ship
// graphic, the other the pilot's name and alliance and stuff. We add
// our stuff in this last cell.
//
// 'match' is a function that examines the href of the link in the
// pilot's name.  It should return an object with properties 'type'
// ('player' or 'opponent') and 'id' (the id of the player or NPC).
//
// 'remember' can be null, or an array. if an array, the elements
// inserted will be pushed there too, so they can be removed if the
// highlight needs be undone.

function addShipLinks(element, match, remember) {
  // find the TD which contains the link to the pilot
  var info;
  var tds = element.getElementsByTagName('td');
  for(var i = 0; i < tds.length; i++) {
    var td = tds[i];
    var as = td.getElementsByTagName('a');
    for(var j = 0; j < as.length; j++) {
      var a = as[j];
      info = match(a.href);
      if(info) {
        info.td = td;
        break;
      }
    }
  }

  if(!info)
    // couldn't find the pilot/npc info, soz
    return;

  // add the links

  var doc = info.td.ownerDocument;
  var br = doc.createElement('br');
  info.td.appendChild(br);
  var span = doc.createElement('span');
  span.style.fontSize = '11px';
  var a = doc.createElement('a');
  a.style.color = 'red';
  a.appendChild(doc.createTextNode('Attack'));
  if(info.type == 'player') {
    a.href = 'ship2ship_combat.php?playerid=' + info.id;
    span.appendChild(a);
    span.appendChild(doc.createTextNode(' · '));
    a = doc.createElement('a');
    a.href = 'ship2ship_transfer.php?playerid=' + info.id;
    a.appendChild(doc.createTextNode('Trade'));
    span.appendChild(a);
  }
  else {
    a.href = 'ship2opponent_combat.php?opponentid=' + info.id;
    span.appendChild(a);
  }

  info.td.appendChild(span);

  if(remember) {
    remember.push(br);
    remember.push(span);
  }
}
