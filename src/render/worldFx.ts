/**
 * Turns sim GameEvents into juice: particles, splash rings, screen shake and flashes, plus a few
 * ambient effects read from world state each tick (fuse sparks, rising embers).
 * Presentation only — nothing here feeds back into the sim (Math.random is fine here).
 */

import type { GameEvent } from '../engine/events';
import { ENEMIES, allChampions } from '../content/registry';
import { GLOW } from '../content/sprites/palette';
import { ST_BURN, ST_CHARM, ST_FEAR, ST_FREEZE, ST_POISON } from '../sim/enemies/status';
import { SRC_STATUS } from '../sim/hittable';
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
const GOO = ['#6a7a5a', '#4a5a3a', '#9aaa7a'] as const;
const POOF = ['#8691ad', '#c9d3f0', '#5c6580', '#e9edf7'] as const;
const DIRT = ['#5a4636', '#7e664e', '#a08466', '#3a2e24'] as const;
const ICE = ['#ffffff', '#c8f4ff', '#8fd8f8', '#6fb3e0'] as const;
const STARS = ['#fff27a', '#ffffff', '#ffcf57'] as const;
const BLINK = ['#c9a0ff', '#ffffff', '#8a6ad8'] as const;
/** Particle colours per enemy shot style (ENEMY_SHOT_STYLES order). */
const SHOT_BITS: readonly (readonly string[])[] = [
  ['#a8c050', '#e4f0a0', '#5e7426'],
  ['#6fc0f0', '#eaf8ff', '#3b78b8'],
  ['#d8cce6', '#ffffff', '#9d8cb0'],
  ['#f04a6a', '#ffc0cc', '#9a1f3a'],
  ['#ffa040', '#fff0b0', '#c0501e'],
  ['#c8f4ff', '#ffffff', '#6fb3e0'],
  ['#ff8ad0', '#ffe4f4', '#b04a8a'],
];
/** Status puff colours, index = ST_*. */
const STATUS_BITS: readonly (readonly string[])[] = [
  ['#7ee06a', '#3f9a3a', '#c8ff9a'],
  ['#ffcf57', '#ff7a2a', '#fff3b0'],
  ['#ffffff', '#bff0ff', '#6fb3e0'],
  ['#b8c6d8', '#6e7e96', '#e4ebf7'],
  ['#ff8ad0', '#ffe4f4', '#c0407a'],
  ['#c9a0ff', '#7a4ad0', '#ffffff'],
];

function gooOf(id: string): readonly string[] {
  return ENEMIES.get(id)?.goo ?? GOO;
}

