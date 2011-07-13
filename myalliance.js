// load universe.js and slicer.js before this

var port, qls, qlspans, highlighted_ql;

function highlightQL(name) {
  if(name == highlighted_ql)
    return;

  var spans, i;

  if(highlighted_ql) {
    spans = qlspans[highlighted_ql];
    if(spans)
      for(i = 0; i < spans.length; i++)
        spans[i].style.color = 'inherit';
  }

  spans = qlspans[name];
  if(spans) {
    highlighted_ql = name;
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
  else if((m = /^(.*):$/.exec(s)))
    r = m[1].replace(/\s$/, '');
  else
    r = s;

  if(r.length == 0)
    r = null;

  return r;
}

function registerQL(name, ql, spans) {
  ql = ql.replace(/\s+/g, '');
  if(!ql || ql.length == 0)
    // need a valid QL
    return;

  name = qlName(name);
  if(!name || qlspans[name])
    // need a valid unique name
    return;

  var listener = function() { highlightQL(name); };
  var title = 'Quick List: ' + name;
  var mark = spans[0].firstChild;
  var img = document.createElement('img');
  img.src = chrome.extension.getURL('icons/16.png');
  img.alt = title;
  img.title = title;
  spans[0].insertBefore(img, mark);
  spans[0].insertBefore(document.createTextNode(' '), mark);
  for(var i = 0; i < spans.length; i++) {
    var span = spans[i];
    span.addEventListener('mouseover', listener, false);
    span.title = title;
  }

  qls.push({ name: name, ql: ql });
  qlspans[name] = spans;
}

function parseQLs() {
  // find the tabstyle table
  var tables = document.getElementsByClassName('tabstyle');
  for(var i = 0; i < tables.length; i++) {

    // the infamous QL regexp
    var rx = /(\S[^\n]*\n)\s*((?:d|r)\s*;\s*m?\s*;\s*t?\s*;\s*r?\s*;\s*[efn]*\s*;\s*[feun]*\s*;\s*b?\s*;\s*(?:f(?::\d*)?)?\s*;\s*(?:e(?::\d*)?)?\s*;\s*(?:u(?::\d*)?)?\s*;\s*(?:n(?::\d*)?)?\s*;\s*(?:(?:g|l):\d+)?\s*;\s*[0-6]*\s*;\s*(?:\d+(?:\s*,\s*\d+)*)?\s*;\s*(?:\d+(?:\s*,\s*\d+)*)?\s*;\s*[fn]*\s*;\s*[feun]*\s*;\s*(?:(?:g|l):\d+)?\s*;\s*[0-6]*\s*;\s*(?:\d+(?:\s*,\s*\d+)*)?\s*;\s*(?:\d+(?:\s*,\s*\d+)*)?\s*;\s*\d+)/g;
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

  if(qls.length > 0) {
    var universe = universeName();
    port.postMessage({ op: 'setValue',
                       key: 'allianceQLs' + universe,
                       value: JSON.stringify(qls) });
    port.postMessage({ op: 'setValue',
                       key: 'allianceQLs' + universe + 'MTime',
                       value: Math.floor(Date.now() / 1000) });

    var msg;
    if(qls.length == 1)
      msg = 'Registered one alliance quick list.';
    else
      msg = 'Registered ' + qls.length + ' alliance quick lists.';
    port.postMessage({ op:       'showNotification',
                       title:    'Alliance Quick Lists',
                       message:  msg,
                       duration: 10000 });
  }
}

function run() {
  port = chrome.extension.connect();
  qls = new Array();
  qlspans = new Object();

  parseQLs();
}

run();
