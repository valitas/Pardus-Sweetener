// Pardus Sweetener
// The wiring of the options page.

function PSOptionsPageDriver(doc) { this.initialise(doc); }
PSOptionsPageDriver.prototype = {
  initialise: function(doc) {
    this.doc = doc;
    doc.addEventListener('DOMContentLoaded',
                         this.onDOMContentLoaded.bind(this));
  },

  onDOMContentLoaded: function() {
    this.controls = new Object();
    var doc = this.doc, controls = this.controls, keys, i, end;

    // Find all these elements in the document, save references to
    // them in own object properties.
    keys = [ 'showAlarmGroup', 'showCombatGroup', 'showGeneralGroup',
             'showHelpGroup',
             'alarmGroup', 'combatGroup', 'generalGroup', 'helpGroup',
             'testAlarm', 'testNotification', 'version' ];
    for(i = 0, end = keys.length; i < end; i++) {
      var key = keys[i];
      this[key] = doc.getElementById(key);
    }

    // Find all these elements in the document, save references to
    // them in this.controls, and install event listeners.
    keys = [ 'muteAlarm', 'alarmSound', 'alarmCombat', 'alarmAlly',
             'alarmWarning', 'alarmPM', 'alarmMission',
             'alarmTrade', 'alarmPayment', 'desktopCombat',
             'desktopAlly', 'desktopWarning', 'desktopPM',
             'desktopMission', 'desktopTrade', 'desktopPayment',
             'clockUTC', 'clockAP', 'clockB', 'clockP', 'clockS',
             'clockL', 'clockE', 'clockN', 'clockZ', 'clockR',
             'pvpMissileAutoAll', 'pvpHighestRounds',
             'pvmMissileAutoAll', 'pvmHighestRounds',
             'pvbMissileAutoAll', 'displayDamage', 'autobots',
             'autobotsArtemisPreset', 'autobotsArtemisPoints',
             'autobotsArtemisStrength', 'autobotsOrionPreset',
             'autobotsOrionPoints', 'autobotsOrionStrength',
             'autobotsPegasusPreset', 'autobotsPegasusPoints',
             'autobotsPegasusStrength', 'navEquipmentLink',
             'navPlanetTradeLink', 'navSBTradeLink',
             'navBldgTradeLink', 'navBMLink', 'navHackLink',
             'navBBLink', 'navShipLinks', 'overrideAmbushRounds',
             'allianceQLsArtemisEnabled',
             'personalQLArtemisEnabled', 'personalQLArtemis',
             'allianceQLsOrionEnabled', 'personalQLOrionEnabled',
             'personalQLOrion', 'allianceQLsPegasusEnabled',
             'personalQLPegasusEnabled', 'personalQLPegasus',
             'miniMap', 'sendmsgShowAlliance' ];
    for(i = 0, end = keys.length; i < end; i++) {
      var key = keys[i];
      var control = doc.getElementById(key);
      if(control) {
        controls[key] = control;
        switch(control.type) {
        case 'checkbox':
          control.addEventListener('click', this.onCheckboxClick.bind(this));
          break;
        case 'select-one':
          control.addEventListener('change', this.onControlInput.bind(this));
          break;
        case 'text':
        case 'textarea':
          control.addEventListener('input', this.onControlInput.bind(this));
        }
      }
    }

    this.version.textContent = chrome.runtime.getManifest().version;

    // Install additional listeners
    this.wireGroupSwitch(this.showAlarmGroup, this.alarmGroup);
    this.wireGroupSwitch(this.showCombatGroup, this.combatGroup);
    this.wireGroupSwitch(this.showGeneralGroup, this.generalGroup);
    this.wireGroupSwitch(this.showHelpGroup, this.helpGroup);
    this.testAlarm.
      addEventListener('click', this.onTestAlarmClick.bind(this));
    controls.alarmSound.
      addEventListener('change', this.disableTestAlarm.bind(this));
    this.testNotification.
      addEventListener('click', this.onTestNotificationClick.bind(this));
    controls.muteAlarm.
      addEventListener('click', this.updateAlarmControlsDisable.bind(this));
    controls.autobots.
      addEventListener('click', this.updateAutobotControlsDisable.bind(this));
    this.wireAutobotsPreset(controls.autobotsArtemisPreset,
                            controls.autobotsArtemisPoints);
    this.wireAutobotsPreset(controls.autobotsOrionPreset,
                            controls.autobotsOrionPoints);
    this.wireAutobotsPreset(controls.autobotsPegasusPreset,
                            controls.autobotsPegasusPoints);
    this.wireQLControls(controls.personalQLArtemisEnabled,
                        controls.personalQLArtemis);
    this.wireQLControls(controls.personalQLOrionEnabled,
                        controls.personalQLOrion);
    this.wireQLControls(controls.personalQLPegasusEnabled,
                        controls.personalQLPegasus);

    // Connect to background page.
    this.port = chrome.extension.connect();
    this.port.onMessage.addListener(this.messageHandler.bind(this));
    this.port.postMessage({ op: 'requestList', name: 'alarmSound' });
    // Note keys is still set to the last list of keys we used above
    this.port.postMessage({ op: 'subscribe', keys: keys });
  },

  // A shorthand, to simplify setup above
  wireGroupSwitch: function(button, group) {
    button.addEventListener('click',
                            this.onShowGroupClick.bind(this, button, group));
  },
  // Another shorthand
  wireAutobotsPreset: function(preset, points) {
    preset.addEventListener('change',
                            this.onAutobotsPresetChange.bind(this,
                                                             preset, points));
    points.addEventListener('input',
                            this.onAutobotsPointsInput.bind(this,
                                                            preset, points));
  },
  // And another shorthand
  wireQLControls: function(enabled, ql) {
    enabled.addEventListener('change',
                             this.onQLEnabledClick.bind(this, enabled, ql));
  },

  onShowGroupClick: function(groupButton, group) {
    var i, end, keys;
    keys = ['showAlarmGroup', 'showCombatGroup', 'showGeneralGroup',
            'showHelpGroup'];
    for(i = 0, end = keys.length; i < end; i++)
      this[keys[i]].parentNode.classList.remove('selected');
    keys = ['alarmGroup', 'combatGroup', 'generalGroup', 'helpGroup'];
    for(i = 0, end = keys.length; i < end; i++)
      this[keys[i]].classList.remove('selected');
    groupButton.parentNode.classList.add('selected');
    group.classList.add('selected');
    group.scrollIntoView(true);
  },

  disableTestAlarm: function() {
    this.port.postMessage({ op: 'stopAlarm' });
    this.testAlarm.value = 'Test';
    this.testAlarm.disabled = true;
  },

  onTestAlarmClick: function() {
    if(this.testAlarm.value == 'Stop') {
      this.port.postMessage({ op: 'stopAlarm' });
      this.testAlarm.value = 'Test';
    }
    else {
      var i = this.controls.alarmSound.selectedIndex;
      if(i >= 0) {
        this.testAlarm.value = 'Stop';
        this.port.postMessage({ op: 'soundAlarm' });
      }
    }
  },

  onTestNotificationClick: function() {
    this.port.postMessage({ op: 'testNotification' });
  },

  onCheckboxClick: function(e) {
    this.port.postMessage({ op: 'setValue',
                            key: e.target.id, value: e.target.checked });
  },

  onControlInput: function(e) {
    this.port.postMessage({ op: 'setValue',
                            key: e.target.id, value: e.target.value });
  },

  messageHandler: function(msg) {
    var control;
    switch(msg.op) {
    case 'updateValue':
      control = this.controls[msg.key];
      if(control)
        this.updateControlState(control, msg.value);
      break;
    case 'updateList':
      control = this.controls[msg.name];
      if(control)
        this.populateSelectControl(control, msg.list);
      break;
    case 'sampleReady':
      if(this.testAlarm)
        this.testAlarm.disabled = false;
    }
  },

  updateControlState: function(control, value) {
    switch(control.type) {
    case 'checkbox':
      control.checked = value;
      switch(control.id) {
      case 'autobots':
        this.updateAutobotControlsDisable();
        break;
      case 'muteAlarm':
        this.updateAlarmControlsDisable();
        break;
      case 'personalQLArtemisEnabled':
      case 'personalQLOrionEnabled':
      case 'personalQLPegasusEnabled':
        this.updateQLControlsDisable();
        break;
      }
      break;
    case 'select-one':
      this.updateSelectState(control, value);
      break;
    case 'text':
    case 'textarea':
      control.value = value;
    }
  },

  // Find the option with a given value (not name or id), and select it
  updateSelectState: function(control, value) {
    var opts = control.options;
    for(var i = 0; i < opts.length; i++) {
      var opt = opts[i];
      if(opt.value == value) {
        opt.selected = true;
        break;
      }
    }
  },

  populateSelectControl: function(control, list) {
    while(control.hasChildNodes())
      control.removeChild(control.firstChild);

    var doc = control.ownerDocument;

    for(var i = 0; i < list.length; i++) {
      var entry = list[i];
      var o = doc.createElement('option');
      o.setAttribute('value', entry.id);
      o.appendChild(doc.createTextNode(entry.name));
      control.appendChild(o);
    }
  },

  updateAlarmControlsDisable: function() {
    var disabled = this.controls.muteAlarm.checked;
    var keys = [ 'alarmSound', 'alarmCombat', 'alarmAlly',
                 'alarmWarning', 'alarmPM', 'alarmMission',
                 'alarmTrade', 'alarmPayment' ];

    for(var i = 0; i < keys.length; i++)
      this.controls[keys[i]].disabled = disabled;
    if(disabled)
      this.disableTestAlarm();
    else
      this.testAlarm.disabled = false;
  },

  updateAutobotControlsDisable: function() {
    var disabled = !this.controls.autobots.checked;
    var keys = [ 'autobotsArtemisPreset', 'autobotsArtemisPoints',
                 'autobotsArtemisStrength',
                 'autobotsOrionPreset',   'autobotsOrionPoints',
                 'autobotsOrionStrength',
                 'autobotsPegasusPreset', 'autobotsPegasusPoints',
                 'autobotsPegasusStrength' ];

    for(var i = 0, end = keys.length; i < end; i++)
      this.controls[keys[i]].disabled = disabled;
  },

  onAutobotsPresetChange: function(preset, points) {
    var v = parseInt(preset.value);
    if(v > 0)
      points.value = v;
    // XXX - is this really necessary? doesn't the above fire a change
    // event on the points field?
    this.port.postMessage({ op: 'setValue', key: points.id, value: v });
  },

  onAutobotsPointsInput: function(preset, points) {
    if(parseInt(points.value) != parseInt(preset.value)) {
      preset.selectedIndex = 0;
      this.port.postMessage({ op: 'setValue', key: preset.id, value: 0 });
    }
  },

  onQLEnabledClick: function(enabled_checkbox, ql_field) {
    ql_field.disabled = !enabled_checkbox.checked;
  },

  updateQLControlsDisable: function() {
    var controls = this.controls;
    controls.personalQLArtemis.disabled =
      !controls.personalQLArtemisEnabled.checked;
    controls.personalQLOrion.disabled =
      !controls.personalQLOrionEnabled.checked;
    controls.personalQLPegasus.disabled =
      !controls.personalQLPegasusEnabled.checked;
  }
};

var ps_pagedriver = new PSOptionsPageDriver(document);
