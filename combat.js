// Common stuff to do in combat screens.

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
