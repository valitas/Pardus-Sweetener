function Alarm(sound) {

  this.soundk = new Object();
  for(var i = 0; i < this.sounds.length; i++) {
    var s = this.sounds[i];
    this.soundk[s.id] = s;
  }

  // Select the current sound. If there's no such thing,
  // pick the first on our list.

  if(!sound)
    sound = this.sounds[0].id;
  this.selectSample(sound);
}

Alarm.prototype.sounds = [
  { id: 'buzz',    name: 'Buzzer'        },
  { id: 'dive',    name: 'Dive horn'     },
  { id: 'missile', name: 'Missile alert' },
  { id: 'power',   name: 'Power plant'   },
  { id: 'timex',   name: 'Timex'         }
];

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
