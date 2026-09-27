/**
 * Fixed-timestep game loop: the simulation always advances in exact 1/60 s steps (accumulator,
 * at most 4 catch-up steps per frame, the rest dropped); rendering happens once per
 * requestAnimationFrame with an interpolation factor. Tracks fps, the smoothed update/render cost and (`stats`,
 * polish batch 2) the raw spikes: the worst frame, the worst rAF-to-rAF gap and the frames over 20 ms in the last second.
 * Polish batch 3: an exception thrown by `update` or `render` goes to the `error` hook (the game's crash guard) and
 * the loop keeps running — it used to skip the render of every later frame too, freezing the game without a word.
 */

import { FrameStats } from './frameStats';

export const STEP = 1 / 60;
const MAX_STEPS = 4;
/** Frame times within this of a whole multiple of STEP are snapped to it (vsync jitter). */
const SNAP = 0.0015;

export interface LoopHooks {
  /** One fixed simulation tick (dt is always STEP). */
  update(dt: number): void;
  /** Render; alpha = how far we are between the last tick and the next (0..1). */
  render(alpha: number, frameDt: number): void;
  /**
   * An exception escaped `update` / `render`. The frame's remaining ticks are dropped and the loop carries on with the
   * next frame (the hook recovers: main.ts returns to the title). Without this hook the exception is rethrown.
   */
  error?(err: unknown, phase: 'update' | 'render'): void;
}

export class Loop {
  fps = 0;
  /** Smoothed milliseconds per update tick and per render. */
  updateMs = 0;
  renderMs = 0;
  /** Steps discarded because the frame took too long (spiral-of-death protection). */
  droppedSteps = 0;
  /** Raw per-frame cost and rAF gaps over a rolling 1 s window (no smoothing). */
  readonly stats = new FrameStats();
  ticks = 0;
  frames = 0;
  running = false;

  private readonly hooks: LoopHooks;
  private acc = 0;
  private last = -1;
  private raf = 0;
  private fpsFrames = 0;
  private fpsTime = 0;

  constructor(hooks: LoopHooks) {
    this.hooks = hooks;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = -1;
    this.raf = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /** Forget elapsed time (e.g. after returning from the background) so we don't fast-forward. */
  resetClock(): void {
    this.last = -1;
    this.acc = 0;
  }

  /** Errors reported to the `error` hook so far (diagnostics / tests). */
  errors = 0;

  private fail(err: unknown, phase: 'update' | 'render'): void {
    this.errors++;
    const onError = this.hooks.error;
    if (!onError) throw err;
    try {
      onError(err, phase);
    } catch (again) {
      // The recovery itself failed: log it, keep the loop alive (the hook may succeed next frame).
      console.error('loop error handler failed', again);
    }
  }

  /** One rAF callback at timestamp `now` (ms). Public so tests can drive the loop with synthetic frame times. */
  tick(now: number): void {
    this.step(now);
  }

  private readonly frame = (now: number): void => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.frame);
    this.step(now);
  };

  private step(now: number): void {
    // The raw gap since the previous rAF (before any clamping): a long input handler shows up here.
    const gapMs = this.last < 0 ? 0 : now - this.last;
    let dt = this.last < 0 ? STEP : (now - this.last) / 1000;
    this.last = now;
    if (dt < 0) dt = 0;
    if (dt > 0.25) dt = 0.25;
    // Snap near-multiples of the step so 60 Hz displays get exactly one tick per frame.
    const m = Math.round(dt / STEP);
    if (m >= 1 && Math.abs(dt - m * STEP) < SNAP) dt = m * STEP;
    else if (Math.abs(dt - STEP / 2) < SNAP * 0.5) dt = STEP / 2;

    this.acc += dt;
    let steps = 0;
    const t0 = performance.now();
    while (this.acc >= STEP - 1e-9 && steps < MAX_STEPS) {
      try {
        this.hooks.update(STEP);
      } catch (err) {
        // Don't run the rest of this frame's ticks into the same exception.
        this.acc = 0;
        this.fail(err, 'update');
        break;
      }
      this.acc -= STEP;
      steps++;
      this.ticks++;
    }
    if (this.acc >= STEP) {
      this.droppedSteps += Math.floor(this.acc / STEP);
      this.acc %= STEP;
    }
    if (this.acc < 0) this.acc = 0;
    const t1 = performance.now();
    if (steps > 0) this.updateMs += ((t1 - t0) / steps - this.updateMs) * 0.1;

    try {
      this.hooks.render(Math.min(1, this.acc / STEP), dt);
    } catch (err) {
      this.fail(err, 'render');
    }
    const t2 = performance.now();
    this.renderMs += (t2 - t1 - this.renderMs) * 0.1;
    this.stats.record(now, t2 - t0, gapMs);

    this.frames++;
    this.fpsFrames++;
    this.fpsTime += dt;
    if (this.fpsTime >= 0.5) {
      this.fps = Math.round(this.fpsFrames / this.fpsTime);
      this.fpsFrames = 0;
      this.fpsTime = 0;
    }
  }
}
