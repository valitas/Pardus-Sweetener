// This module exports a function to ensure that the offscreen page is loaded.
// Like, before sending it a message, we want to make sure that the page is
// around to receive it. There is some dancing around required to do that
// properly, the Chrome offscreen API is weirdly complicated.

const offscreenPath = "offscreen.html";
const offscreenUrl = chrome.runtime.getURL(offscreenPath);

// a global promise to deal with concurrency
let creatingPromise;

// Open the offscreen document, if needed. Return a promise that resolves when
// it is known that the document is open.
export default async function prepareOffscreen() {
  // Check all windows controlled by the service worker to see if one
  // of them is the offscreen document with the given path
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [offscreenUrl],
  });
  if (existingContexts.length > 0) {
    return;
  }

  // create offscreen document
  if (creatingPromise) {
    await creatingPromise;
  } else {
    creatingPromise = chrome.offscreen.createDocument({
      url: offscreenPath,
      reasons: ["AUDIO_PLAYBACK"],
      justification: "needed to play an audio alarm",
    });
    await creatingPromise;
    creatingPromise = null;
  }
}
