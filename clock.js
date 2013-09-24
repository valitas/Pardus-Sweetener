// server reset is at 5.30 UTC every day

function APTimer(doc) {
  this.createNode(doc, 'AP', 'Time to next 24 AP and next shield recharge');
}

APTimer.prototype = {
  createNode: function(doc, label, title) {
    this.element = doc.createElement('span');
    this.element.appendChild(doc.createTextNode(' ' + label + ' '));
    var inner = doc.createElement('span');
    this.textNode = doc.createTextNode('-:--');
    inner.appendChild(this.textNode);
    this.element.appendChild(inner);
    this.element.appendChild(doc.createTextNode(' '));
    this.element.style.margin = '0 0 0 7px';
    this.element.style.cursor = 'default';
    this.element.title = title;
  },

  // 'now' is the Unix time, an integer, in seconds.
  // AP ticks happen every 6 minutes, starting at minute 0.
  // So period is 6m (360 s), and offset is zero
  update: function(now) {
    var next_ap = 359 - now % 360;
    this.element.style.color = this.computeColour(next_ap, 10, 30, 60);
    this.textNode.data = this.formatTime(next_ap);
  },

  formatTime: function(seconds) {
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
  },

  computeColour: function(now, red_threshold,
                          yellow_threshold, green_threshold) {
    if(now <= red_threshold)
      return 'red';
    if(now <= yellow_threshold)
      return 'yellow';
    else if(now <= green_threshold)
    return 'lime';

    return 'inherit';
  }
};

function BuildingTimer(doc) {
  this.createNode(doc, 'B', 'Time to next building tick');
}

// Building ticks happen every 6 hours, 25 minutes past the hour,
// starting at 01:00 UTC.
// Period is 6h (21600 s). Offset is 1h 25m (5100 s)
BuildingTimer.prototype = {
  update: function(now) {
    var next_tick = 21599 - (now-5100) % 21600;
    this.element.style.color = this.computeColour(next_tick, 30, 180, 600);
    this.textNode.data = this.formatTime(next_tick);
  },

  createNode: APTimer.prototype.createNode,
  formatTime: APTimer.prototype.formatTime,
  computeColour: APTimer.prototype.computeColour
};

function PlanetTimer(doc) {
  this.createNode(doc, 'P', 'Time to next planet tick');
}

// Planet ticks happen every 3 hours, 25 minutes past the hour,
// starting at 02:00 UTC.
// Period is 3h (10800 s). Offset is 2h 25m (8700 s)
PlanetTimer.prototype = {
  update: function(now) {
    var next_tick = 10799 - (now-8700) % 10800;
    this.element.style.color = this.computeColour(next_tick, 30, 180, 600);
    this.textNode.data = this.formatTime(next_tick);
  },

  createNode: APTimer.prototype.createNode,
  formatTime: APTimer.prototype.formatTime,
  computeColour: APTimer.prototype.computeColour
};


function StarbaseTimer(doc) {
  this.createNode(doc, 'S', 'Time to next starbase tick');
}

// Starbase ticks happen every 3 hours, 25 minutes past the hour,
// starting at 0:00 UTC.
// Period is 3h (10800 s). Offset is 25m (8700 s)
StarbaseTimer.prototype = {
  update: function(now) {
    var next_tick = 10799 - (now-1500) % 10800;
    this.element.style.color = this.computeColour(next_tick, 30, 180, 600);
    this.textNode.data = this.formatTime(next_tick);
  },

  createNode: APTimer.prototype.createNode,
  formatTime: APTimer.prototype.formatTime,
  computeColour: APTimer.prototype.computeColour
};

function LeechTimer(doc) {
  this.createNode(doc, 'L', 'Time to next leech armour repair');
}

// Leech ticks happen every 20 minutes, starting at 00:00 UTC
// Period is 20m (1200 s), offset is zero.
LeechTimer.prototype = {
  update: function(now) {
    var next_rep = 1199 - now % 1200;
    this.element.style.color = this.computeColour(next_rep, 10, 60, 180);
    this.textNode.data = this.formatTime(next_rep);
  },

  createNode: APTimer.prototype.createNode,
  formatTime: APTimer.prototype.formatTime,
  computeColour: APTimer.prototype.computeColour
};


function EMatterTimer(doc) {
  this.createNode(doc, 'E', 'Time to next e-matter regeneration');
}

// E-matter ticks happen every hour, starting at 05:31 UTC
// Period is 60m (3600 s), offset is 5h 31m (19860 s).
EMatterTimer.prototype = {
  update: function(now) {
    var next_rep = 3599 - (now-19860) % 3600;
    this.element.style.color = this.computeColour(next_rep, 10, 60, 180);
    this.textNode.data = this.formatTime(next_rep);
  },

  createNode: APTimer.prototype.createNode,
  formatTime: APTimer.prototype.formatTime,
  computeColour: APTimer.prototype.computeColour
};


function NPCTimer(doc) {
  this.createNode(doc, 'N',
                  'Time to next roaming NPC move (not Z series, Lucidi)');
}

