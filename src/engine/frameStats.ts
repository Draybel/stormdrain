/**
 * Raw frame-spike statistics for the loop (polish batch 2, B2-6): the smoothed `updateMs` / `renderMs` hide the
 * spikes that break 60 fps, and work done inside input handlers (a START tap building the whole sprite cache, a
 * room entry) never shows up in them at all. This keeps the last frames in a fixed-size ring (no allocation per
 * frame) and, over a rolling window (1 s), the worst update + render cost, the worst rAF-to-rAF gap and the number of
 * frames whose cost went over 20 ms. The gap is what catches a long handler: nothing can run between two rAF
 * callbacks while it blocks the main thread.
 */

/** Rolling window of the worst / gap / over-20 numbers (ms). */
export const FRAME_WINDOW_MS = 1000;
/** A frame whose update + render cost is above this counts as slow. */
export const FRAME_SLOW_MS = 20;
/** Frames kept (≥ 2 s at 240 Hz): the window and `since()` read from here. */
export const FRAME_RING = 512;

export interface FrameSample {
  /** Frame index (1 = the first frame recorded) of the newest frame returned. */
  frame: number;
  /** Raw update + render cost (ms) per frame, oldest first. */
  costs: number[];
  /** rAF-to-rAF gap (ms) before each frame (0 when unknown: the first frame, or after a clock reset). */
  gaps: number[];
}

export class FrameStats {
  /** Worst update + render cost (ms) of a frame in the window. */
  worstMs = 0;
  /** Worst rAF-to-rAF gap (ms) in the window. */
  gapMs = 0;
  /** Frames in the window whose cost was over FRAME_SLOW_MS. */
  over20 = 0;
  /** Frames recorded so far (the newest frame's index). */
  frames = 0;

  private readonly t = new Float64Array(FRAME_RING);
  private readonly cost = new Float32Array(FRAME_RING);
  private readonly gap = new Float32Array(FRAME_RING);
  private readonly scratch = new Float32Array(FRAME_RING);
  private head = 0;
  private size = 0;

  constructor(readonly windowMs = FRAME_WINDOW_MS) {}

  /** One frame: `now` = its rAF timestamp (ms), `costMs` = update + render, `gapMs` = time since the last rAF. */
  record(now: number, costMs: number, gapMs: number): void {
    const i = this.head;
    this.t[i] = now;
    this.cost[i] = costMs;
    this.gap[i] = gapMs > 0 ? gapMs : 0;
    this.head = (i + 1) % FRAME_RING;
    if (this.size < FRAME_RING) this.size++;
    this.frames++;
    this.refresh(now);
  }

  /** Recomputes the window numbers as of `now` (also called by record). */
  refresh(now: number): void {
    let worst = 0;
    let gap = 0;
    let slow = 0;
    const from = now - this.windowMs;
    for (let k = 0; k < this.size; k++) {
      const i = (this.head - 1 - k + FRAME_RING) % FRAME_RING;
      if (this.t[i]! < from) break;
      const c = this.cost[i]!;
      if (c > worst) worst = c;
      if (c > FRAME_SLOW_MS) slow++;
      const g = this.gap[i]!;
      if (g > gap) gap = g;
    }
    this.worstMs = worst;
    this.gapMs = gap;
    this.over20 = slow;
  }

  /** The p-th percentile (0..1) of the raw costs of the frames in the window as of the newest frame. */
  percentile(p: number): number {
    if (this.size === 0) return 0;
    const newest = this.t[(this.head - 1 + FRAME_RING) % FRAME_RING]!;
    const from = newest - this.windowMs;
    let n = 0;
    for (let k = 0; k < this.size; k++) {
      const i = (this.head - 1 - k + FRAME_RING) % FRAME_RING;
      if (this.t[i]! < from) break;
      this.scratch[n++] = this.cost[i]!;
    }
    return percentileOf(this.scratch, n, p);
  }

  /** The frames recorded after frame index `after` that are still in the ring (for tests: p95 over a stretch). */
  since(after: number): FrameSample {
    const n = Math.max(0, Math.min(this.frames - after, this.size));
    const costs: number[] = [];
    const gaps: number[] = [];
    for (let k = n - 1; k >= 0; k--) {
      const i = (this.head - 1 - k + FRAME_RING) % FRAME_RING;
      costs.push(this.cost[i]!);
      gaps.push(this.gap[i]!);
    }
    return { frame: this.frames, costs, gaps };
  }

  reset(): void {
    this.head = 0;
    this.size = 0;
    this.worstMs = 0;
    this.gapMs = 0;
    this.over20 = 0;
  }
}

/** The p-th percentile (0..1, nearest rank) of the first n values of `a` (sorts them in place). */
export function percentileOf(a: Float32Array | number[], n: number, p: number): number {
  if (n <= 0) return 0;
  const view = a instanceof Float32Array ? a.subarray(0, n) : a.slice(0, n);
  if (view instanceof Float32Array) view.sort();
  else view.sort((x, y) => x - y);
  const idx = Math.min(n - 1, Math.max(0, Math.ceil(p * n) - 1));
  return view[idx]!;
}
