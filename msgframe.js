// server reset is at 5.30 GMT/UTC every day

function APTimer() {
  this.createNode('AP', 'Time to next 24 AP and next shield recharge');
}

APTimer.prototype.createNode = function(label, title) {
  this.element = document.createElement('span');
  this.element.appendChild(document.createTextNode(' ' + label + ' '));
  var inner = document.createElement('span');
  this.textNode = document.createTextNode('-:--');
  inner.appendChild(this.textNode);
  this.element.appendChild(inner);
  this.element.appendChild(document.createTextNode(' '));
  this.element.style.margin = '0 0 0 7px';
  this.element.style.cursor = 'default';
  this.element.style.zIndex = '-1';
  this.element.title = title;
};

// 'now' is the Unix time, an integer, in seconds.
// AP ticks happen every 6 minutes, starting at minute 0.
// So period is 6m (360 s), and offset is zero
APTimer.prototype.update = function(now) {
  var next_ap = 359 - now % 360;
  this.element.style.color = this.computeColour(next_ap, 10, 30, 60);
  this.textNode.data = this.formatTime(next_ap);
};

APTimer.prototype.formatTime = function(seconds) {
  var hours = Math.floor(seconds / 3600);
  seconds -= hours*3600;
  var minutes = Math.floor(seconds / 60);
  seconds -= minutes*60;

  var s;
  if(hours > 0) {
    s = hours + ':';
    if(minutes < 10)
      s += '0';
  }
  else
    s = '';

  s += minutes;
  s += ':';
  if(seconds < 10)
    s += '0';
  s += seconds;

  return s;
};

APTimer.prototype.computeColour = function(now, red_threshold,
                                           yellow_threshold, green_threshold) {
  if(now <= red_threshold)
    return 'red';
  if(now <= yellow_threshold)
    return 'yellow';
  else if(now <= green_threshold)
    return 'lime';

  return 'inherit';
};


function BuildingTimer() {
  this.createNode('B', 'Time to next building tick');
}

// Building ticks happen every 6 hours, 25 minutes past the hour,
// starting at 01:00 UTC.
// Period is 6h (21600 s). Offset is 1h 25m (5100 s)
BuildingTimer.prototype.update = function(now) {
  var next_tick = 21599 - (now-5100) % 21600;
  this.element.style.color = this.computeColour(next_tick, 30, 180, 600);
  this.textNode.data = this.formatTime(next_tick);
};

BuildingTimer.prototype.createNode = APTimer.prototype.createNode;
BuildingTimer.prototype.formatTime = APTimer.prototype.formatTime;
BuildingTimer.prototype.computeColour = APTimer.prototype.computeColour;


function PlanetTimer() {
  this.createNode('P', 'Time to next planet tick');
}

// Planet ticks happen every 3 hours, 25 minutes past the hour,
// starting at 02:00 UTC.
// Period is 3h (10800 s). Offset is 2h 25m (8700 s)
PlanetTimer.prototype.update = function(now) {
  var next_tick = 10799 - (now-8700) % 10800;
  this.element.style.color = this.computeColour(next_tick, 30, 180, 600);
  this.textNode.data = this.formatTime(next_tick);
};

PlanetTimer.prototype.createNode = APTimer.prototype.createNode;
PlanetTimer.prototype.formatTime = APTimer.prototype.formatTime;
PlanetTimer.prototype.computeColour = APTimer.prototype.computeColour;


function StarbaseTimer() {
  this.createNode('S', 'Time to next starbase tick');
}

// Starbase ticks happen every 3 hours, 25 minutes past the hour,
// starting at 0:00 UTC.
// Period is 3h (10800 s). Offset is 25m (8700 s)
StarbaseTimer.prototype.update = function(now) {
  var next_tick = 10799 - (now-1500) % 10800;
  this.element.style.color = this.computeColour(next_tick, 30, 180, 600);
  this.textNode.data = this.formatTime(next_tick);
};

