var port;
var configmap;

function makeQLTR(doc, ql) {
  var tr = doc.createElement('tr');
  var td = doc.createElement('td');
  var b = doc.createElement('b');
  b.appendChild(doc.createTextNode('Alliance ' + ql.name));
  td.appendChild(b);
  tr.appendChild(td);

  td = doc.createElement('td');
  td.appendChild(doc.createTextNode('Copy to quicklist field'));
  tr.appendChild(td);

  td = doc.createElement('td');
  var input = doc.createElement('input');
  input.type = 'submit';
  input.name = 'apply' + ql.name.replace(/\s/g, '-');
  input.value = 'Apply ' + ql.name;
  td.appendChild(input);
  tr.appendChild(td);

  return tr;
}

function setupUI(qls) {
  // find the table (or the tbody, rather) which contains the the
  // legend "Ambush mode". We'll add our stuff at the end of it.
  // XXX - changed to View ambush settings to work while on ambush..

  var xpr = document.evaluate("//tbody[tr/th = 'View ambush settings']",
                              document, null, XPathResult.ANY_UNORDERED_NODE_TYPE, null);
  var container = xpr.singleNodeValue;
  if(container) {
    var tr = document.createElement('tr');
    var th = document.createElement('th');
    th.appendChild(document.createTextNode('Ambush presets'));
    tr.appendChild(th);
    container.appendChild(tr);

    tr = document.createElement('tr');
    var td = document.createElement('td');
    var table = document.createElement('table');
    var tbody = document.createElement('tbody');
    table.appendChild(tbody);
    td.appendChild(table);
    tr.appendChild(td);
    container.appendChild(tr);

    for(var i = 0; i < qls.length; i++) {
      tr = makeQLTR(document, qls[i]);
      tbody.appendChild(tr);
    }
  }
}

function messageHandler(msg) {
  if(msg.op == 'updateValue') {
    if(configmap[msg.key] == 'allianceQLs')
      setupUI(JSON.parse(msg.value));
  }
}

function run() {
  var universe = universeName();
  configmap = new Object();
  configmap[ 'allianceQLs' + universe ] = 'allianceQLs';

  port = chrome.extension.connect();
  port.onMessage.addListener(messageHandler);
  port.postMessage({ op: 'subscribe', keys: Object.keys(configmap) });
}

run();
