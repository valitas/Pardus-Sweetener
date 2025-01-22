// This is simplifies our handling of configuration.
//
// There is some magic here, but honest, it's not us complicating
// things gratuitely. We were writing variations of this code in every
// content script.
//
// The way this is used is: create a ConfigurationSet, use addKey to
// tell it which configuration entries you're interested in, and then
// use makeTracker to create another object that actually holds the
// values, keeps itself up to date, and tells you when changes occur.
//
// This may seem needlessly complicated, the two objects, but at some
// point we may create prototypes that persist across frame reloads.
// And then it pays off to define the ConfigurationSet just once,
// store it in some prototype, and then just call makeTracker when
// instantiating.

function ConfigurationSet() {
  // This is a dictionary of configuration keys to property names.

  this.parameters = {};
}

ConfigurationSet.prototype = {
  // Tells the ConfigurationSet that you want to track a particular
  // parameter.  Key is the name with which chrome.storage stores
  // the parameter.  The parameter value will become a property of
  // trackers, with name propertyName.  If propertyName is null or
  // omitted, it defaults to key.
  //
  // Most times you'll want both to be the same, but you'll use
  // different names when you're watching, e.g.,
  // 'allianceQLsArtemisEnabled', but want to refer to it as
  // tracker.allianceQLsEnabled.

  addKey: function (key, propertyName) {
    var reservedPropertyNames = { callback: true, releaseStorage: true };

    if (typeof key != "string" || key.length == 0) {
      throw new Error("bad key");
    }

    // Deliberate non strict equality; propertyName may be null.
    if (propertyName == undefined) {
      propertyName = key;
    } else if (typeof propertyName != "string" || propertyName.length == 0) {
      throw new Error("bad propertyName");
    }

    if (reservedPropertyNames[propertyName]) {
      throw new Error('"' + propertyName + '" is a reserved name');
    }

    this.parameters[key] = propertyName;
  },

  // Creates an object that serves two purposes.
  //
  // First, it requests and holds the values of all parameters that
  // we're interested in; you can access them as the object's own
  // enumerable properties.
  //
  // Second, it calls the given callback when the requested
  // parameters are received from storage.  It also listens for
  // changes on the specified parameters, and calls the callback
  // again whenever those happen.
  //
  // The callback receives arguments that you can use if you need
  // different behaviour on the initial get, than on subsequent
  // changes.  For most cases, though, you probably can ignore
  // arguments and just use the properties on the tracker object.
  //
  // Be advised: the tracker object registers a listener with
  // chrome.storage.  You don't usually need to worry about this, as
  // Chrome will clean up after you when your window disappears.
  // However, if your window outlives the objects that need your
  // tracker, then be aware that chrome.storage will keep your
  // tracker alive even after you've lost all references to
  // it.  In such cases, you probably want to explicitly remove the
  // listener - just call the tracker's method releaseStorage when
  // you know you no longer need it.

  makeTracker: function (callback) {
    var parameters = this.parameters,
      tracker = {},
      onStorageChange = function (changes, area) {
        var updated, propertyName;

        if (area == "local") {
          for (var key in changes) {
            propertyName = parameters[key];
            if (propertyName) {
              tracker[propertyName] = changes[key].newValue;
              updated = true;
            }
          }
          if (updated) {
            tracker.callback("change", changes);
          }
        }
      },
      onStorageGet = function (items) {
        for (var key in items) {
          Object.defineProperty(tracker, parameters[key], {
            value: items[key],
            writable: true,
            enumerable: true,
            configurable: false,
          });
        }
        tracker.callback("get", items);
        chrome.storage.onChanged.addListener(onStorageChange);
      },
      releaseStorage = function () {
        chrome.storage.onChanged.removeListener(onStorageChange);
      };

    Object.defineProperties(tracker, {
      callback: {
        value: callback,
        writable: true,
        enumerable: false,
        configurable: false,
      },
      releaseStorage: {
        value: releaseStorage,
        writable: false,
        enumerable: false,
        configurable: false,
      },
    });

    chrome.storage.local.get(Object.keys(parameters), onStorageGet);
    return tracker;
  },
};
