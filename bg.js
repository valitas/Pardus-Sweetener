// Pardus Sweetener
// The guts.

function Alarm() {

  this.sounds = [
    { 'id': 'buzz', 'name': 'Buzzer' },
    { 'id': 'dive', 'name': 'Dive horn' },
    { 'id': 'missile', 'name': 'Missile alert' },
    { 'id': 'power', 'name': 'Power plant' },
    { 'id': 'timex', 'name': 'Timex' }
  ];

  this.soundk = new Object();
  for(var i = 0; i < this.sounds.length; i++) {
    var s = this.sounds[i];
    this.soundk[s.id] = s;
  }

  // Select the current sound. If there's no such thing,
  // pick the first on our list.

  var id = localStorage.alarmSound;
  if(!id)
    id = this.sounds[0].id;
  this.selectSample(id);
}

Alarm.prototype.selectSample = function(id, ready_callback) {
  this.switchOff();
  this.sound_id = id;
  this.sound_ready = false;
  this.sound = new Audio();
  this.sound.src = 'sounds/' + id + '.ogg';
  var self = this;
  this.sound.addEventListener('canplaythrough',
                              function() {
                                self.sound_ready = true;
                                if(ready_callback)
                                  ready_callback();
                              });
  this.sound.load();
};

Alarm.prototype.switchOff = function() {
  if(this.sound_timer) {
    clearTimeout(this.sound_timer);
    this.sound.pause();
    delete this.sound_timer;
  }
};

Alarm.prototype.switchOn = function() {
  if(this.sound_ready) {
    this.switchOff();
    this.sound.currentTime = 0;
    this.sound.loop = true;
    this.sound.play();
    // it runs for 50 seconds before turning itself off
    var self = this;
    this.sound_timer = setTimeout(function() { self.switchOff(); }, 50000);
  }
};

function Notifier() { }

Notifier.prototype.hide = function() {
  if(this.notification) {
    this.notification.cancel();
    delete this.notification;
  }
};

Notifier.prototype.show = function(title, text) {
  this.hide();

  var self = this;
  var n = webkitNotifications.createNotification('48.png', title, text);
  n.ondisplay = function() {
    setTimeout(function() {
                 if(n == self.notification)
                   self.hide();
               }, 15000);
  };

  this.notification = n;
  this.notification.show();
};

function soundAlarm() { alarm.switchOn(); }
function stopAlarm() { alarm.switchOff(); }
function selectSound(id, ready_callback) { alarm.selectSample(id, ready_callback); }
function availableSounds() { return alarm.sounds; }
function selectedSound() { return alarm.sound_id; }

function showNotification(title, text) { notifier.show(title, text); }

function computeEventMask(e) {
  return 1
    | (e.combat  ? 0x02 : 0)
    | (e.warn    ? 0x04 : 0)
    | (e.ally    ? 0x08 : 0)
    | (e.pm      ? 0x10 : 0)
    | (e.info    ? 0x20 : 0)
    | (e.trade   ? 0x40 : 0)
    | (e.mission ? 0x80 : 0);
}

function expandEventMask(mask) {
  return { 'combat':  Boolean(mask & 0x02),
           'warn':    Boolean(mask & 0x04),
           'ally':    Boolean(mask & 0x08),
           'pm':      Boolean(mask & 0x10),
           'info':    Boolean(mask & 0x20),
           'trade':   Boolean(mask & 0x40),
           'mission': Boolean(mask & 0x80) };
}

function eventsToHuman(character_name, events) {
  var a = new Array();
  var pendings, warn, notifs, stuff;

  if(events.warn)
    warn = 'There is a game warning you should see in the message frame.';
  else if(events.info)
    warn = 'There is some information for you in the message frame.';

  if(events.ally)
    a.push('alliance');
  if(events.pm)
    a.push('private');
  if(a.length > 0) {
    pendings = 'unread ' + a.join(' and ') + ' messages';
    a.length = 0;
  }

  if(events.trade)
    a.push('trade/payment');
  if(events.mission)
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

  if(events.combat || stuff) {
    if(character_name)
      a.push((warn ? warn + ' And your' : 'Your') + ' character ' + character_name);
    else
      a.push((warn ? warn + ' And a' : 'A') + ' character of yours');

    if(events.combat) {
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
}

function dispatchNotifications(character_name, events) {
  var r = false;
  var alrm = parseInt(localStorage.alarmEvents || 0);
  var desk = parseInt(localStorage.desktopEvents || 0);
  var ev = computeEventMask(events);

  if((alrm & ev) > 1) {
    alarm.switchOn();
    r = true;
  }
  else
    alarm.switchOff();

  if((desk & ev) > 1) {
    notifier.show('Meanwhile, in Pardus...',
                  eventsToHuman(character_name, events));
    r = true;
  }
  else
    notifier.hide();

  return r;
}

var alarm;
var notifier;

function init() {
  alarm = new Alarm();
  notifier = new Notifier();

  chrome.extension.onRequest.addListener(
    function(request, sender, sendResponse) {
      var r = false;

      if(request.op == 'dispatchNotifications')
        r = dispatchNotifications(request.character_name, request.events);
      else if(request.op == 'getClockSettings')
        r = localStorage.clocks;

      sendResponse(r);
    }
  );
}
