var port;
var configmap;
var config;

function timeAgo(seconds) {
  if(seconds < 60)
    return 'just now';

  var n;
  if(seconds < 3600) {
    n = Math.round(seconds/60);
    return (n == 1 ? 'a minute' : String(n) + ' minutes') + ' ago';
  }

  if(seconds < 86400) {
    n = Math.round(seconds/3600);
    return (n == 1 ? 'an hour' : String(n) + ' hours') + ' ago';
  }

  n = Math.round(seconds/86400);
  return (n == 1 ? 'yesterday' : String(n) + ' days ago');
}

function makeAQLInnerTR(doc, ql) {
  var tr = doc.createElement('tr');
  var td = doc.createElement('td');
  var input = doc.createElement('input');

  input.type = 'submit';
  input.name = 'apply' + ql.name.replace(/\s/g, '-');
  input.value = 'Apply ' + ql.name;
  td.appendChild(input);
  tr.appendChild(td);

  td = doc.createElement('td');
  var img = doc.createElement('img');
  img.src = chrome.extension.getURL('icons/viewup.png');
  img.alt = 'view';
  img.title = 'Copy ' + ql.name + ' to quicklist field';
  td.appendChild(img);
  tr.appendChild(td);

  return tr;
}

// returns two TRs - the header, and the content one with buttons and stuff
function makeAQLTRs(doc, qls, mtime) {
  var r = new Array(2);
  var tr = doc.createElement('tr');
  var th = doc.createElement('th');
  th.appendChild(doc.createTextNode('Alliance quick lists'));
  tr.appendChild(th);
  r[0] = tr;

  tr = doc.createElement('tr');
  var td = doc.createElement('td');
  var div = doc.createElement('div');
  var b = doc.createElement('b');
  div.appendChild(b);
  td.appendChild(div);
  td.align = 'center';
  tr.appendChild(td);
  r[1] = tr;

  var age = Math.floor(Date.now() / 1000) - mtime;
  if(age < 0)
    age = 0;
  if(qls && qls.length > 0 && mtime > 0) {
    var table = doc.createElement('table');
    var tbody = doc.createElement('tbody');
    b.appendChild(doc.createTextNode('Quick lists last updated: ' + timeAgo(age)));
    table.appendChild(tbody);
    td.appendChild(table);

    for(var i = 0; i < qls.length; i++) {
      tr = makeAQLInnerTR(doc, qls[i]);
      tbody.appendChild(tr);
    }
  }
  else {
    var a = doc.createElement('a');
    a.href = 'myalliance.php';
    a.appendChild(doc.createTextNode('My Alliance'));
    b.appendChild(
      doc.createTextNode('No alliance QLs on record. You may want to fetch some from your '));
    b.appendChild(a);
    b.appendChild(doc.createTextNode(' page.'));
    b.style.color = 'red';
  }

  return r;
}

function setupAQLsUI(qls, mtime) {
  // find the table (or the tbody, rather) which contains the the
  // legend "Ambush mode". We'll add our stuff at the end of it.
  // XXX - changed to View ambush settings to work while on ambush..

  var xpr = document.evaluate("//tbody[tr/th = 'View ambush settings']",
                              document, null, XPathResult.ANY_UNORDERED_NODE_TYPE, null);
  var container = xpr.singleNodeValue;
  if(container) {
    var aqls = makeAQLTRs(document, qls, mtime);
    container.appendChild(aqls[0]);
    container.appendChild(aqls[1]);
  }
}

function messageHandler(msg) {
  if(msg.op == 'updateValue') {
    var key = configmap[msg.key];
    if(key)
      config[key] = msg.value;

    if(Object.keys(config).length >= 2) // XXX
      setupAQLsUI(JSON.parse(config.allianceQLs), parseInt(config.allianceQLsMTime));
  }
}

function run() {
  var universe = universeName();
  configmap = new Object();
  configmap[ 'allianceQLs' + universe ] = 'allianceQLs';
  configmap[ 'allianceQLs' + universe + 'MTime' ] = 'allianceQLsMTime';
  config = new Object();

  port = chrome.extension.connect();
  port.onMessage.addListener(messageHandler);
  port.postMessage({ op: 'subscribe', keys: Object.keys(configmap) });
}

run();
