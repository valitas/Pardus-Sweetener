// load slicer.js before this

var qls = new Array();
var highlighted_ql = -1;

function highlightQL(id) {
  if(id == highlighted_ql)
    return;

  var spans, i;

  if(highlighted_ql >= 0) {
    spans = qls[highlighted_ql].spans;
    if(spans)
      for(i = 0; i < spans.length; i++)
        spans[i].style.color = 'inherit';
  }

  highlighted_ql = id;
  if(id >= 0 && id < qls.length) {
    spans = qls[id].spans;
    for(i = 0; i < spans.length; i++)
      spans[i].style.color = '#3984c6';
  }
};

// get a decent name for a QL
function qlName(name) {
  // trim and normalise space
  var s = name.replace(/^\s+/, '').replace(/\s+$/, '').replace(/\s+/g, ' ');
  var m, r;

  // "SG" style name
  if((m = /^{(.+)}$/.exec(s)))
    r = m[1].replace(/^\s/, '').replace(/\s$/, '').toUpperCase();
  else if((m = /^():$/.exec(s)))
    r = m[1].replace(/\s$/, '');
  else
    r = s;

  if(r.length == 0)
    r = null;

  return r;
}

function registerQL(name, ql, spans) {
  var qlid = qls.length;
  var listener = function() { highlightQL(qlid); };
  name = qlName(name);
  if(!name)
    name = qlid;
  var title = 'Quick List: ' + name;

  //console.log('match name ' + name + ': [' + ql + ']');
  var img = document.createElement('img');
  img.src = chrome.extension.getURL('icons/16.png');
  img.alt = 'QL';
  spans[0].insertBefore(img, spans[0].firstChild);
  for(var i = 0; i < spans.length; i++) {
    var span = spans[i];
    span.addEventListener('mouseover', listener, false);
    span.title = title;
  }

  qls.push({ name: name, ql: ql, spans: spans });
}

function run() {
  // find the tabstyle table
  var tables = document.getElementsByClassName('tabstyle');
  for(var i = 0; i < tables.length; i++) {

    // the infamous QL regexp
    var rx = /(\S[^\n]*\n)?\s*((?:d|r)\s*;\s*m?\s*;\s*t?\s*;\s*r?\s*;\s*[efn]*\s*;\s*[feun]*\s*;\s*b?\s*;\s*(?:f(?::\d*)?)?\s*;\s*(?:e(?::\d*)?)?\s*;\s*(?:u(?::\d*)?)?\s*;\s*(?:n(?::\d*)?)?\s*;\s*(?:(?:g|l):\d+)?\s*;\s*[0-6]*\s*;\s*(?:\d+(?:\s*,\s*\d+)*)?\s*;\s*(?:\d+(?:\s*,\s*\d+)*)?\s*;\s*[fn]*\s*;\s*[feun]*\s*;\s*(?:(?:g|l):\d+)?\s*;\s*[0-6]*\s*;\s*(?:\d+(?:\s*,\s*\d+)*)?\s*;\s*(?:\d+(?:\s*,\s*\d+)*)?\s*;\s*\d+)/g;
    var element = tables[i];
    var slicer = new TreeSlicer(element);

    var m;
    while((m = rx.exec(slicer.text))) {
      var ql = m[2];
      var offset = m.index + m[0].length - ql.length;
      //console.log('match name ' + name + ': [' + ql + ']');
      var spans = slicer.slice(offset, offset + ql.length);
      registerQL(m[1], ql, spans);
    }
  }
}

run();
