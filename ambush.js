function PSWAmbushScreenDriver(doc) {
  this.doc = doc;

  var universe = universeName();
  this.configmap = { overrideAmbushRounds:  'overrideAmbushRounds'   };
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

  if(this.config.allianceQLsEnabled || this.config.personalQLEnabled) {
    this.scanPage();
    if(this.ready)
      this.setupQLsUI(this.config.allianceQLsEnabled,
                      JSON.parse(this.config.allianceQLs),
                      parseInt(this.config.allianceQLsMTime),
                      this.config.personalQLEnabled,
                      this.config.personalQL);
  }

  if(this.config.overrideAmbushRounds) {
    this.scanPage();
    if(this.ready)
      this.selectHighestRounds();
  }
};

PSWAmbushScreenDriver.prototype.removeUI = function() {
  while(this.addedElements.length > 0) {
    var elt = this.addedElements.pop();
    elt.parentNode.removeChild(elt);
  }
};

// Finds elements we're interested in this page:
// * the TBODY of the TABLE containing the legend ('Ambush mode'),
//   which is where we do all our stuff (we call this 'container')
// * the 'readlist' textarea
// * the 'apply_ql' input
// * the 'rounds' input
PSWAmbushScreenDriver.prototype.scanPage = function(msg) {
  var elts = this.elements;
  if(elts)
    // only run once
    return;
  else
    elts = this.elements = new Object();

  var form = this.doc.forms.modes;
  // sanity check
  if(!form || form.children.length < 1 || form.children[0].children.length < 1)
    return;

  elts.container = form.children[0].children[0];
  // sanity check
  if(elts.container.tagName.toLowerCase() != 'tbody')
    return;

  elts.ta = form.elements['readlist'];
  elts.rounds = form.elements['rounds'];
  elts.apply = form.elements['apply_ql'];
  elts.confirm = form.elements['confirm'];
  // sanity check
  if(!elts.ta || !elts.rounds || !elts.apply || !elts.confirm)
    return;

  // all is good
  this.ready = true;
};

PSWAmbushScreenDriver.prototype.setupQLsUI = function(aqls_enabled, aqls, mtime,
                                                      pql_enabled, pql) {
  var container = this.elements.container;
  var first = this.elements.container.firstChild;

  var tr = this.doc.createElement('tr');
  var th = this.doc.createElement('th');
  var img = this.doc.createElement('img');
  img.src = chrome.extension.getURL('icons/16.png'); // XXX not very self-contained, this
  img.style.verticalAlign = 'middle';
  img.style.position = 'relative';
  img.style.top = '-2px';
  var font = this.doc.createElement('font');
  font.size = 3;
  font.appendChild(img);
  font.appendChild(this.doc.createTextNode(' Fast ambush options'));
  th.appendChild(font);
  tr.appendChild(th);
  container.insertBefore(tr, first);
  this.addedElements.push(tr);

  tr = this.doc.createElement('tr');
  var td = this.doc.createElement('td');
  td.align = 'center';
  //td.style.padding = '17px';

  var age = Math.floor(Date.now() / 1000) - mtime;
  if(age < 0)
    age = 0;

  if(aqls_enabled) {
    var div = this.doc.createElement('div');
    div.style.margin = '17px';

    if(aqls && aqls.length > 0 && mtime > 0) {
      var b = this.doc.createElement('b');
      var span = this.doc.createElement('span');
      span.appendChild(this.doc.createTextNode('last updated ' + this.timeAgo(age)));
      if(age > 84600)
        span.style.color = 'red';
      b.appendChild(this.doc.createTextNode('Alliance quick lists '));
      b.appendChild(span);
      b.appendChild(this.doc.createTextNode(':'));
      div.appendChild(b);
      div.appendChild(this.doc.createElement('br'));

      for(var i = 0; i < aqls.length; i++) {
        var ql = aqls[i];
        this.addQL(div, ql.name, ql.ql);
      }
    }
    else {
      var a = this.doc.createElement('a');
      a.href = '/myalliance.php';
      var b = this.doc.createElement('b');
      a.appendChild(this.doc.createTextNode('My Alliance'));
      b.appendChild(this.doc.createTextNode('No alliance quick lists on record. '
                                            + 'You may try and load some from '));
      b.appendChild(a);
      b.appendChild(this.doc.createTextNode('.'));
      div.appendChild(b);
    }

    td.appendChild(div);
  }

  if(pql_enabled) {
    var div = this.doc.createElement('div');
    div.style.margin = '17px';

    if(pql && pql.length > 0) {
      var b = this.doc.createElement('b');
      b.appendChild(this.doc.createTextNode('Personal quick list:'));
      div.appendChild(b);
      div.appendChild(this.doc.createElement('br'));
      this.addQL(div, 'Personal QL', pql);
    }
    else {
      var b = this.doc.createElement('b');
      b.appendChild(this.doc.createTextNode('No personal quick list defined. '
                                            + 'Please set one in the Pardus Sweetener options.'));
      div.appendChild(b);
    }

    td.appendChild(div);
  }

  tr.appendChild(td);
  container.insertBefore(tr, first);
  this.addedElements.push(tr);

  tr = this.doc.createElement('tr');
  td = this.doc.createElement('td');
  td.align = 'center';
  td.style.paddingBottom = '17px';
  var input = this.doc.createElement('input');
  input.type = 'submit';
  input.name = 'confirm';
  input.value = 'Lay Ambush';
  input.style.backgroundColor = '#600';
  input.style.color = '#fff';
  input.style.fontWeight = 'bold';
  input.style.padding = '3px';
  td.appendChild(input);
  tr.appendChild(td);
  container.insertBefore(tr, first);
  this.addedElements.push(tr);

  // and while we're at this, lets make the other lay ambush button red too
  this.elements.confirm.style.backgroundColor = '#600';
  this.elements.confirm.style.color = '#fff';
};

PSWAmbushScreenDriver.prototype.addQL = function(container, qlname, ql) {
  var input = this.doc.createElement('input');
  input.type = 'button';
  input.name = 'apply' + qlname.replace(/\s/g, '-');
  input.value = 'Apply ' + qlname;
  var ta = this.elements.ta;
  var submit = this.elements.apply;
  input.addEventListener('click', function() { ta.value = ql; submit.click(); }, false);
  container.appendChild(input);

  var img = this.doc.createElement('img');
  img.src = chrome.extension.getURL('icons/down.png'); // XXX not very self-contained, this
  img.alt = 'view';
  img.title = 'Copy ' + qlname + ' to quicklist field below';
  img.style.verticalAlign = 'middle';
  var rows = 2 + Math.floor(ql.length / 80);
  var scrollTo = this.scrollTo;
  img.addEventListener('click', function() {
                         ta.value = ql;
                         // XXX - maybe we should make this enlargement configurable
                         ta.cols = 80;
                         ta.rows = rows;
                         scrollTo(ta);
                       }, false);
  container.appendChild(img);

  container.appendChild(this.doc.createTextNode("\n"));
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

// utility method, may move elsewhere
PSWAmbushScreenDriver.prototype.scrollTo = function (element) {
  var x = 0, y = 0;

  while(element) {
    x += element.offsetLeft;
    y += element.offsetTop;
    element = element.offsetParent;
  }

  window.scrollTo(x,y);
};

// this could be merged with the rounds function in combat.js
PSWAmbushScreenDriver.prototype.selectHighestRounds = function () {
  var elt = this.elements.rounds;
  var highest = 0, highestElt = null;
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
};

var pswAmbushScreenDriver = new PSWAmbushScreenDriver(document);
