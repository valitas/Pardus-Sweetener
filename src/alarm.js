// A class that implements the audible alarm.
//
// This class creates an Audio element, so it needs access to the DOM. It cannot
// be used in a worker.

export default class Alarm {
  // The audio element
  #audio = new Audio();

  // The name of the sample most recently requested to play. Basically a mirror
  // of the content of #audio.src at all times, just holding it outside for
  // reasons.
  #sampleName;

  // True if the sample above is already playing.
  #playing = false;

  // If the audio element has been asked to start playing, then this will be a
  // promise that will resolve when playback starts.
  #pendingPlay = null;

  // Starts or stop audio playback.
  //
  // Parameter `sample` may be a string, which must be the name of one of the
  // samples included in the directory `sounds`, without path or file extension.
  // That sample is then loaded if needed, and scheduled to start playing.
  // Alternatively, `sample` may be `null`, in which case playback is stopped.
  //
  // The returned promise resolves to the value of `sample`: a string or `null`,
  // indicating what was requested. The promise resolves once the audio starts
  // playing, or once it has stopped, as the case may be. If the sample can't be
  // played back, the promise rejects.
  async play(sample) {
    if (this.#pendingPlay) {
      console.debug("alarm EDGE CASE pendingPlay %o", this);
      // finish what you're doing then try this again
      try {
        await this.#pendingPlay;
      } catch {
        // ignore
      }
      console.assert(this.#pendingPlay === null);
      return this.play(sample);
    }

    if (!sample) {
      // We are to stop the alarm.
      if (this.#playing) {
        this.#audio.pause();
        this.#audio.currentTime = 0;
        this.#playing = false;
      }
      return null;
    }

    // Else we are to start the alarm.

    if (sample !== this.#sampleName) {
      // Need to load a different sample.
      if (this.#playing) {
        // Whatever is playing, stop it.
        this.#audio.pause();
        this.#playing = false;
      }

      // Set the correct sample.
      this.#sampleName = sample;
      this.#audio.src = `sounds/${sample}.oga`;
      this.#audio.load();
      this.#audio.loop = true;
    }

    if (this.#playing) {
      // We're done.
      return sample;
    }

    // At this point, we know the audio is not playing, and the correct sample has
    // been set. Start playback.
    this.#pendingPlay = this.#audio
      .play()
      .then(() => {
        this.#playing = true;
        return sample;
      })
      .catch(() => null)
      .finally(() => {
        this.#pendingPlay = null;
      });
    return await this.#pendingPlay;
  }
}
