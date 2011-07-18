// Pardus Sweetener
// The guts.

// Include Alarm and Notifier before this.

// The following objects have a simple duty: they convert values
// stored in localStorage to and from values we can use in the rest of
// the extension.  The method 'parse' assumes the value supplied comes
// from localStorage, so null will be assumed to mean the option
// wasn't saved yet, and the default value will be supplied. The
// objects don't access localStorage directly, because this
// translation is also useful for storage events, in which case we get
// the values through other means.

function BooleanOption(defaultValue) { this.defaultValue = defaultValue; }
BooleanOption.prototype.DICT = { 'true': true, 'false': false };
BooleanOption.prototype.stringify = function(value) { return value ? 'true' : 'false'; };
BooleanOption.prototype.parse = function(string_value) {
  var r = this.DICT[string_value];
  return r == undefined ? this.defaultValue : r;
};

function StringOption(defaultValue) { this.defaultValue = defaultValue; }
StringOption.prototype.stringify = function(value) { return value; };
StringOption.prototype.parse = function(string_value) {
  return (string_value == null) ? this.defaultValue : string_value;
};


// The main object

function PardusSweetener() {
  this.options = {
    muteAlarm:         new BooleanOption(false),
    alarmSound:        new StringOption('timex'),
    alarmCombat:       new BooleanOption(true),
    alarmAlly:         new BooleanOption(false),
    alarmWarning:      new BooleanOption(false),
    alarmPM:           new BooleanOption(false),
    alarmMission:      new BooleanOption(false),
    alarmTrade:        new BooleanOption(false),
    alarmPayment:      new BooleanOption(false),
    alarmInfo:         new BooleanOption(false),

    desktopCombat:     new BooleanOption(true),
    desktopAlly:       new BooleanOption(true),
    desktopWarning:    new BooleanOption(true),
    desktopPM:         new BooleanOption(true),
    desktopMission:    new BooleanOption(true),
    desktopTrade:      new BooleanOption(false),
    desktopPayment:    new BooleanOption(false),
    desktopInfo:       new BooleanOption(false),

    clockUTC:          new BooleanOption(false),
    clockAP:           new BooleanOption(true),
    clockB:            new BooleanOption(true),
    clockP:            new BooleanOption(true),
    clockS:            new BooleanOption(true),
    clockL:            new BooleanOption(false),
    clockE:            new BooleanOption(false),
    clockN:            new BooleanOption(false),
    clockZ:            new BooleanOption(false),
    clockR:            new BooleanOption(false),

    pvpMissileAutoAll: new BooleanOption(true),
    pvpHighestRounds:  new BooleanOption(true),
    pvmMissileAutoAll: new BooleanOption(false),
    pvmHighestRounds:  new BooleanOption(false),
    pvbMissileAutoAll: new BooleanOption(true),

    autobots:                new BooleanOption(false),
    autobotsArtemisPreset:   new StringOption('0'),
    autobotsArtemisPoints:   new StringOption('0'),
    autobotsArtemisStrength: new StringOption('36'),
    autobotsOrionPreset:     new StringOption('0'),
    autobotsOrionPoints:     new StringOption('0'),
    autobotsOrionStrength:   new StringOption('36'),
    autobotsPegasusPreset:   new StringOption('0'),
    autobotsPegasusPoints:   new StringOption('0'),
    autobotsPegasusStrength: new StringOption('36'),

    navEquipmentLink:        new BooleanOption(true),
    navPlanetTradeLink:      new BooleanOption(true),
    navSBTradeLink:          new BooleanOption(true),
    navBldgTradeLink:        new BooleanOption(true),
    navBMLink:               new BooleanOption(true),
    navHackLink:             new BooleanOption(true),
    navBBLink:               new BooleanOption(true),

    navShipLinks:            new BooleanOption(true),

    overrideAmbushRounds:    new BooleanOption(true),
    allianceQLsArtemisEnabled: new BooleanOption(true),
    allianceQLsArtemis:      new StringOption('[]'),
    allianceQLsArtemisMTime: new StringOption('0'),
    personalQLArtemisEnabled:  new BooleanOption(false),
    personalQLArtemis:       new StringOption(''),
    allianceQLsOrionEnabled: new BooleanOption(true),
    allianceQLsOrion:        new StringOption('[]'),
    allianceQLsOrionMTime:   new StringOption('0'),
    personalQLOrionEnabled:  new BooleanOption(false),
    personalQLOrion:         new StringOption(''),
    allianceQLsPegasusEnabled: new BooleanOption(true),
    allianceQLsPegasus:      new StringOption('[]'),
    allianceQLsPegasusMTime: new StringOption('0'),
    personalQLPegasusEnabled:  new BooleanOption(false),
    personalQLPegasus:       new StringOption('')
  };
  this.ports = new Array();
  this.alarm = new Alarm(this.options.alarmSound.parse(localStorage['alarmSound']));
  this.mute = this.options.muteAlarm.parse(localStorage['muteAlarm']);
  this.notifier = new Notifier();

  var self = this;
  this.storageEventListener = function(e) { self.handleStorage(e); };
  this.onConnectEventListener = function(port) { self.handleConnect(port); };

  chrome.extension.onConnect.addListener(this.onConnectEventListener);
  window.addEventListener('storage', this.storageEventListener, false);
}

