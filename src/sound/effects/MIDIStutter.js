import MIDIEffect from "../MIDIEffect";
import utils from "./utils";

export default class MIDIStutter extends MIDIEffect {
  constructor(timeline, interval) {
    super(timeline);

    this.timeline = timeline;
    this.ticksPerBeat = 480;
    this.tempo = 120;
    this.interval = interval;
  }

  _ticksToSeconds(ticks) {
    return (ticks / this.ticksPerBeat) * (60 / this.tempo);
  }

  process(data, next) {
    if (typeof data.ticks !== "number") {
      return next(data);
    }

    let ticks = this.ticksPerBeat * this.interval;
    let duration = this._ticksToSeconds(ticks);
    let numOfStutter = Math.ceil(data.ticks / ticks);
    let splittedData = utils.xtend(data, { ticks, duration });

    function $next({ playbackTime }) {
      next(utils.xtend(splittedData, { playbackTime }));
    }

    for (let i = 0; i < numOfStutter; i++) {
      let delayTime = this._ticksToSeconds(ticks * i);

      this.timeline.insert(data.playbackTime + delayTime, $next);
    }
  }
}
