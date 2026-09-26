/**
 * Turns sim GameEvents into juice: particles, splash rings, screen shake and flashes, plus a few
 * ambient effects read from world state each tick (fuse sparks, rising embers).
 * Presentation only — nothing here feeds back into the sim (Math.random is fine here).
 */

import type { GameEvent } from '../engine/events';
import { GLOW } from '../content/sprites/palette';
import { ROOM_COLS, ROOM_ROWS, TILE } from '../sim/constants';
import { PK } from '../sim/pickupKinds';
import { Tile } from '../sim/tiles';
import type { World } from '../sim/world';
import { ROOM_X, ROOM_Y } from './layout';
import { P_RING, P_SQUARE, type ParticleSystem } from './particles';
import type { ScreenShake } from './shake';

const MARBLE_BITS = [GLOW.core, GLOW.hot, GLOW.rim, GLOW.core] as const;
const STRAW_BITS = ['#dcbc86', '#b89363', '#8a6a42', '#e8d3a0'] as const;
const POP_BITS = ['#dcbc86', '#b89363', '#8a6a42', '#c63d3d', '#f3e6c8', '#e8d3a0'] as const;
const DUST = ['#5c6580', '#8691ad', '#3e455a'] as const;
const HURT_BITS = ['#e0515a', '#f5c52e', '#fff09a'] as const;
const WATER_RING = '#8fb8dc';
const GOLD = ['#fff4a8', '#f2c230', '#ffffff'] as const;
const SILVER = ['#ffffff', '#b8c2d8', '#e4ebf7'] as const;
const COPPER = ['#f0b070', '#c8773a', '#fff0c8'] as const;
const RED = ['#ff9aa0', '#e0515a', '#ffffff'] as const;
const TIN = ['#e4ebf7', '#9aa6c0', '#ffffff'] as const;
const EMBER = ['#ffd36b', '#ff7a2a', '#fff3b0'] as const;
const SPARK = ['#fff27a', '#bfe8ff', '#ffffff', '#5fb0d8'] as const;
const IRON = ['#7d89a8', '#3a4258', '#c9d3f0'] as const;
const FIRE = ['#fffbe8', '#ffcf57', '#e8862e', '#c0401e'] as const;
const SMOKE = ['#3a3f52', '#4b5068', '#2a2e3c', '#5c6178'] as const;
const WOOD = ['#9a6a3a', '#c89458', '#5e3c1e'] as const;
const CLAY = ['#b8683a', '#e89a68', '#7a3e22', '#e0c080'] as const;
const STONE = ['#5c6580', '#8691ad', '#3e455a', '#4f7447'] as const;
const TINTED = ['#7a6a62', '#a8988a', '#e0a040', '#fff0a0'] as const;
const SHOCK = ['#ffffff', '#bfe8ff', '#6fb3e0', '#fff27a'] as const;
const ITEM_RAYS = ['#fff4b0', '#ffd76a', '#ffffff'] as const;
const CHEST_GOLD = ['#fff0a0', '#e8b83a', '#d4a020', '#ffffff'] as const;

function pickupColors(kind: number): readonly string[] {
  switch (kind) {
    case PK.Coin:
      return COPPER;
    case PK.SilverCoin:
      return SILVER;
    case PK.GoldCoin:
    case PK.LuckyCoin:
    case PK.Key:
    case PK.KeyRing:
      return GOLD;
    case PK.HalfHeart:
    case PK.Heart:
      return RED;
    case PK.TinHeart:
      return TIN;
    case PK.EmberHeart:
      return EMBER;
    case PK.SparkSmall:
    case PK.SparkFull:
      return SPARK;
    case PK.Bomb:
    case PK.DoubleBomb:
      return IRON;
    default:
      return GOLD;
  }
}

function tileColors(t: number): readonly string[] {
  switch (t) {
    case Tile.Crate:
      return WOOD;
    case Tile.Urn:
      return CLAY;
    case Tile.Fire:
      return FIRE;
    case Tile.RockTinted:
      return TINTED;
    default:
      return STONE;
  }
}

export class WorldFx {
  /** Full-screen white flash (0..1), drawn by the run scene; decays quickly. */
  flash = 0;

  constructor(
    private readonly particles: ParticleSystem,
    private readonly shake: ScreenShake,
  ) {}

