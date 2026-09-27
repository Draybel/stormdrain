/**
 * Floating virtual stick logic (pure; no DOM). Coordinates are game pixels.
 * The origin is wherever the thumb lands; the knob travels up to `radius`.
 */

import { DEG } from './math';

export interface StickConfig {
  /** Max knob travel in game px. */
  radius: number;
  /** Fraction of radius that produces no output (move stick). */
  deadzone: number;
  /** Thumb travel (px) before the aim stick commits to a direction. */
  activation: number;
  /** If true, the origin is dragged along when the thumb goes past the radius. */
  follow: boolean;
  /** Snap near-axis movement onto the axis (radians); 0 disables. Helps walking straight. */
  axisMagnet: number;
  /**
   * Fraction of the radius where the analog output already reaches 1, so full speed doesn't
   * demand pinning the thumb exactly on the rim (1 = linear all the way out).
   */
  saturation: number;
  /**
   * 4-way aim flick (polish batch 3; 0 = off): a thumb that travels at least this many game px in a NEW cardinal
   * direction within {@link FLICK_MS} switches to it at once and re-centres the stick behind the thumb.
   */
  flickPx: number;
}

export const MOVE_STICK: StickConfig = {
  radius: 24,
  deadzone: 0.14,
  activation: 0,
  follow: true,
  axisMagnet: 7 * DEG,
  saturation: 0.85,
  flickPx: 0,
};

/**
 * Polish batch 3: the aim origin follows the thumb at 12 px (was 20), so turning at the rim costs ≈ 13 game px
 * (≈ 4 mm) of travel instead of ≈ 24 (8 mm).
 */
export const AIM_STICK: StickConfig = {
  radius: 12,
  deadzone: 0,
  activation: 3,
  follow: true,
  axisMagnet: 0,
  saturation: 1,
  flickPx: 6,
};

/** 4-way aim keeps the current direction until the thumb is this far off-axis (45° + 6° of hysteresis). */
export const SNAP_KEEP_DEG = 51;
const SNAP_KEEP_COS = Math.cos(SNAP_KEEP_DEG * DEG);
/** The flick window (ms): see {@link StickConfig.flickPx}. */
export const FLICK_MS = 80;
/** A flick may start at most this far (game px) on the far side of the origin from its direction. */
const FLICK_CROSS = 2;
/** Recent thumb samples kept for the flick test (a small ring, no allocation). */
const HIST = 8;

export class VirtualStick {
  readonly cfg: StickConfig;
  pointerId = -1;
  active = false;
  originX = 0;
  originY = 0;
  thumbX = 0;
  thumbY = 0;
  /** Knob offset from origin (clamped to radius), for drawing. */
  knobDX = 0;
  knobDY = 0;
  /** Analog output (-1..1 per axis, magnitude <= 1) after deadzone remap. */
  outX = 0;
  outY = 0;
  /** Aim direction (unit) once committed; stays set until the stick is released. */
  hasDir = false;
  dirX = 0;
  dirY = 0;
  /** 4-way snapping for aim (false = free 360° aim). */
  snap4 = true;
  /** Seconds since `begin` (maintained by the owner for UI fades). */
  heldTime = 0;
  /** Flicks taken since `begin` (tests / tools). */
  flicks = 0;
  /** Recent thumb samples (time ms, x, y) for the flick test: a ring of {@link HIST}. */
  private readonly histT = new Float64Array(HIST);
  private readonly histX = new Float64Array(HIST);
  private readonly histY = new Float64Array(HIST);
  private histN = 0;
  private histI = 0;

  constructor(cfg: StickConfig) {
    this.cfg = cfg;
  }

  /** `t`: the event time in ms (enables the aim flick; -1 = unknown). Coordinates may lie outside the image. */
  begin(pointerId: number, x: number, y: number, t = -1): void {
    this.pointerId = pointerId;
    this.active = true;
    this.originX = x;
    this.originY = y;
    this.thumbX = x;
    this.thumbY = y;
    this.hasDir = false;
    this.dirX = 0;
    this.dirY = 0;
    this.heldTime = 0;
    this.flicks = 0;
    this.histN = 0;
    this.record(t, x, y);
    this.compute();
  }

  move(x: number, y: number, t = -1): void {
    if (!this.active) return;
    this.thumbX = x;
    this.thumbY = y;
    if (t >= 0 && this.cfg.flickPx > 0 && this.snap4 && this.hasDir) this.flick(t, x, y);
    this.record(t, x, y);
    this.compute();
  }

  private record(t: number, x: number, y: number): void {
    if (t < 0 || this.cfg.flickPx <= 0) return;
    const i = this.histI;
    this.histT[i] = t;
    this.histX[i] = x;
    this.histY[i] = y;
    this.histI = (i + 1) % HIST;
    if (this.histN < HIST) this.histN++;
  }

