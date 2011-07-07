// just enable the page action whenever this page is loaded

var port = chrome.extension.connect();
port.postMessage({ op: 'enablePageAction' });
