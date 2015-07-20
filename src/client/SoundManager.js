import xtend from "xtend";
import Sound from "./sound";
import config from "./config";
import utils from "./utils";

export default class SoundManager {
  constructor({ audioContext, timeline }) {
    this.audioContext = audioContext;
    this.timeline = timeline;

    this.inlet = audioContext.createDynamicsCompressor();
    this.inlet.ratio.value = 9;
    this.inlet.threshold.value = -2;

    this.outlet = audioContext.createGain();

    this._state = "suspended";
    this._chored = false;
    this._notes = [];
    this._params = new Uint8Array(16);
  }

  get state() {
    return this._state;
  }

  get currentTime() {
    return this.audioContext.currentTime;
  }

  get destination() {
    return this.inlet;
  }

  chore() {
    if (!this._chored) {
      let bufSrc = this.audioContext.createBufferSource();

      bufSrc.start(this.audioContext.currentTime);
      bufSrc.stop(this.audioContext.currentTime + 0.001);
      bufSrc.connect(this.audioContext.destination);
      bufSrc.onended = () => {
        bufSrc.disconnect();
      };

      this._chored = bufSrc;
    }

    return this;
  }

  start() {
    if (this.state === "suspended") {
      this.outlet.gain.setValueAtTime(0, this.audioContext.currentTime);
      this.outlet.gain.linearRampToValueAtTime(0.5, this.audioContext.currentTime + 0.01);

      this.inlet.connect(this.outlet);
      this.outlet.connect(this.audioContext.destination);
      this._state = "running";
    }

    return this;
  }

  stop() {
    if (this.state === "running") {
      this.outlet.gain.setValueAtTime(0.5, this.audioContext.currentTime);
      this.outlet.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.01);
      this.timeline.nextTick(() => {
        this.inlet.disconnect();
        this.outlet.disconnect();
      });
      this._state = "suspended";
    }

    return this;
  }

  changeParams(params) {
    this._params = params;
    this._notes.forEach((note) => {
      note.changeParams(params);
    });
  }

  play(data) {
    if (data.dataType === "sequence") {
      data = xtend(data, {
        dataType: "noteOn",
        playbackTime: data.playbackTime + config.SEQUENCE_OFFSET_TIME,
      });
    }
    if (data.dataType === "noteOn") {
      this.timeline.insert(data.playbackTime, () => {
        this.noteOn(data);
      });
    }
  }

  noteOn(data) {
    let { track, program, playbackTime } = data;

    let Klass = Sound.getClass(track, program);
    let instance = new Klass(this.audioContext, this.timeline, this._params, data);
    let notes = this._notes;

    instance.initialize();
    instance.noteOn(playbackTime);
    instance.noteOff(playbackTime + instance.duration);

    instance.once("ended", () => {
      instance.dispose();
    });

    instance.once("disposed", () => {
      utils.removeIfExists(notes, instance);
      instance.disconnect();
    });

    instance.connect(this.inlet);

    notes.push(instance);
  }
}