StarbaseTimer.prototype.createNode = APTimer.prototype.createNode;
StarbaseTimer.prototype.formatTime = APTimer.prototype.formatTime;
StarbaseTimer.prototype.computeColour = APTimer.prototype.computeColour;


function LeechTimer() {
  this.createNode('L', 'Time to next leech armour repair');
}

// Leech ticks happen every 20 minutes, starting at 00:00 UTC
// Period is 20m (1200 s), offset is zero.
LeechTimer.prototype.update = function(now) {
  var next_rep = 1199 - now % 1200;
  this.element.style.color = this.computeColour(next_rep, 10, 60, 180);
  this.textNode.data = this.formatTime(next_rep);
};

LeechTimer.prototype.createNode = APTimer.prototype.createNode;
LeechTimer.prototype.formatTime = APTimer.prototype.formatTime;
LeechTimer.prototype.computeColour = APTimer.prototype.computeColour;


function EMatterTimer() {
  this.createNode('E', 'Time to next e-matter regeneration');
}

// E-matter ticks happen every hour, starting at 05:31 UTC
// Period is 60m (3600 s), offset is 5h 31m (19860 s).
EMatterTimer.prototype.update = function(now) {
  var next_rep = 3599 - (now-19860) % 3600;
  this.element.style.color = this.computeColour(next_rep, 10, 60, 180);
  this.textNode.data = this.formatTime(next_rep);
};

EMatterTimer.prototype.createNode = APTimer.prototype.createNode;
EMatterTimer.prototype.formatTime = APTimer.prototype.formatTime;
EMatterTimer.prototype.computeColour = APTimer.prototype.computeColour;


function NPCTimer() {
  this.createNode('N', 'Time to next NPC movement (not Z series, Lucidi)');
}

// NPCs roam 7 times an hour, at minutes 08, 17, 26, 35, 44, 53, 59.
// 7x period is 1h (3600 s), offset is 8m (480 s). But within that
// period, intervals are irregular...
NPCTimer.prototype.crontab = [ 539, // (17-8)*60 - 1
                               1079, // (26-8)*60 - 1
                               1619, // (35-8)*60 - 1
                               2159, // (44-8)*60 - 1
                               2699, // (53-8)*60 - 1
                               3059, // (59-8)*60 - 1
                               3599  // (68-8)*60 - 1
                             ];
NPCTimer.prototype.update = function(now) {
  var n = (now-480) % 3600;
  var next_rep;
  //console.log(n);
  for(var i = this.crontab.length - 1; i >= 0; i -= 1) {
    var t = this.crontab[i];
    if(t < n)
      break;
    next_rep = t - n;
  }
  this.element.style.color = this.computeColour(next_rep, 10, 30, 60);
  this.textNode.data = this.formatTime(next_rep);
};

NPCTimer.prototype.createNode = APTimer.prototype.createNode;
NPCTimer.prototype.formatTime = APTimer.prototype.formatTime;
NPCTimer.prototype.computeColour = APTimer.prototype.computeColour;


function ZTimer() {
  this.createNode('Z', 'Time to next Z series and Lucidi NPC movement');
}

// Zs and Lucies roam in like fashion as other NPCs, but their timing
// is a bit different, at minutes 08, 17, 26, 33, 41, 51, 59.
ZTimer.prototype.crontab = [ 539, // (17-8)*60 - 1
                             1079, // (26-8)*60 - 1
                             1499, // (33-8)*60 - 1
                             1979, // (41-8)*60 - 1
                             2579, // (51-8)*60 - 1
                             3059, // (59-8)*60 - 1
                             3599  // (68-8)*60 - 1
                           ];
ZTimer.prototype.update = NPCTimer.prototype.update;
ZTimer.prototype.createNode = APTimer.prototype.createNode;
ZTimer.prototype.formatTime = APTimer.prototype.formatTime;
ZTimer.prototype.computeColour = APTimer.prototype.computeColour;


function ResetTimer() {
  this.createNode('R', 'Time to next server reset');
}

