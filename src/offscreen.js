// This module is loaded by offscreen.html, which is an offscreen page whose
// only purpose is to play sounds. This is needed because, with manifest v3, the
// extension background page became a service worker, and it is not possible to
// play sounds from a worker.
//
// Because why would anyone want to do that, right? (¬_¬)
//
// This page listens for messages from runtime with property `target` set to
// `"offscreen"`. Other messages are ignored.
//
// To play a sample, runtime sends us a message with property `play` set to the
// name of one of the samples in the directory `sounds` (without path or file
// extension). To stop playback, that property is missing or null.

import Alarm from "./alarm.js";

const alarm = new Alarm();

chrome.runtime.onMessage.addListener(handleMessage);

function handleMessage(request, sender, sendResponse) {
  if (request.target !== "offscreen") return;

  // Message property `play` is a string specifying the name of the sample to
  // play, or null to stop the sound. So, exactly what alarm.play() wants.
  alarm
    .play(request.play)
    .then((result) => sendResponse(result))
    .catch((x) => {
      // should never happen
      console.error("offscreen handleMessage", x);
      sendResponse(null);
    });
  return true;
}