PardusSweetener.prototype.handleConnect = function(port) {
  var self = this;
  var pi = { port: port, keys: new Object() };

  pi.messageListener = function(msg) { self.handleMessage(pi, msg); };
  pi.disconnectListener = function(port) { self.handleDisconnect(pi); };

  this.ports.push(pi);
  port.onDisconnect.addListener(pi.disconnectListener);
  port.onMessage.addListener(pi.messageListener);

  if(pi.port.sender && pi.port.sender.tab) {
    var tab = pi.port.sender.tab.id;
    var path = this.mute ? 'icons/19mute.png' : 'icons/19.png';
    chrome.pageAction.setIcon({ path: path, tabId: tab });
    chrome.pageAction.show(tab);
    console.log('icon ' + path + ' on tab ' + tab);
  }

  //console.log('connect - have ' + this.ports.length + ' ports');
};

PardusSweetener.prototype.handleDisconnect = function(pi) {
  for(var i = this.ports.length - 1; i >= 0; i--) {
    if(pi === this.ports[i]) {
      this.ports.splice(i, 1);
      break;
    }
  }

  // this is likely not needed but hell, lets help the garbage collector
  pi.port.onDisconnect.removeListener(pi.disconnectListener);
  pi.port.onMessage.removeListener(pi.messageListener);
  delete pi.disconnectListener;
  delete pi.messageListener;

  if(this.ports.length < 1) {
    this.alarm.switchOff();
    this.notifier.hide();
  }

  //console.log('disconnect - have ' + this.ports.length + ' ports');
};

PardusSweetener.prototype.handleMessage = function(pi, msg) {
  if(msg.op) {
    var hname = msg.op + "MsgHandler";
    if(hname in this)
      this[hname](pi, msg);
  }
};

PardusSweetener.prototype.subscribeMsgHandler = function(pi, msg) {
  var keys = msg.keys;
  if(keys && keys.length) {
    pi.keys = new Object();
    for(var i = keys.length - 1; i >= 0; i--) {
      var key = keys[i];
      var option = this.options[key];
      if(option) {
        pi.keys[key] = true;
        var v = option.parse(localStorage[key]);
        pi.port.postMessage({ op: 'updateValue', key: key, value: v });
        //console.log('subscription added to ' + key);
      }
    }
  }
};

PardusSweetener.prototype.setValueMsgHandler = function(pi, msg) {
  var option = this.options[msg.key];
  if(option) {
    var v = option.stringify(msg.value);
    localStorage[msg.key] = v;

    // some specific tweaks we do on special events..
    switch(msg.key) {
    case 'alarmSound':
      this.alarm.selectSample(v,
                              function() {
                                pi.port.postMessage({op: 'sampleReady', sample: v});
                              });
      break;
    case 'muteAlarm':
      this.mute = msg.value;
      for(var i = this.ports.length - 1; i >= 0; i--) {
        var port = this.ports[i].port;
        if(port.sender && port.sender.tab)
          chrome.pageAction.setIcon({ path: this.mute ? 'icons/19mute.png' : 'icons/19.png',
                                      tabId: port.sender.tab.id });
      }
    }

    // apparently we won't get a storage event to trigger this,
    // because that's only for changes from another window (XXX - need
    // more research into this)
    this.postUpdateValueNotifications(msg.key, msg.value, pi);
  }
};