// Server reset occurs at 05:30 UTC every day.
// Period is 1d (86400 s). Offset is 5h 30m (19800 s)
ResetTimer.prototype.update = function(now) {
  var next_tick = 86399 - (now-19800) % 86400;
  this.element.style.color = this.computeColour(next_tick, 30, 180, 600);
  this.textNode.data = this.formatTime(next_tick);
};

ResetTimer.prototype.createNode = APTimer.prototype.createNode;
ResetTimer.prototype.formatTime = APTimer.prototype.formatTime;
ResetTimer.prototype.computeColour = APTimer.prototype.computeColour;


// This is not a timer per se, it just displays current UTC
function UTCTimer() {
  this.createNode('UTC', 'Coordinated Universal Time');
}

UTCTimer.prototype.update = function(now) {
  var t = now % 86400;
  this.textNode.data = this.formatTime(t);
};

UTCTimer.prototype.createNode = APTimer.prototype.createNode;
UTCTimer.prototype.formatTime = APTimer.prototype.formatTime;


function VClock(timers) {
  var body = document.querySelector('body');
  this.div = document.createElement('div');
  //this.div.style.fontSize = '10px';
  this.div.style.position = 'fixed';
  this.div.style.top = 0;
  this.div.style.right = '10px';
  this.div.style.width = 'auto';

  this.timers = new Array();

  for(var i = 0; i < timers.length; i++) {
    var timerClass = this.timerClasses[timers[i]];
    if(timerClass) {
      var timer = new timerClass();
      this.div.appendChild(timer.element);
      this.timers.push(timer);
    }
  }

  if(this.timers.length > 0)
    body.insertBefore(this.div, body.firstChild);
}

VClock.prototype.timerClasses = {
  'ap': APTimer,
  'b':  BuildingTimer,
  'p':  PlanetTimer,
  's':  StarbaseTimer,
  'l':  LeechTimer,
  'e':  EMatterTimer,
  'n':  NPCTimer,
  'z':  ZTimer,
  'r':  ResetTimer,
  'utc': UTCTimer
};

VClock.prototype.start = function() {
  var self = this;
  self.update();
  setInterval(function() { self.update(); }, 1000);
};

VClock.prototype.update = function() {
  // this is non-standard, but since Chrome and Firefox support
  // Date.now()... (should be (new Date).milliseconds(), or some such)
  var now = Math.floor(Date.now() / 1000);
  for(var i = this.timers.length - 1; i >= 0; i--) {
    this.timers[i].update(now);
  }
};


var indicators = {
  'icon_amsg.png':    'ally',
  'icon_combat.png':  'combat',
  'icon_mission.png': 'mission',
  'icon_msg.png':     'pm',
  'icon_pay.png':     'trade',
  'icon_trade.png':   'trade',
  'gnome-error.png':  'warn',
  'gnome-info.png':   'info'
};

function scanForNotifications() {
  var r = new Object();
  var imgs = document.getElementsByTagName('img');
  for(var i = 0; i < imgs.length; i++) {
    var src = imgs[i].src;
    var offset = src.lastIndexOf('/');
    if(offset >= 0) {
      src = src.substr(offset+1);
      var ind = indicators[src];
      if(ind)
        r[ind] = true;
    }
  }

  // Get the character name
  var name;
  var u = document.getElementById('universe');
  if(u && u.alt) {
    name = u.alt;
    var offset = name.indexOf(':');
    if(offset >= 0 && offset+2 < name.length)
      name = name.substr(offset+2);
  }

  var req = {
    'op': 'dispatchNotifications',
    'character_name': name,
    'events': r
  };

  chrome.extension.sendRequest(req, function(response) { });
}

function run() {
  scanForNotifications();

  var vc;
  chrome.extension.sendRequest({ 'op': 'getClockSettings' },
                               function(response) {
                                 if(response) {
                                   var timers = JSON.parse(response);
                                   if(timers.length > 0) {
                                     vc = new VClock(timers);
                                     vc.start();
                                   }
                                 }
                               });
}

run();
