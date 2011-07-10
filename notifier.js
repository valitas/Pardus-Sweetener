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
  var n = webkitNotifications.createNotification('icons/48.png', title, text);
  n.ondisplay = function() {
    setTimeout(function() {
                 if(n == self.notification)
                   self.hide();
               }, 15000);
  };

  this.notification = n;
  this.notification.show();
};
