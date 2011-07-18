function checkMessageFrame() {
  var f = document.getElementById('msgframe');
  if(f) {
    var src = f.src;
    var reloadNeeded;

    try {
      reloadNeeded = (f.contentDocument.URL != src);
    }
    catch(e) {
      // trying to access contentDocument above will cause chrome to
      // give us a security exception if the msgframe failed to load
      // and the frame now contains the error document
      reloadNeeded = true;
    }

    if(reloadNeeded)
      f.src = src;
  }

  // schedule a check in about 1 minute
  setTimeout(checkMessageFrame, 59000);
}

// we may use the port in the future.  for now, we only connect to enable the page action
var port = chrome.extension.connect();

setTimeout(checkMessageFrame, 55000);