// NPCs roam 7 times an hour, at minutes 08, 17, 26, 35, 44, 53, 59.
// 7x period is 1h (3600 s), offset is 8m (480 s). But within that
// period, intervals are irregular...
NPCTimer.prototype = {
  crontab: [ 539, // (17-8)*60 - 1
             1079, // (26-8)*60 - 1
             1619, // (35-8)*60 - 1
             2159, // (44-8)*60 - 1
             2699, // (53-8)*60 - 1
             3059, // (59-8)*60 - 1
             3599  // (68-8)*60 - 1
           ],
  update: function(now) {
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
  },

  createNode: APTimer.prototype.createNode,
  formatTime: APTimer.prototype.formatTime,
  computeColour: APTimer.prototype.computeColour
};


function ZTimer(doc) {
  this.createNode(doc, 'Z', 'Time to next Z series and Lucidi NPC move');
}

// Zs and Lucies roam in like fashion as other NPCs, but their timing
// is a bit different, at minutes 08, 17, 26, 33, 41, 51, 59.
ZTimer.prototype = {
  crontab: [ 539, // (17-8)*60 - 1
             1079, // (26-8)*60 - 1
             1499, // (33-8)*60 - 1
             1979, // (41-8)*60 - 1
             2579, // (51-8)*60 - 1
             3059, // (59-8)*60 - 1
             3599  // (68-8)*60 - 1
           ],
  update: NPCTimer.prototype.update,
  createNode: APTimer.prototype.createNode,
  formatTime: APTimer.prototype.formatTime,
  computeColour: APTimer.prototype.computeColour
};


function ResetTimer(doc) {
  this.createNode(doc, 'R', 'Time to next server reset');
}

// Server reset occurs at 05:30 UTC every day.
// Period is 1d (86400 s). Offset is 5h 30m (19800 s)
ResetTimer.prototype = {
  update: function(now) {
    var next_tick = 86399 - (now-19800) % 86400;
    this.element.style.color = this.computeColour(next_tick, 30, 180, 600);
    this.textNode.data = this.formatTime(next_tick);
  },

  createNode: APTimer.prototype.createNode,
  formatTime: APTimer.prototype.formatTime,
  computeColour: APTimer.prototype.computeColour
};


// This is not a timer per se, it just displays current UTC
function UTCTimer(doc) {
  // ... and we call it "GMT" because people get confused otherwise
  this.createNode(doc, 'GMT', 'Greenwich Mean Time');
}

UTCTimer.prototype = {
  update: function(now) {
    var t = now % 86400;
    this.textNode.data = this.formatTime(t);
  },

  formatTime: function(seconds) {
    var hours = Math.floor(seconds / 3600);
    seconds -= hours*3600;
    var minutes = Math.floor(seconds / 60);
    seconds -= minutes*60;

    var s = '';
    if(hours < 10)
      s += '0';
    s += hours;
    s += ':';
    if(minutes < 10)
      s += '0';
    s += minutes;
    s += ':';
    if(seconds < 10)
      s += '0';
    s += seconds;

    return s;
  },

  createNode: APTimer.prototype.createNode
};


function VClock(doc) {
  this.doc = doc;
  var body = doc.querySelector('body');
  this.div = doc.createElement('div');
  //this.div.style.fontSize = '10px';
  this.div.style.position = 'fixed';
  this.div.style.top = 0;
  this.div.style.right = '10px';
  this.div.style.width = 'auto';
  this.timers = new Object();

  body.insertBefore(this.div, body.firstChild);
}

VClock.prototype = {
  timerInfo: {
    AP:  { tc: APTimer,       order:  10 },
    B:   { tc: BuildingTimer, order:  20 },
    P:   { tc: PlanetTimer,   order:  30 },
    S:   { tc: StarbaseTimer, order:  40 },
    L:   { tc: LeechTimer,    order:  50 },
    E:   { tc: EMatterTimer,  order:  60 },
    N:   { tc: NPCTimer,      order:  70 },
    Z:   { tc: ZTimer,        order:  80 },
    R:   { tc: ResetTimer,    order:  90 },
    UTC: { tc: UTCTimer,      order: 100 }
  },

  setEnabled: function(which, enabled) {
    var changed;
    var t = this.timers[which];

    if(enabled) {
      if(!t) {
        t = new Object();
        t.info = this.timerInfo[which];
        if(!t.info)
          return;
        this.timers[which] = t;
      }

      if(!t.enabled) {
        if(!t.instance)
          t.instance = new t.info.tc(this.doc);
        changed = t.enabled = true;
        t.instance.update(Math.floor(Date.now() / 1000));
      }
    }
    else {
      if(t && t.enabled) {
        t.enabled = false;
        changed = true;
      }
      // otherwise we don't care - timer wasn't created yet, or was disabled
    }

    if(changed) {
      // rebuild the div
      var ta = new Array();
      for(t in this.timers)
        if(this.timers[t].enabled)
          ta.push(this.timers[t]);
      ta.sort(function(a,b) { return a.info.order - b.info.order; });

      while(this.div.hasChildNodes())
        this.div.removeChild(this.div.firstChild);

      for(var i = 0; i < ta.length; i++)
        this.div.appendChild(ta[i].instance.element);
    }
  },

  start: function() {
    var self = this;
    self.update();
    setInterval(function() { self.update(); }, 1000);
  },

  update: function() {
    // this is non-standard, but since Chrome and Firefox support
    // Date.now()... (should be (new Date).milliseconds(), or some such)
    var now = Math.floor(Date.now() / 1000);
    for(var k in this.timers) {
      var t = this.timers[k];
      if(t.enabled)
        t.instance.update(now);
    }
  },

  sink: function(sunk) {
    this.div.style.zIndex = sunk ? '-1' : 'inherit';
  }
};
