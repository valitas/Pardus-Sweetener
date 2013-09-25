// Display the recipient's alliance on the sendmsg form.
// This is RIDICULOUSLY overengineered, don't laugh.

function PSSendMsgPageDriver(doc) { this.initialise(doc); }

PSSendMsgPageDriver.prototype = {

  // We rely on Chrome to call us after DOM is ready.
  initialise: function(doc) {
    this.doc = doc;
    this.port = chrome.extension.connect();
    this.port.onMessage.addListener(this.onPortMessage.bind(this));
    this.port.postMessage({ op: 'subscribe', keys: [ 'sendmsgShowAlliance' ] });
    this.sweeten();
  },

  onPortMessage: function(msg) {
    if(msg.op == 'updateValue' && msg.key == 'sendmsgShowAlliance') {
      if(msg.value)
        this.sweeten();
      else
        this.unsweeten();
    }
  },

  sweeten: function() {
    if(this.sweetened)
      return;

    // The recipient field is contained in a TD. The next TD should
    // contain the mugshot, and the mugshot's alt (or title) should
    // contain the alliance name, which will be the text after the
    // dash. Bail out if any of these assumptions doesn't hold.
    var doc = this.doc,
        recipient = doc.getElementById('recipient2');
    if(!recipient)
      return;
    var recipient_td = recipient.parentNode;
    if(!recipient_td || recipient_td.tagName != 'TD')
      return;
    var recipient_tr = recipient_td.parentNode;
    if(!recipient_tr || recipient_tr.tagName != 'TR')
      return;
    var mugshot_td = recipient_td.nextElementSibling;
    if(!mugshot_td || mugshot_td.tagName != 'TD' || mugshot_td.rowSpan != 2)
      return;
    var mugshot = mugshot_td.firstElementChild;
    if(!mugshot || mugshot.tagName != 'IMG' || !mugshot.alt)
      return;
    var m = /^[^-]+-\s*(.+?)\s*$/.exec(mugshot.alt);
    if(!m)
      return;
    var alliance_name = m[1];

    // Ok all seems good, make the changes
    var tr = doc.createElement('tr'),
        td = doc.createElement('td');
    tr.appendChild(td);
    td = doc.createElement('td');
    if(alliance_name == 'No alliance participation') {
      var i = doc.createElement('i');
      i.textContent = 'No alliance participation';
      td.appendChild(i);
    }
    else
      td.textContent = alliance_name;
    tr.appendChild(td);
    mugshot_td.rowSpan = 3;
    recipient_tr.parentNode.insertBefore(tr, recipient_tr.nextSibling);

    // And remember what we need to undo them
    this.allianceTR = tr;
    this.mugshotTD = mugshot_td;
    this.sweetened = true;
  },

  unsweeten: function() {
    if(!this.sweetened)
      return;

    this.allianceTR.parentNode.removeChild(this.allianceTR);
    this.mugshotTD.rowSpan = 2;
    delete this.allianceTR;
    delete this.mugshotTD;
    delete this.sweetened;
  }

};

var ps_pagedriver = new PSSendMsgPageDriver(document);