  /**
   * A quick flick (≥ flickPx within FLICK_MS) clearly along a NEW cardinal direction (the major axis at least twice
   * the minor one) switches the 4-way aim to it at once and moves the origin behind the thumb (thumb on the rim in the
   * new direction), so the ordinary angle test that follows agrees with it instead of snapping back.
   * The stroke must move the thumb OUT into that direction's side of the origin: it may not start more than
   * FLICK_CROSS px on the far side (a thumb wobbling across the current axis — 30° above "right" to 30° below — is not
   * a flick down) and must end at least half a flick into it (easing back toward the centre is not a flick back).
   */
  private flick(t: number, x: number, y: number): void {
    // Where the thumb was FLICK_MS ago: the newest sample at least that old (a resting thumb sends no events, so it
    // was still there), else the oldest one kept.
    if (this.histN === 0) return;
    let sx = x;
    let sy = y;
    for (let k = 1; k <= this.histN; k++) {
      const i = (this.histI - k + HIST) % HIST;
      sx = this.histX[i]!;
      sy = this.histY[i]!;
      if (t - this.histT[i]! >= FLICK_MS) break;
    }
    const dx = x - sx;
    const dy = y - sy;
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    const min = this.cfg.flickPx;
    if (dx * dx + dy * dy < min * min) return;
    let cx = 0;
    let cy = 0;
    if (ax >= 2 * ay) cx = dx > 0 ? 1 : -1;
    else if (ay >= 2 * ax) cy = dy > 0 ? 1 : -1;
    else return;
    if (cx === this.dirX && cy === this.dirY) return;
    const s0 = (sx - this.originX) * cx + (sy - this.originY) * cy;
    const s1 = (x - this.originX) * cx + (y - this.originY) * cy;
    if (s0 < -FLICK_CROSS || s1 < min / 2) return;
    this.dirX = cx;
    this.dirY = cy;
    this.originX = x - cx * this.cfg.radius;
    this.originY = y - cy * this.cfg.radius;
    this.flicks++;
    // A fresh window from here: the same stroke can't flick twice.
    this.histN = 0;
  }

  end(): void {
    this.pointerId = -1;
    this.active = false;
    this.knobDX = 0;
    this.knobDY = 0;
    this.outX = 0;
    this.outY = 0;
    this.hasDir = false;
    this.dirX = 0;
    this.dirY = 0;
  }

  private compute(): void {
    const c = this.cfg;
    let dx = this.thumbX - this.originX;
    let dy = this.thumbY - this.originY;
    let d = Math.sqrt(dx * dx + dy * dy);
    if (c.follow && d > c.radius) {
      // Drag the origin so the thumb sits on the rim: the stick never "runs out".
      const k = (d - c.radius) / d;
      this.originX += dx * k;
      this.originY += dy * k;
      dx = this.thumbX - this.originX;
      dy = this.thumbY - this.originY;
      d = c.radius;
    }
    const clampK = d > c.radius ? c.radius / d : 1;
    this.knobDX = dx * clampK;
    this.knobDY = dy * clampK;

    // Analog output with deadzone remap.
    const m = Math.min(d, c.radius) / c.radius;
    if (d < 1e-6 || m <= c.deadzone) {
      this.outX = 0;
      this.outY = 0;
    } else {
      let ux = dx / d;
      let uy = dy / d;
      if (c.axisMagnet > 0) {
        const ang = Math.atan2(uy, ux);
        const q = Math.round(ang / (Math.PI / 2)) * (Math.PI / 2);
        if (Math.abs(ang - q) < c.axisMagnet) {
          ux = Math.round(Math.cos(q));
          uy = Math.round(Math.sin(q));
        }
      }
      const mag = Math.min(1, (m - c.deadzone) / (c.saturation - c.deadzone));
      this.outX = ux * mag;
      this.outY = uy * mag;
    }

    // Aim direction (committed after `activation` px; keeps last direction near the centre).
    if (d >= c.activation && d > 1e-6) {
      const ux = dx / d;
      const uy = dy / d;
      if (!this.snap4) {
        this.dirX = ux;
        this.dirY = uy;
      } else if (!this.hasDir || ux * this.dirX + uy * this.dirY < SNAP_KEEP_COS) {
        if (Math.abs(ux) >= Math.abs(uy)) {
          this.dirX = ux > 0 ? 1 : -1;
          this.dirY = 0;
        } else {
          this.dirX = 0;
          this.dirY = uy > 0 ? 1 : -1;
        }
      }
      this.hasDir = true;
    }
  }
}