  /** Per-tick ambient effects from world state (fuse sparks, embers). */
  tick(world: World, dt: number): void {
    const P = this.particles;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 7);
    const bombs = world.bombs;
    for (let i = 0; i < bombs.count; i++) {
      const b = bombs.items[i]!;
      if (Math.random() < 0.55) {
        const p = P.spawn(b.x + ROOM_X + 3, b.y + ROOM_Y - 8, (Math.random() - 0.5) * 40, -20 - Math.random() * 40, 0.18 + Math.random() * 0.12, Math.random() < 0.5 ? '#fff3b0' : '#ffcf57');
        if (p) {
          p.gravity = 160;
          p.drag = 2;
        }
      }
    }
    const room = world.room;
    for (let r = 0; r < ROOM_ROWS; r++) {
      for (let c = 0; c < ROOM_COLS; c++) {
        if (room.tiles[r * ROOM_COLS + c] !== Tile.Fire || Math.random() > 0.12) continue;
        const p = P.spawn(
          c * TILE + ROOM_X + 4 + Math.random() * 8,
          r * TILE + ROOM_Y + 4 + Math.random() * 4,
          (Math.random() - 0.5) * 10,
          -18 - Math.random() * 18,
          0.6 + Math.random() * 0.5,
          Math.random() < 0.6 ? '#ffcf57' : '#ff7a2a',
        );
        if (p) p.drag = 0.8;
      }
    }
  }

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
        // Burst where the marble visibly was (b = its height), droplets rain down to the floor.
        const wall = e.a === 1;
        const by = y - e.b;
        const flash = P.spawn(x, by, 0, 0, wall ? 0.08 : 0.06, GLOW.hot, wall ? 4 : 3);
        if (flash) flash.endSize = 1;
        const n = wall ? 8 : 6;
        for (let i = 0; i < n; i++) {
          const ang = Math.random() * Math.PI * 2;
          const sp = 30 + Math.random() * 50;
          const p = P.spawn(x, by, Math.cos(ang) * sp, Math.sin(ang) * sp * 0.6 - 35, 0.3 + Math.random() * 0.18, MARBLE_BITS[i & 3]!, i < 2 ? 2 : 1);
          if (!p) break;
          p.gravity = 300;
          p.drag = 2;
          p.floorY = y + 1 + Math.random() * 2;
        }
        const ring = P.spawn(x, y, 0, 0, wall ? 0.22 : 0.28, wall ? GLOW.core : WATER_RING, 1, P_RING);
        if (ring) ring.endSize = wall ? 5 : 6;
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
      case 'pickup': {
        const colors = pickupColors(e.a);
        // Sparkle burst + a quick rising twinkle.
        for (let i = 0; i < 9; i++) {
          const ang = Math.random() * Math.PI * 2;
          const sp = 25 + Math.random() * 45;
          const p = P.spawn(x, y - 3, Math.cos(ang) * sp, Math.sin(ang) * sp - 25, 0.35 + Math.random() * 0.2, colors[i % colors.length]!);
          if (!p) break;
          p.drag = 4;
          p.gravity = 40;
        }
        const ring = P.spawn(x, y - 2, 0, 0, 0.2, colors[0]!, 1, P_RING);
        if (ring) ring.endSize = 6;
        break;
      }
      case 'land': {
        if (e.b > 90) {
          const p = P.spawn(x - 2, y, -12, -4, 0.18, '#5c6580');
          if (p) p.drag = 6;
          const q = P.spawn(x + 2, y, 12, -4, 0.18, '#5c6580');
          if (q) q.drag = 6;
        }
        break;
      }
      case 'loot': {
        const r = P.spawn(x, y, 0, 0, 0.25, '#fff4b0', 1, P_RING);
        if (r) r.endSize = 9;
        break;
      }
      case 'item': {
        // Light rays rising around the raised item, and a golden burst.
        for (let i = 0; i < 18; i++) {
          const p = P.spawn(x + (Math.random() - 0.5) * 16, y + 4 + Math.random() * 6, 0, -40 - Math.random() * 50, 0.5 + Math.random() * 0.3, ITEM_RAYS[i % 3]!, i % 4 === 0 ? 2 : 1);
          if (!p) break;
          p.drag = 1.5;
        }
        P.burst(x, y, 14, 30, 80, 0.45, ITEM_RAYS, 1, 60, 3);
        const r = P.spawn(x, y + 16, 0, 0, 0.35, '#ffd76a', 1, P_RING);
        if (r) r.endSize = 14;
        this.shake.add(0.12);
        break;
      }
      case 'chest': {
        const colors = e.a === PK.Lockbox ? CHEST_GOLD : WOOD;
        P.burst(x, y, 16, 30, 90, 0.5, colors, 1, 220, 2);
        P.burst(x, y - 2, 8, 20, 60, 0.4, GOLD, 1, 60, 3);
        const r = P.spawn(x, y + 3, 0, 0, 0.3, '#fff4b0', 1, P_RING);
        if (r) r.endSize = 12;
        this.shake.add(0.2);
        break;
      }
      case 'heal': {
        const colors = e.b === 1 ? EMBER : RED;
        for (let i = 0; i < 8; i++) {
          const p = P.spawn(x + (Math.random() - 0.5) * 12, y + Math.random() * 6, (Math.random() - 0.5) * 10, -30 - Math.random() * 25, 0.5 + Math.random() * 0.25, colors[i % colors.length]!, i < 3 ? 2 : 1);
          if (!p) break;
          p.drag = 2;
        }
        break;
      }
      case 'heartBreak': {
        P.burst(x, y, 10, 30, 90, 0.5, TIN, 1, 260, 1.5);
        break;
      }
      case 'nova': {
        const colors = e.id === 'ember' ? EMBER : SHOCK;
        const radius = e.a;
        // A fast ring of sparks reaching the nova radius, plus a flash at the centre.
        const n = 32;
        for (let i = 0; i < n; i++) {
          const ang = (i / n) * Math.PI * 2 + Math.random() * 0.1;
          const sp = radius / 0.22;
          const p = P.spawn(x, y, Math.cos(ang) * sp, Math.sin(ang) * sp * 0.75, 0.24 + Math.random() * 0.08, colors[i % colors.length]!, i % 3 === 0 ? 2 : 1);
          if (!p) break;
          p.drag = 3.5;
        }
        const core = P.spawn(x, y, 0, 0, 0.12, '#ffffff', 6);
        if (core) core.endSize = 1;
        this.flash = Math.max(this.flash, 0.35);
        this.shake.add(0.35);
        break;
      }
      case 'bombPlaced': {
        P.burst(x, y + 1, 5, 10, 30, 0.25, DUST, 1, 0, 5);
        break;
      }
      case 'explosion': {
        const radius = e.a;
        this.flash = 1;
        this.shake.add(0.75);
        this.shake.kick((Math.random() - 0.5) * 4, -2);
        // Fireball core.
        for (let i = 0; i < 26; i++) {
          const ang = Math.random() * Math.PI * 2;
          const sp = 40 + Math.random() * 110;
          const p = P.spawn(x, y - 4, Math.cos(ang) * sp, Math.sin(ang) * sp * 0.7 - 20, 0.25 + Math.random() * 0.25, FIRE[i % FIRE.length]!, 2 + (i % 3));
          if (!p) break;
          p.drag = 5;
          p.endSize = 1;
        }
        // Rolling smoke.
        for (let i = 0; i < 18; i++) {
          const ang = Math.random() * Math.PI * 2;
          const d = Math.random() * radius * 0.5;
          const p = P.spawn(x + Math.cos(ang) * d, y + Math.sin(ang) * d * 0.6 - 4, Math.cos(ang) * 25, -15 - Math.random() * 25, 0.8 + Math.random() * 0.6, SMOKE[i % SMOKE.length]!, 3 + (i % 2));
          if (!p) break;
          p.drag = 1.5;
          p.endSize = 1;
        }
        // Debris chunks bouncing on the floor.
        for (let i = 0; i < 14; i++) {
          const ang = Math.random() * Math.PI * 2;
          const sp = 60 + Math.random() * 90;
          const p = P.spawn(x, y - 2, Math.cos(ang) * sp, Math.sin(ang) * sp * 0.6 - 70, 0.7 + Math.random() * 0.4, STONE[i % STONE.length]!, i % 3 === 0 ? 2 : 1);
          if (!p) break;
          p.gravity = 320;
          p.drag = 1.2;
          p.floorY = y + 4 + Math.random() * 8;
        }
        const ring = P.spawn(x, y, 0, 0, 0.3, '#fff3b0', 1, P_RING);
        if (ring) ring.endSize = Math.round(radius);
        const ring2 = P.spawn(x, y, 0, 0, 0.45, '#8691ad', 1, P_RING);
        if (ring2) ring2.endSize = Math.round(radius * 0.7);
        break;
      }
      case 'tileHit': {
        P.burst(x, y, 5, 20, 60, 0.3, tileColors(e.a), 1, 220, 2);
        if (e.a === Tile.Fire) P.burst(x, y - 4, 6, 10, 40, 0.5, SMOKE, 2, -30, 2);
        break;
      }
      case 'tileBreak': {
        const colors = tileColors(e.a);
        for (let i = 0; i < 16; i++) {
          const ang = Math.random() * Math.PI * 2;
          const sp = 30 + Math.random() * 80;
          const p = P.spawn(x, y - 2, Math.cos(ang) * sp, Math.sin(ang) * sp * 0.6 - 60, 0.6 + Math.random() * 0.4, colors[i % colors.length]!, i % 3 === 0 ? 2 : 1);
          if (!p) break;
          p.gravity = 300;
          p.drag = 1.5;
          p.floorY = y + 5 + Math.random() * 3;
        }
        if (e.a === Tile.Fire) P.burst(x, y - 4, 12, 10, 40, 0.9, SMOKE, 3, -40, 1.5);
        else P.burst(x, y + 4, 8, 10, 30, 0.4, DUST, 1, -10, 3);
        this.shake.add(0.14);
        break;
      }
      case 'activeUse': {
        P.burst(x, y, 12, 30, 80, 0.4, e.a === 1 ? RED : SPARK, 1, 0, 3);
        break;
      }
      case 'charged': {
        P.burst(x, y, 8, 20, 50, 0.4, SPARK, 1, -20, 3);
        break;
      }
      case 'triggered': {
        P.burst(x, y - 6, 4, 10, 30, 0.3, GOLD, 1, 0, 3);
        break;
      }
      default:
        break;
    }
  }
}
