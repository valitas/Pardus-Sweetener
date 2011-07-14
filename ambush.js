function PSWAmbushScreenDriver(doc) {
  this.doc = doc;

  var universe = universeName();
  this.configmap = new Object();
  this.configmap[ 'allianceQLs' + universe + 'Enabled' ] = 'allianceQLsEnabled';
  this.configmap[ 'allianceQLs' + universe             ] = 'allianceQLs';
  this.configmap[ 'allianceQLs' + universe + 'MTime'   ] = 'allianceQLsMTime';
  this.configmap[ 'personalQL' + universe + 'Enabled'  ] = 'personalQLEnabled';
  this.configmap[ 'personalQL' + universe              ] = 'personalQL';

  var keys = Object.keys(this.configmap);

  this.parameter_count = keys.length;
  this.config = new Object();
  this.addedElements = new Array();

  this.port = chrome.extension.connect();

  var self = this;

  this.port.onMessage.addListener(function(msg) { self[ msg.op + 'MessageHandler' ](msg); });
  this.port.postMessage({ op: 'subscribe', keys: keys });
}

PSWAmbushScreenDriver.prototype.updateValueMessageHandler = function(msg) {
  var key = this.configmap[msg.key];
  if(key)
    this.config[key] = msg.value;
  if(Object.keys(this.config).length >= this.parameter_count)
    this.configure();
};

// called when configuration is complete
PSWAmbushScreenDriver.prototype.configure = function() {
  this.removeUI();
  if(this.config.allianceQLsEnabled) {
    this.scanPage();
    if(this.ready) {
      this.setupAQLsUI(JSON.parse(this.config.allianceQLs),
                       parseInt(this.config.allianceQLsMTime));
    }
  }
};

PSWAmbushScreenDriver.prototype.removeUI = function() {
  while(this.addedElements.length > 0) {
    var elt = this.addedElements.pop();
    elt.parentNode.removeChild(elt);
  }
};

// Finds elements we're interested in this page:
// * the form named 'modes', which we submit when we have to
// * the tbody of the table containing the legend ('Ambush mode'),
//   which is where we append our stuff
// * the 'readlist' text area, which is where we paste QLs
PSWAmbushScreenDriver.prototype.scanPage = function(msg) {
  if(!this.scanned) {
    this.scanned = true;
    var form = this.doc.forms.modes;
    if(form) {
      var xpr = this.doc.evaluate("table/tbody[tr/th = 'Ambush mode']",
                                  form, null, XPathResult.ANY_UNORDERED_NODE_TYPE, null);
      this.target_tbody = xpr.singleNodeValue;
      if(this.target_tbody) {
        this.ta = form.elements['readlist'];
        if(this.ta) {
          this.submit = form.elements['apply_ql'];
          if(this.submit)
            this.ready = true;
        }
      }
    }
  }
};

// returns two TRs - the header, and the content one with buttons and stuff
PSWAmbushScreenDriver.prototype.setupAQLsUI = function(qls, mtime) {
  var tr = this.doc.createElement('tr');
  var th = this.doc.createElement('th');
  th.appendChild(this.doc.createTextNode('Alliance quick lists'));
  tr.appendChild(th);
  this.target_tbody.appendChild(tr);
  this.addedElements.push(tr);

  tr = this.doc.createElement('tr');
  var td = this.doc.createElement('td');
  var div = this.doc.createElement('div');
  var b = this.doc.createElement('b');
  div.appendChild(b);
  td.appendChild(div);
  td.align = 'center';
  tr.appendChild(td);
  this.target_tbody.appendChild(tr);
  this.addedElements.push(tr);

  var age = Math.floor(Date.now() / 1000) - mtime;
  if(age < 0)
    age = 0;
  if(qls && qls.length > 0 && mtime > 0) {
    var table = this.doc.createElement('table');
    var tbody = this.doc.createElement('tbody');
    b.appendChild(this.doc.createTextNode('Quick lists last updated: ' + this.timeAgo(age)));
    table.appendChild(tbody);
    td.appendChild(table);

    for(var i = 0; i < qls.length; i++) {
      var ql = qls[i];
      tr = this.makeAQLInnerTR(ql.name, ql.ql);
      tbody.appendChild(tr);
    }
  }
  else {
    var a = this.doc.createElement('a');
    a.href = 'myalliance.php';
    a.appendChild(this.doc.createTextNode('My Alliance'));
    b.appendChild(
      this.doc.createTextNode('No alliance QLs on record. You may want to fetch some from your '));
    b.appendChild(a);
    b.appendChild(this.doc.createTextNode(' page.'));
    b.style.color = 'red';
  }
};

PSWAmbushScreenDriver.prototype.makeAQLInnerTR = function(qlname, ql) {
  var tr = this.doc.createElement('tr');
  var td = this.doc.createElement('td');
  var img = this.doc.createElement('img');
  img.src = chrome.extension.getURL('icons/viewup.png'); // XXX not very self-contained, this
  img.alt = 'view';
  img.title = 'Copy ' + qlname + ' to quicklist field';
  var ta = this.ta;
  var rows = 2 + Math.floor(ql.length / 80);
  img.addEventListener('click', function() {
                         ta.value = ql;
                         // XXX - maybe we should make this enlargement configurable
                         ta.cols = 80;
                         ta.rows = rows;
                       }, false);
  td.appendChild(img);
  tr.appendChild(td);

  td = this.doc.createElement('td');
  var input = this.doc.createElement('input');
  input.type = 'button';
  input.name = 'apply' + qlname.replace(/\s/g, '-');
  input.value = 'Apply ' + qlname;
  var submit = this.submit;
  input.addEventListener('click', function() { ta.value = ql; submit.click(); }, false);
  td.appendChild(input);
  tr.appendChild(td);

  return tr;
};

PSWAmbushScreenDriver.prototype.timeAgo = function(seconds) {
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
};

var pswAmbushScreenDriver = new PSWAmbushScreenDriver(document);
