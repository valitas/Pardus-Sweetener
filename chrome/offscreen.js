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

// The Audio element
const audio = new Audio();

// The name of the sample most recently requested to play. Basically a mirror of
// the content of audio.src at all times, just holding it outside for reasons.
let sampleName;

// True if the sample above is already playing.
let playing = false;

// If the audio element has been asked to start playing the sample above, but
// just hasn't started yet, then this is a promise that will resolve to `true`
// when playback has started, or to `false` if playback startup was aborted.
let ongoingStartup = null;

chrome.runtime.onMessage.addListener(handleMessage);

// End of code run at module load.

function handleMessage(request, sender, sendResponse) {
  if (request.target !== "offscreen") return;

  // When reading the code below, bear in mind that this function reports the
  // resulting state of the alarm by calling `sendResponse(state)`, where the
  // state is `true` if the alarm is playing, `false` if it's not. And,
  // importantly, `sendResponse` may be called immediately, or the function may
  // return without calling it but arrange for it to be called when a promise
  // resolves in the future.
  //
  // And, in that latter case, we have to return `true` here, so that Chrome
  // knows to keep `sendResponse` valid beyond the execution of this function.

  // Message property `play` is a string specifying the name of the sample to
  // play, or null to stop the sound.
  const requestPlay = request.play;

  if (!requestPlay) {
    // We are to stop the alarm.
    if (playing) {
      audio.pause();
      playing = false;
    } else if (ongoingStartup) {
      audio.load();
      // XXX load() should cause pending promises to reject, which should adjust
      // the state, so it shouldn't be necessary to set ongoingStartup. But it's
      // going to be a bitch to test if that's really the case, so, until
      // then... :(
      ongoingStartup = null;
      console.debug(
        "offscreen RARE CASE: asked to stop while playback was starting, called audio.load() to abort",
      );
    }

    sendResponse(false);
    return;
  }

  // Else we are to start the alarm.

  if (requestPlay === sampleName) {
    // The correct sample is already set.

    if (playing) {
      // And it's already playing, nothing more to do.
      sendResponse(true);
      return;
    }

    // Else the correct sample is set but not playing yet...
    if (ongoingStartup) {
      // but it's starting to play already. Just wait and respond.
      console.debug(
        "offscreen RARE CASE: asked to start while playback was already starting, we'll wait and respond",
      );
      // XXX ongoingStartup should resolve to true if audio started, false it
      // startup was aborted (not reject). Find a way to test this.
      ongoingStartup.then((result) => sendResponse(result));
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

    // Set the correct sample. load() should force pending promises to reject.
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
      console.debug("offscreen RARE CASE: playback startup aborted");
      ongoingStartup = null;
      sendResponse(false);
      return false;
    },
  );
  return true;
}
