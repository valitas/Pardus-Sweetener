function Notifier() { }

Notifier.prototype = {
  hide: function() {
    if(this.notification) {
      this.notification.cancel();
      delete this.notification;
    }
  },

  show: function(title, text, timeout) {
    this.hide();

    var self = this;
    if(!timeout)
      timeout = 15000;
    var n = webkitNotifications.createNotification('icons/48.png', title, text);
    n.ondisplay = function() {
      setTimeout(function() {
                   if(n == self.notification)
                     self.hide();
                 }, timeout);
    };

    this.notification = n;
    this.notification.show();
  }
};