PardusSweetener.prototype.requestListMsgHandler = function(pi, msg) {
  if(msg.name == 'alarmSound')
    pi.port.postMessage({ op: 'updateList',
                          name: 'alarmSound',
                          list: Alarm.prototype.sounds });
};

PardusSweetener.prototype.dispatchNotificationsMsgHandler = function(pi, msg) {
  //console.log('dispatch ' + JSON.stringify(msg));
  if(!this.options.muteAlarm.parse(localStorage['muteAlarm']) &&
     this.testIndicators('alarm', msg.indicators))
    this.alarm.switchOn();
  else
    this.alarm.switchOff();

  if(this.testIndicators('desktop', msg.indicators))
    this.notifier.show('Meanwhile, in Pardus...',
                       this.indicatorsToHuman(msg.character_name, msg.indicators));
  else
    this.notifier.hide();
};

PardusSweetener.prototype.soundAlarmMsgHandler = function(pi, msg) {
  if(!this.options.muteAlarm.parse(localStorage['muteAlarm']))
    this.alarm.switchOn();
};

PardusSweetener.prototype.stopAlarmMsgHandler = function(pi, msg) {
  this.alarm.switchOff();
};

PardusSweetener.prototype.testNotificationMsgHandler = function(pi, msg) {
  this.notifier.hide();
  this.notifier.show('Meanwhile, in Pardus...',
                     'You requested a sample desktop notification.');
};

PardusSweetener.prototype.showNotificationMsgHandler = function(pi, msg) {
  this.notifier.hide();
  this.notifier.show(msg.title, msg.message, msg.duration);
};

// This is supposedly called on storage events. We haven't seen one
// yet, we need to research more about this...

PardusSweetener.prototype.handleStorage = function(e) {
  var option = this.options[e.key];
  if(option)
    this.postUpdateValueNotifications(e.key, option.parse(e.newValue), null);
};

PardusSweetener.prototype.postUpdateValueNotifications = function(key, value, exclude_pi) {
  for(var i = this.ports.length - 1; i >= 0; i--) {
    var pi = this.ports[i];
    if(pi === exclude_pi)
      continue;

    // check if this port requested notification for this key; if so,
    // notify them

    if(pi.keys[key])
      pi.port.postMessage({ op: 'updateValue', key: key, value: value });
  }
};

PardusSweetener.prototype.testIndicators = function(prefix, indicators) {
  var r = false;
  for(var suffix in indicators) {
    var key = prefix + suffix;
    var option = this.options[key];
    if(option) {
      if(option.parse(localStorage[key])) {
        r = true;
        break;
      }
    }
  }
  return r;
};

PardusSweetener.prototype.indicatorsToHuman = function(character_name, indicators) {
  var a = new Array();
  var pendings, warn, notifs, stuff;

  if(indicators['Warning'])
    warn = 'There is a game warning you should see in the message frame.';
  else if(indicators['Info'])
    warn = 'There is some information for you in the message frame.';

  if(indicators['Ally'])
    a.push('alliance');
  if(indicators['PM'])
    a.push('private');
  if(a.length > 0) {
    pendings = 'unread ' + a.join(' and ') + ' messages';
    a.length = 0;
  }

  if(indicators['Trade'] || indicators['Payment'])
    a.push('money');
  if(indicators['Mission'])
    a.push('mission');
  if(a.length > 0) {
    notifs = a.join(' and ') + ' notifications';
    a.length = 0;
  }

  if(pendings)
    a.push(pendings);
  if(notifs)
    a.push(notifs);
  if(a.length > 0) {
    stuff = a.join(', and ') + '.';
    a.length = 0;
  }

  if(warn)
    a.push(warn);

  if(indicators['Combat'] || stuff) {
    if(character_name)
      a.push((warn ? 'And your' : 'Your') + ' character ' + character_name);
    else
      a.push((warn ? 'And a' : 'A') + ' character of yours');

    if(indicators['Combat']) {
      a.push('has been fighting with someone.');
      if(stuff) {
        if(character_name)
          a.push(character_name + ' also has');
        else
          a.push('You also have');
        a.push(stuff);
      }
    }
    else {
      a.push('has');
      a.push(stuff);
    }
  }

  return a.join(' ');
};


var sweetener;

function init() {
  sweetener = new PardusSweetener();
}
