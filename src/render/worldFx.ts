/**
 * Turns sim GameEvents into juice: particles, splash rings and screen shake.
 * Presentation only — nothing here feeds back into the sim.
 */

import type { GameEvent } from '../engine/events';
import { GLOW } from '../content/sprites/palette';
import { ROOM_X, ROOM_Y } from './layout';
import { P_RING, P_SQUARE, type ParticleSystem } from './particles';
import type { ScreenShake } from './shake';

const MARBLE_BITS = [GLOW.core, GLOW.hot, GLOW.rim, GLOW.core] as const;
const STRAW_BITS = ['#dcbc86', '#b89363', '#8a6a42', '#e8d3a0'] as const;
const POP_BITS = ['#dcbc86', '#b89363', '#8a6a42', '#c63d3d', '#f3e6c8', '#e8d3a0'] as const;
const DUST = ['#5c6580', '#8691ad', '#3e455a'] as const;
const HURT_BITS = ['#e0515a', '#f5c52e', '#fff09a'] as const;
const WATER_RING = '#8fb8dc';

export class WorldFx {
  constructor(
    private readonly particles: ParticleSystem,
    private readonly shake: ScreenShake,
  ) {}

  onEvent(e: GameEvent): void {
    const P = this.particles;
    const x = e.x + ROOM_X;
    const y = e.y + ROOM_Y;
    switch (e.type) {
      case 'shoot': {
        // Tiny muzzle sparkle along the shot direction.
        for (let i = 0; i < 2; i++) {
          const sp = 30 + Math.random() * 30;
          const p = P.spawn(x, y, e.a * sp + (Math.random() - 0.5) * 20, e.b * sp + (Math.random() - 0.5) * 20, 0.12, GLOW.hot);
          if (p) p.drag = 8;
        }
        break;
      }
      case 'splash': {
        if (e.a === 2) {
          // Fell into a pit: a faint glint, then gone.
          P.spawn(x, y, 0, 6, 0.2, GLOW.rim);
          break;
        }
        const n = e.a === 1 ? 7 : 5;
        for (let i = 0; i < n; i++) {
          const ang = Math.random() * Math.PI * 2;
          const sp = 25 + Math.random() * 45;
          const p = P.spawn(x, y - (e.a === 1 ? 4 : 0), Math.cos(ang) * sp, Math.sin(ang) * sp * 0.6 - 30, 0.28 + Math.random() * 0.15, MARBLE_BITS[i & 3]!);
          if (!p) break;
          p.gravity = 260;
          p.drag = 2;
          p.floorY = y + 2;
        }
        const ring = P.spawn(x, y, 0, 0, 0.22, e.a === 1 ? GLOW.core : WATER_RING, 1, P_RING);
        if (ring) ring.endSize = 5;
        break;
      }
      case 'hit': {
        P.burst(x, y, 5, 20, 60, 0.3, STRAW_BITS, 1, 200, 2);
        this.shake.add(0.07);
        break;
      }
      case 'pop': {
        for (let i = 0; i < 28; i++) {
          const ang = Math.random() * Math.PI * 2;
          const sp = 30 + Math.random() * 90;
          const p = P.spawn(
            x,
            y,
            Math.cos(ang) * sp + e.a * 30,
            Math.sin(ang) * sp * 0.7 - 50 + e.b * 30,
            0.6 + Math.random() * 0.5,
            POP_BITS[(Math.random() * POP_BITS.length) | 0]!,
            Math.random() < 0.35 ? 2 : 1,
            P_SQUARE,
          );
          if (!p) break;
          p.gravity = 300;
          p.drag = 1.5;
          p.floorY = y + 8 + Math.random() * 3;
        }
        const r1 = P.spawn(x, y + 8, 0, 0, 0.3, '#f3e6c8', 2, P_RING);
        if (r1) r1.endSize = 11;
        this.shake.add(0.38);
        this.shake.kick(e.a * 2, e.b * 2);
        break;
      }
      case 'spawn': {
        P.burst(x, y + 6, 10, 10, 40, 0.35, DUST, 1, -20, 3);
        const r = P.spawn(x, y + 6, 0, 0, 0.25, '#8691ad', 1, P_RING);
        if (r) r.endSize = 8;
        break;
      }
      case 'hurt': {
        P.burst(x, y, 10, 30, 80, 0.4, HURT_BITS, 1, 200, 2);
        this.shake.add(0.5);
        break;
      }
      case 'death': {
        P.burst(x, y, 24, 30, 110, 0.8, HURT_BITS, 2, 220, 1.5);
        this.shake.add(0.7);
        break;
      }
      case 'shake':
        this.shake.add(e.a);
        break;
      default:
        break;
    }
  }
}
