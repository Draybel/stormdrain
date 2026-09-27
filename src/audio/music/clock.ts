/**
 * Step clock for the lookahead scheduler (pure math, no audio objects — unit-tested with a fake clock).
 *
 * Step times are computed from the absolute (global) step index — `t0 + step × stepDur` plus the
 * swing offset on odd steps — never by accumulating durations, so loops are seamless and there is
 * no drift over long sessions. A looping song maps the global step to `step % totalSteps`.
 */

/** A step whose time is more than this far in the past is skipped instead of played (stall catch-up). */
export const LATE_TOLERANCE = 0.05;

export type StepSink = (songStep: number, time: number, globalStep: number) => void;

export class StepClock {
  readonly stepDur: number;
  readonly swing: number;
  readonly totalSteps: number;
  readonly loop: boolean;
  /** Time of global step 0 (may be in the past for a clock started mid-song). */
  t0 = 0;
  /** Next global step to schedule. */
  next = 0;
  /** No step at or after this time is scheduled (Infinity = unbounded). */
  stopTime = Infinity;
  /** Steps skipped because the scheduler fell behind (diagnostics). */
  skipped = 0;

  constructor(stepDur: number, swing: number, totalSteps: number, loop: boolean) {
    this.stepDur = stepDur;
    this.swing = swing;
    this.totalSteps = totalSteps;
    this.loop = loop;
  }

  /** Starts so that `startStep` falls on `startTime` (plus its swing offset). */
  start(startTime: number, startStep = 0): void {
    this.t0 = startTime - startStep * this.stepDur;
    this.next = startStep;
    this.stopTime = Infinity;
    this.skipped = 0;
  }

  timeOf(step: number): number {
    const base = this.t0 + step * this.stepDur;
    return step & 1 ? base + this.swing * this.stepDur : base;
  }

  songStep(step: number): number {
    return this.loop ? step % this.totalSteps : step;
  }

  /** True when a one-shot song has scheduled its last step. */
  get done(): boolean {
    return (!this.loop && this.next >= this.totalSteps) || this.timeOf(this.next) >= this.stopTime;
  }

  /** End of a one-shot song (time just after its last step). */
  get endTime(): number {
    return this.t0 + this.totalSteps * this.stepDur;
  }

  /** Global step sounding at `time` (the last step that started at or before it). */
  stepAt(time: number): number {
    return Math.max(0, Math.floor((time - this.t0) / this.stepDur + 1e-9));
  }

  /**
   * Hands every step with `time < horizon` to `sink`, in order. Steps already later than
   * `now - LATE_TOLERANCE` are skipped silently (the tab stalled or the timer was throttled).
   * Returns the number of steps delivered.
   */
  pump(now: number, horizon: number, sink: StepSink): number {
    let n = 0;
    const limit = Math.min(horizon, this.stopTime);
    for (;;) {
      if (!this.loop && this.next >= this.totalSteps) break;
      const t = this.timeOf(this.next);
      if (t >= limit) break;
      if (t < now - LATE_TOLERANCE) {
        const jump = Math.ceil((now - this.t0) / this.stepDur);
        const target = Math.max(this.next + 1, jump);
        this.skipped += target - this.next;
        this.next = target;
        continue;
      }
      sink(this.songStep(this.next), t, this.next);
      this.next++;
      n++;
    }
    return n;
  }
}
