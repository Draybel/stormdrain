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
}

export const MOVE_STICK: StickConfig = {
  radius: 24,
  deadzone: 0.14,
  activation: 0,
  follow: true,
  axisMagnet: 7 * DEG,
  saturation: 0.85,
};

export const AIM_STICK: StickConfig = {
  radius: 20,
  deadzone: 0,
  activation: 3,
  follow: true,
  axisMagnet: 0,
  saturation: 1,
};

/** 4-way aim keeps the current direction until the thumb is this far off-axis (45° + margin). */
const SNAP_KEEP_COS = Math.cos(56 * DEG);

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

  constructor(cfg: StickConfig) {
    this.cfg = cfg;
  }

  begin(pointerId: number, x: number, y: number): void {
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
    this.compute();
  }

  move(x: number, y: number): void {
    if (!this.active) return;
    this.thumbX = x;
    this.thumbY = y;
    this.compute();
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
