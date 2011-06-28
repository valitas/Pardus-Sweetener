// Pardus Sweetener
// The wiring of the options page.


function Options(doc) {
  this.doc = doc;

  // Fetch all these elements from the options document, so we don't
  // have to look for them each time we need them.
  var a = [ 'alarm_combat', 'alarm_warn', 'alarm_ally',
            'alarm_pm', 'alarm_mission', 'alarm_trade',
            'alarm_sound_select', 'alarm_test',
            'desktop_combat', 'desktop_warn', 'desktop_ally',
            'desktop_pm', 'desktop_mission', 'desktop_trade', 'desktop_test',
            'clock_utc', 'clock_ap', 'clock_b', 'clock_p',
            'clock_s', 'clock_l', 'clock_e', 'clock_n',
            'clock_z', 'clock_r' ];
  for(var i = 0; i < a.length; i++) {
    var s = a[i];
    this[s] = doc.getElementById(s);
    if(!this[s])
      console.log('OOPS: ' + s);
  }

  this.populateSoundSelect();
  this.loadAlarmEvents();
  this.loadDesktopEvents();
  this.loadClockSettings();
}


// I. Methods called from the options page


Options.prototype.stopAlarm = function() {
  chrome.extension.getBackgroundPage().stopAlarm();
  this.alarm_test.value = 'Test';
};

Options.prototype.testAlarm = function() {
  if(this.alarm_test.value == 'Stop') {
    this.stopAlarm();
  }
  else {
    var i = this.alarm_sound_select.selectedIndex;
    if(i >= 0) {
      this.alarm_test.value = 'Stop';
      chrome.extension.getBackgroundPage().soundAlarm();
    }
  }
};

Options.prototype.testNotification = function() {
  chrome.extension.getBackgroundPage().showNotification('Notification test',
                                                        'A sample desktop notification.');
};


// II. Methods to load/update localStorage


Options.prototype.loadAlarmEvents = function() {
  this.loadEvents('alarm', { 'combat': true });
};

Options.prototype.updateAlarmEvents = function() {
  this.updateEvents('alarm');
};

Options.prototype.loadDesktopEvents = function() {
  this.loadEvents('desktop', { 'combat':  true, 'warn':  true,
                               'ally':    true, 'pm':    true,
                               'mission': true, 'trade': false });
};

Options.prototype.updateDesktopEvents = function() {
  this.updateEvents('desktop');
};

Options.prototype.updateAlarmSound = function() {
  this.stopAlarm();
  this.alarm_sound_select.disable = true;
  this.alarm_test.disable = true;
  var id = this.alarm_sound_select.value;
  localStorage.alarmSound = id;
  var self = this;
  chrome.extension.getBackgroundPage().selectSound(id,
    function() {
      self.alarm_sound_select.disable = false; // XXX- huh?
      self.alarm_test.disable = false;
    });
};

Options.prototype.loadClockSettings = function() {
  var s = localStorage.clocks;
  if(s) {
    var clocks = JSON.parse(s);
    for(var i = 0; i < clocks.length; i++) {
      var c = clocks[i];
      var e = this[ 'clock_' + c ];
      if(e)
        e.checked = true;
    }
  }
  // else default is no clocks, so we're done
};

Options.prototype.updateClockSettings = function() {
  var clocks_available = [ 'utc', 'ap', 'b', 'p', 's', 'l', 'e', 'n', 'z', 'r' ];
  var clocks = new Array();

  for(var i = 0; i < clocks_available.length; i++) {
    var c = clocks_available[i];
    var e = this[ 'clock_' + c ];
    if(e && e.checked)
      clocks.push(c);
  }

  if(clocks.length > 0)
    localStorage.clocks = JSON.stringify(clocks);
  else
    localStorage.removeItem('clocks');
};


// III. Stuff not really useful outside of this object.
// Consider the following not part of the public interface.


Options.prototype.populateSoundSelect = function() {
  while(this.alarm_sound_select.hasChildNodes()) {
    this.alarm_sound_select.removeChild(this.alarm_sound_select.firstChild);
  }

  var sounds = chrome.extension.getBackgroundPage().availableSounds();
  var active = chrome.extension.getBackgroundPage().selectedSound();

  for(var i = 0; i < sounds.length; i++) {
    var s = sounds[i];
    var o = this.doc.createElement('option');
    o.setAttribute('value', s.id);
    o.appendChild(this.doc.createTextNode(s.name));
    this.alarm_sound_select.appendChild(o);
    if(s.id == active)
      o.selected = true;
  }
};

Options.prototype.loadEvents = function(prefix, dfault) {
  var bg = chrome.extension.getBackgroundPage();
  var lsname = prefix + 'Events';
  var s = localStorage[lsname];
  var events;

  if(s)
    events = bg.expandEventMask(parseInt(s));
  else {
    events = dfault;
    localStorage[lsname] = String(bg.computeEventMask(events));
  };

  this[ prefix + '_combat'  ].checked = events.combat;
  this[ prefix + '_warn'    ].checked = events.warn;
  this[ prefix + '_ally'    ].checked = events.ally;
  this[ prefix + '_pm'      ].checked = events.pm;
  this[ prefix + '_mission' ].checked = events.mission;
  this[ prefix + '_trade'   ].checked = events.trade;
};

Options.prototype.updateEvents = function(prefix) {
  var events = { 'combat':  this[ prefix + '_combat'  ].checked,
                 'warn':    this[ prefix + '_warn'    ].checked,
                 'ally':    this[ prefix + '_ally'    ].checked,
                 'pm':      this[ prefix + '_pm'      ].checked,
                 'mission': this[ prefix + '_mission' ].checked,
                 'trade':   this[ prefix + '_trade'   ].checked };
  var mask = chrome.extension.getBackgroundPage().computeEventMask(events);
  localStorage[ prefix + 'Events' ] = String(mask);
};


// IV. Start the ball running.


var ps_opts;
function init() {
  ps_opts = new Options(document);
}
