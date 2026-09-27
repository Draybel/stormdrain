/**
 * Trauma-based screen shake: events add trauma (0..1) which decays; the offset grows with
 * trauma² so small bumps stay subtle and big hits really kick. Scaled by Settings (0 = off).
 *
 * Ceilings (polish batch 2): every source says how high its trauma may go — an add can only raise the trauma UP TO
 * its ceiling (never above it, never lowering what is already there). Hits reach 0.15, the player's own shot blasts
 * 0.35, kills 0.4; only the big moments (the Storm Lance release, placed bombs, getting hurt, boss roars and deaths,
 * actives) may take it to 1. So a stacked build's hundreds of hits and blasts a second hum along at ≤ 1 px instead of
 * pinning the screen at ±5 px, and the lance, a bomb or a hurt still stand out.
 */

/** Trauma ceilings per kind of source. */
export const SHAKE_HIT = 0.15;
export const SHAKE_BLAST = 0.35;
export const SHAKE_KILL = 0.4;
export const SHAKE_BIG = 1;
/** Kick ceilings (px): hits, and the big default (lance recoil, hurts, placed bombs). */
export const KICK_HIT = 1.5;
export const KICK_MAX = 6;

export class ScreenShake {
  trauma = 0;
  /** Current offset in whole game pixels. */
  x = 0;
  y = 0;
  /** Settings multiplier (0..1+). */
  scale = 1;
  /** Max offset in px at trauma 1. */
  maxOffset = 5;
  /** Trauma lost per second. */
  decay = 2.4;
  private t = 0;
  /** A short directional kick (px) that springs back — used for impacts. */
  private kickX = 0;
  private kickY = 0;

  /** Adds trauma, raising it at most up to `ceiling` (a source's category, SHAKE_*). */
  add(amount: number, ceiling: number = SHAKE_BIG): void {
    if (!(amount > 0) || this.trauma >= ceiling) return;
    this.trauma = Math.min(ceiling, 1, this.trauma + amount);
  }

  /**
   * A directional kick (px) that springs back. Like trauma it has a ceiling: kicks add up to at most `max` px (a
   * burst of melee hits in one tick can't stack into a 15 px lurch; the lance and hurts may go further).
   */
  kick(dx: number, dy: number, max = KICK_MAX): void {
    const before = Math.hypot(this.kickX, this.kickY);
    let kx = this.kickX + dx;
    let ky = this.kickY + dy;
    const m = Math.hypot(kx, ky);
    const cap = Math.max(max, before);
    if (m > cap) {
      kx *= cap / m;
      ky *= cap / m;
    }
    this.kickX = kx;
    this.kickY = ky;
  }

  update(dt: number): void {
    this.t += dt;
    this.trauma = Math.max(0, this.trauma - this.decay * dt);
    const k = Math.exp(-18 * dt);
    this.kickX *= k;
    this.kickY *= k;
    const s = this.trauma * this.trauma * this.maxOffset * this.scale;
    const t = this.t;
    // Cheap smooth pseudo-noise from incommensurate sines (no allocation, no RNG).
    const nx = (Math.sin(t * 71.3) + Math.sin(t * 43.7 + 1.3)) * 0.5;
    const ny = (Math.sin(t * 67.1 + 2.1) + Math.sin(t * 37.9 + 0.4)) * 0.5;
    this.x = Math.round(nx * s + this.kickX * this.scale);
    this.y = Math.round(ny * s + this.kickY * this.scale);
  }

  /** Offset magnitude this frame (px, for tests and tools). */
  get offset(): number {
    return Math.hypot(this.x, this.y);
  }

  reset(): void {
    this.trauma = 0;
    this.kickX = this.kickY = 0;
    this.x = this.y = 0;
  }
}
