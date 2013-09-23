function PSPopUpPageDriver(doc) { this.initialise(doc); }

PSPopUpPageDriver.prototype = {
  initialise: function(doc) {
    this.doc = doc;
    doc.addEventListener('DOMContentLoaded',
                         this.onDOMContentLoaded.bind(this));
  },

  onDOMContentLoaded: function() {
    this.controls = new Object();
    var doc = this.doc,
        keys = [ 'muteAlarm', 'alarmCombat', 'alarmAlly', 'alarmPM' ];
    for(var i = 0, end = keys.length; i < end; i++) {
      var key = keys[i], control = doc.getElementById(key);
      this[key] = control;
      control.addEventListener('click', this.onSettingClick.bind(this));
    }

    this.testAlarm = doc.getElementById('testAlarm');
    this.testAlarm.addEventListener('click', this.onTestAlarmClick.bind(this));
    this.muteAlarm.addEventListener('click',
                                    this.updateAlarmControlsDisable.bind(this));

    this.openOptions = doc.getElementById('openOptions');
    this.openOptions.addEventListener('click', this.onOpenOptions.bind(this));

    this.port = chrome.extension.connect();
    this.port.onMessage.addListener(this.onMessage.bind(this));
    this.port.postMessage({ op: 'subscribe', keys: keys });
  },

  onSettingClick: function(event) {
    var target = event.target;
    this.port.postMessage({ op: 'setValue',
                            key: target.id,
                            value: target.checked });
  },

  onMessage: function(msg) {
    if(msg.op == 'updateValue') {
      var control = this[msg.key];
      if(control) {
        control.checked = msg.value;
        if(msg.key == 'muteAlarm')
          this.updateAlarmControlsDisable();
      }
    }
  },

  onTestAlarmClick: function() {
    if(this.testAlarm.value == 'Stop Alarm') {
      this.port.postMessage({ op: 'stopAlarm' });
      this.testAlarm.value = 'Test Alarm';
    }
    else {
      this.port.postMessage({ op: 'soundAlarm' });
      this.testAlarm.value = 'Stop Alarm';
    }
  },

  disableTestAlarm: function() {
    this.port.postMessage({ op: 'stopAlarm' });
    this.testAlarm.value = 'Test Alarm';
    this.testAlarm.disabled = true;
  },

  updateAlarmControlsDisable: function() {
    var disabled = this.muteAlarm.checked;
    var keys = [ 'alarmCombat', 'alarmAlly', 'alarmPM' ];

    for(var i = 0, end = keys.length; i < end; i++)
      this[keys[i]].disabled = disabled;
    if(disabled)
      this.disableTestAlarm();
    else
      this.testAlarm.disabled = false;
  },

  onOpenOptions: function(event) {
    event.preventDefault();
    var optionsUrl = chrome.extension.getURL('options.html');
    chrome.tabs.query({url: optionsUrl},
                      function(tabs) {
                        if(tabs.length)
                          chrome.tabs.update(tabs[0].id, {active: true});
                        else
                          chrome.tabs.create({url: optionsUrl});
                      });
  }
};

var ps_pagedriver = new PSPopUpPageDriver(document);