/** Visual body centre height of an enemy kind above its feet (flyers hover). */
function liftOf(id: string, r: number): number {
  return (ENEMIES.get(id)?.flying ? 7 : 0) + r * 0.7;
}

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
  /** Reused colour list for champion sparkles (no per-event allocation). */
  private readonly champBits: string[] = ['#ffffff', '#ffffff'];

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
    // Status ambience on enemies and dummies: flames, bubbles, frost, hearts, sweat.
    const enemies = world.enemies;
    for (let i = 0; i < enemies.count; i++) {
      const e = enemies.items[i]!;
      if (e.dead) continue;
      const ex = e.x + ROOM_X;
      if (e.burrowed) {
        if (e.moving && Math.random() < 0.25) {
          const p = P.spawn(ex + (Math.random() - 0.5) * e.r * 2, e.y + ROOM_Y, (Math.random() - 0.5) * 20, -20 - Math.random() * 20, 0.35, DIRT[(Math.random() * 4) | 0]!);
          if (p) p.gravity = 200;
        }
        continue;
      }
      const m = e.status.mask;
      if (m === 0) continue;
      this.statusAmbience(m, ex, e.y + ROOM_Y - liftOf(e.def.id, e.r), e.r);
    }
    const dummies = world.dummies;
    for (let i = 0; i < dummies.count; i++) {
      const d = dummies.items[i]!;
      if (!d.popped && d.status.mask !== 0) this.statusAmbience(d.status.mask, d.x + ROOM_X, d.y + ROOM_Y - 8, d.r);
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

  private statusAmbience(mask: number, x: number, y: number, r: number): void {
    const P = this.particles;
    if (mask & (1 << ST_BURN) && Math.random() < 0.35) {
      const p = P.spawn(x + (Math.random() - 0.5) * r * 2, y + (Math.random() - 0.3) * r, (Math.random() - 0.5) * 10, -25 - Math.random() * 25, 0.3 + Math.random() * 0.25, Math.random() < 0.5 ? '#ffcf57' : '#ff7a2a');
      if (p) p.drag = 1;
    }
    if (mask & (1 << ST_POISON) && Math.random() < 0.1) {
      const p = P.spawn(x + (Math.random() - 0.5) * r * 2, y, 0, -12 - Math.random() * 10, 0.5, Math.random() < 0.5 ? '#7ee06a' : '#c8ff9a', 1);
      if (p) p.drag = 1;
    }
    if (mask & (1 << ST_FREEZE) && Math.random() < 0.06) {
      P.spawn(x + (Math.random() - 0.5) * r * 2, y + (Math.random() - 0.5) * r * 1.5, 0, -4, 0.35, '#ffffff');
    }
    if (mask & (1 << ST_CHARM) && Math.random() < 0.05) {
      const p = P.spawn(x + (Math.random() - 0.5) * r, y - r, (Math.random() - 0.5) * 8, -18, 0.6, '#ff8ad0', 2);
      if (p) p.drag = 1.5;
    }
    if (mask & (1 << ST_FEAR) && Math.random() < 0.05) {
      const p = P.spawn(x + r * 0.8, y - r * 0.6, 8, -10, 0.4, '#c9a0ff');
      if (p) p.gravity = 120;
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
      // ── Enemies & room combat ──
      case 'enemySpawn': {
        P.burst(x, y - 3, 12, 15, 55, 0.4, POOF, 1, -25, 3);
        const r = P.spawn(x, y, 0, 0, 0.3, '#c9d3f0', 1, P_RING);
        if (r) r.endSize = Math.round(e.a + 5);
        const ch = e.b > 0 ? allChampions()[e.b - 1] : undefined;
        if (ch) this.champBits[0] = ch.color;
        if (ch) P.burst(x, y - e.a, 10, 20, 60, 0.6, this.champBits, 1, -10, 2);
        break;
      }
      case 'enemySummon': {
        P.burst(x, y - 3, 10, 15, 45, 0.4, POOF, 1, -25, 3);
        break;
      }
      case 'enemyHit': {
        const status = e.b === SRC_STATUS;
        P.burst(x, y, status ? 2 : 7, 20, 75, 0.35, gooOf(e.id), 1, 240, 2);
        if (!status) this.shake.add(0.06);
        break;
      }
      case 'enemyKilled': {
        const r = e.a;
        const by = y - liftOf(e.id, r);
        const frozen = (e.b & 1) !== 0;
        const big = (e.b & 4) !== 0;
        const colors = frozen ? ICE : gooOf(e.id);
        const n = Math.min(44, 16 + Math.round(r * 2.5));
        for (let i = 0; i < n; i++) {
          const ang = Math.random() * Math.PI * 2;
          const sp = 30 + Math.random() * (frozen ? 120 : 95);
          const p = P.spawn(x, by, Math.cos(ang) * sp, Math.sin(ang) * sp * 0.7 - 45, 0.55 + Math.random() * 0.45, colors[(Math.random() * colors.length) | 0]!, Math.random() < 0.4 ? 2 : 1);
          if (!p) break;
          p.gravity = 300;
          p.drag = 1.5;
          p.floorY = y + 1 + Math.random() * 4;
        }
        const ring = P.spawn(x, y, 0, 0, 0.3, frozen ? '#ffffff' : colors[0]!, 1, P_RING);
        if (ring) ring.endSize = Math.round(r * 2 + 4);
        const flash = P.spawn(x, by, 0, 0, 0.08, '#ffffff', Math.round(r * 1.2));
        if (flash) flash.endSize = 1;
        if ((e.b & 2) !== 0) P.burst(x, by, 14, 30, 90, 0.6, STARS, 1, 60, 2);
        this.shake.add(big ? 0.45 : 0.22);
        break;
      }
      case 'enemyShoot': {
        const bits = SHOT_BITS[e.b] ?? SHOT_BITS[0]!;
        P.burst(x, y - 5, 3 + Math.min(4, e.a), 10, 40, 0.2, bits, 1, 0, 5);
        break;
      }
      case 'enemyLob': {
        const bits = SHOT_BITS[e.b] ?? SHOT_BITS[0]!;
        P.burst(x, y - 6, 6, 20, 50, 0.3, bits, 1, 150, 3);
        break;
      }
      case 'enemyHop': {
        P.burst(x, y + 1, 4, 10, 30, 0.25, DUST, 1, 0, 6);
        break;
      }
      case 'enemyLand': {
        P.burst(x, y + 1, 6 + Math.round(e.a), 15, 45, 0.3, DUST, 1, 0, 6);
        const r = P.spawn(x, y + 1, 0, 0, 0.2, '#8691ad', 1, P_RING);
        if (r) r.endSize = Math.round(e.a + 4);
        if (e.a >= 7) this.shake.add(0.12);
        break;
      }
      case 'enemyDash': {
        for (let i = 0; i < 6; i++) {
          const p = P.spawn(x + (Math.random() - 0.5) * 6, y + (Math.random() - 0.5) * 3, -e.a * (30 + Math.random() * 40), -e.b * (30 + Math.random() * 40) - 8, 0.3, DUST[i % 3]!);
          if (p) p.drag = 4;
        }
        break;
      }
      case 'bonk': {
        P.burst(x, y - 4, 10, 30, 80, 0.45, STARS, 1, 120, 2);
        const r = P.spawn(x, y, 0, 0, 0.2, '#fff27a', 1, P_RING);
        if (r) r.endSize = Math.round(e.a + 4);
        this.shake.add(0.25);
        break;
      }
      case 'burrow': {
        if (e.a === 1) {
          P.burst(x, y, 6, 10, 35, 0.4, DIRT, 1, 160, 2);
        } else {
          P.burst(x, y, e.a === 2 ? 16 : 10, 25, 80, 0.5, DIRT, 1, 260, 1.5);
          const r = P.spawn(x, y, 0, 0, 0.25, '#7e664e', 1, P_RING);
          if (r) r.endSize = Math.round(e.b + 5);
          if (e.a === 2) this.shake.add(0.12);
        }
        break;
      }
      case 'blink': {
        P.burst(x, y - e.b, 10, 20, 60, 0.4, BLINK, 1, -20, 3);
        const r = P.spawn(x, y, 0, 0, 0.25, '#c9a0ff', 1, P_RING);
        if (r) r.endSize = Math.round(e.b + 6);
        break;
      }
      case 'shockwave': {
        P.burst(x, y, 12, 30, 70, 0.4, DUST, 1, -30, 3);
        this.shake.add(0.18);
        break;
      }
      case 'eshotPop': {
        const bits = SHOT_BITS[e.b] ?? SHOT_BITS[0]!;
        P.burst(x, y - 5, e.a === 1 ? 5 : 2, 15, 45, 0.25, bits, 1, 150, 3);
        break;
      }
      case 'lobLand': {
        const bits = SHOT_BITS[e.b] ?? SHOT_BITS[0]!;
        P.burst(x, y, 10, 20, 60, 0.4, bits, 1, 200, 2);
        const r = P.spawn(x, y, 0, 0, 0.25, bits[0]!, 1, P_RING);
        if (r) r.endSize = Math.round(e.a + 2);
        break;
      }
      case 'status': {
        const bits = STATUS_BITS[e.a];
        if (bits) P.burst(x, y, 8, 15, 45, 0.4, bits, 1, -20, 3);
        break;
      }
      case 'doors': {
        this.shake.add(e.a === 1 ? 0.2 : 0.1);
        break;
      }
      case 'roomClear': {
        for (let i = 0; i < 20; i++) {
          const p = P.spawn(x + (Math.random() - 0.5) * 24, y + Math.random() * 6, (Math.random() - 0.5) * 20, -30 - Math.random() * 50, 0.7 + Math.random() * 0.4, ITEM_RAYS[i % 3]!, i % 4 === 0 ? 2 : 1);
          if (!p) break;
          p.drag = 1.5;
        }
        const r = P.spawn(x, y, 0, 0, 0.45, '#ffd76a', 1, P_RING);
        if (r) r.endSize = 22;
        break;
      }
      default:
        break;
    }
  }
}
