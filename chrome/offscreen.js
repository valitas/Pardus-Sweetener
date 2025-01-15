// This module is loaded by offscreen.html, which is an offscreen page whose
// only purpose is to play sounds. This is needed because, with manifest v3, the
// extension background page became a service worker, and it is not possible to
// play sounds from a worker.
//
// Because why would anyone want to do that, right? (¬_¬)
//
// This page listens for messages from chrome.runtime with property `target` set
// to `"offscreen"`. Other messages are ignored.
//
// To play a sample, the extension sends us a message with the property `play`
// set to the name of one of the samples in the directory `sounds`, without path
// or file extension. To stop playback, that property is missing or `null`.

// The Audio element
const audio = new Audio();

// The name of the sample most recently requested to play. Basically a mirror of
// the content of audio.src at all times, just holding it outside for reasons.
let sampleName;

// True if the sample above is already playing.
let playing = false;

// If the audio has been asked to start playing the sample above, and just
// hasn't started yet, this is a promise that will resolve when playback starts,
// or reject if playback can't start. Otherwise, if audio is already playing, or
// if playback hasn't even been requested, this is null.
let ongoingStartup = null;

chrome.runtime.onMessage.addListener(handleMessage);

// End of code run at module load.

function handleMessage(request, sender, sendResponse) {
  if (request.target !== "offscreen") return;

  // Message property `play` should be a string specifying the name of the
  // sample to play, or null to stop the sound.
  const requestPlay = request.play;

  if (!requestPlay) {
    // we're to stop the alarm. That's easier.
    if (playing) {
      audio.pause();
      playing = false;
    } else if (ongoingStartup) {
      // XXX this should cause pending promises to reject, which should adjust
      // the state. It's going to be a bitch to test though :(
      // Setting to null should not be necessary. But, until I can test...
      audio.load();
      ongoingStartup = null;
      console.debug(
        "offscreen WAS STARTING TO PLAY, rare case. we called load to abort.",
      );
    }

    sendResponse(false);
    return;
  }

  // Else we are to start the alarm.

  if (requestPlay === sampleName) {
    // The right sample is already set.

    if (playing) {
      // And it's already playing, nothing more to do.
      sendResponse(true);
      return;
    }

    // Else...
    if (ongoingStartup) {
      // it's starting to play already, just wait and respond.
      console.debug("offscreen WAS ALREADY STARTING, rare. we kept waiting");
      ongoingStartup.then(
        () => sendResponse(true),
        () => sendResponse(false),
      );
      return true;
    }

    // Else fall through, start playback further below.
  } else {
    // The wrong sample is set, or no sample at all.

    if (playing) {
      // Whatever is playing, stop it.
      audio.pause();
      playing = false;
    }

    // Set the right sample. load() should force any pending promises to reject.
    sampleName = requestPlay;
    audio.src = `sounds/${sampleName}.ogg`;
    audio.load();
    audio.loop = true;
  }

  // At this point, we know the audio is not playing, and the correct sample has
  // been set. Start playback.
  ongoingStartup = audio.play().then(
    () => {
      // when playback starts, adjust the state and report back
      ongoingStartup = null;
      playing = true;
      sendResponse(true);
      return true;
    },
    () => {
      // if playback can't start, report it, and resolve to false so that other
      // code waiting knows.
      console.debug("offscreen LOAD ABORTED, rare");
      ongoingStartup = null;
      sendResponse(false);
      return false;
    },
  );

  return true;
}
