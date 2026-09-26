/**
 * Trauma-based screen shake: events add trauma (0..1) which decays; the offset grows with
 * trauma² so small bumps stay subtle and big hits really kick. Scaled by Settings (0 = off).
 */

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

  add(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  kick(dx: number, dy: number): void {
    this.kickX += dx;
    this.kickY += dy;
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

  reset(): void {
    this.trauma = 0;
    this.kickX = this.kickY = 0;
    this.x = this.y = 0;
  }
}
