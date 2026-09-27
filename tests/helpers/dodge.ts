/**
 * The balance harness's eyes (polish batch 4, tests/helpers/bot.ts `human`): what a reasonable player dodges.
 * Each tick `Dodger.choose` takes the move the fight wants and picks, among 16 directions and standing still, the one
 * whose next 0.5 s is safest — then the closest to what the fight wanted. It sees:
 * - enemy shots it has watched for at least `REACTION` s (a player needs a moment to notice one), flown ahead with
 *   their curve and acceleration;
 * - the landing marks of lobs, debris and lightning strikes (they only hurt where they land);
 * - shockwave rings (they expand), hostile creep (unless flying), and boss beams (a telegraphed or firing beam, turned
 *   ahead at the speed it is sweeping), a boss's landing marker and a charge's telegraph line;
 * - foes that hurt on contact (their own movement extrapolated), keeping a buffer (tight for melee);
 * - spikes (in fights) and the reach of fires.
 * Pure reads of the World; no allocation per tick (typed scratch arrays).
 */

import { FLY_MODE, WALK_MODE, circleOverlapsGrid } from '../../src/sim/collision';
import { ROOM_H, ROOM_W, TILE } from '../../src/sim/constants';
import { ST_CHARM, ST_FREEZE, hasStatus } from '../../src/sim/enemies/status';
import { Tile } from '../../src/sim/tiles';
import { ENEMY_TUNING, HAZARD_TUNING } from '../../src/sim/tuning';
import type { World } from '../../src/sim/world';

/** Seconds a shot must have been in the air before the bot reacts to it. */
export const REACTION = 0.15;
/** Look-ahead (s) and its samples. */
const LOOK = 0.5;
const STEPS = 10;
const DT = LOOK / STEPS;
/** Candidate directions (plus standing still). */
const DIRS = 16;
const MAX_SHOTS = 400;
const MAX_FOES = 64;

const CX = new Float32Array(DIRS + 1);
const CY = new Float32Array(DIRS + 1);
for (let i = 0; i < DIRS; i++) {
  CX[i] = Math.cos((i / DIRS) * Math.PI * 2);
  CY[i] = Math.sin((i / DIRS) * Math.PI * 2);
}
CX[DIRS] = 0;
CY[DIRS] = 0;

export interface DodgeResult {
  /** The stick to push (0, 0 = stand). */
  mx: number;
  my: number;
  /** Danger of the chosen move (0 = nothing will hit; ≥ 1 = a hit it can't avoid soon). */
  danger: number;
}

export class Dodger {
  // Shots: predicted positions per sample (x, y), hit radius.
  private readonly sx = new Float32Array(MAX_SHOTS * STEPS);
  private readonly sy = new Float32Array(MAX_SHOTS * STEPS);
  private readonly sr = new Float32Array(MAX_SHOTS);
  private ns = 0;
  // Foes: position, velocity, hit radius, buffer.
  private readonly fx = new Float32Array(MAX_FOES);
  private readonly fy = new Float32Array(MAX_FOES);
  private readonly fvx = new Float32Array(MAX_FOES);
  private readonly fvy = new Float32Array(MAX_FOES);
  private readonly fr = new Float32Array(MAX_FOES);
  private readonly fdelay = new Float32Array(MAX_FOES);
  private nf = 0;
  /** Boss beams: last seen angle per beam slot of the boss (uid × 2 + i) to estimate the sweep. */
  private readonly beamAngle = new Map<number, number>();
  private readonly beamTick = new Map<number, number>();
  // Candidate path scratch.
  private readonly px = new Float32Array(STEPS);
  private readonly py = new Float32Array(STEPS);
  readonly result: DodgeResult = { mx: 0, my: 0, danger: 0 };

  /** Anything worth dodging in the room right now? (Cheap: lets the caller skip the search.) */
  threats(w: World): boolean {
    if (w.enemyShots.count > 0 || w.waves.count > 0 || w.enemies.count > 0) return true;
    for (let i = 0; i < w.creep.count; i++) if (!w.creep.items[i]!.allied) return true;
    return false;
  }

  /**
   * Picks the move: `dx, dy` is what the fight wants (any length ≤ 1; 0 = stand), `melee` keeps a tight buffer to
   * foes (it must get close), `fight` avoids spikes.
   */
  choose(w: World, dx: number, dy: number, melee: boolean, fight: boolean): DodgeResult {
    const p = w.player;
    this.collect(w, melee);
    const speed = Math.max(20, p.stats.moveSpeed);
    const flying = p.flags.flying;
    const mode = flying ? FLY_MODE : WALK_MODE;
    const want = Math.hypot(dx, dy);
    const wx = want > 1e-3 ? dx / want : 0;
    const wy = want > 1e-3 ? dy / want : 0;
    let best = Infinity;
    let bi = DIRS;
    let bd = 0;
    for (let c = 0; c <= DIRS; c++) {
      // The path over the look-ahead: full speed along the candidate, stopping where a wall or block would.
      let x = p.x;
      let y = p.y;
      let stuck = false;
      for (let k = 0; k < STEPS; k++) {
        if (!stuck && c < DIRS) {
          const nx = x + CX[c]! * speed * DT;
          const ny = y + CY[c]! * speed * DT;
          if (nx < p.r || ny < p.r || nx > ROOM_W - p.r || ny > ROOM_H - p.r || circleOverlapsGrid(w.room, nx, ny, p.r, mode)) stuck = true;
          else {
            x = nx;
            y = ny;
          }
        }
        this.px[k] = x;
        this.py[k] = y;
      }
      const danger = this.danger(w, melee, fight);
      // Closeness to what the fight wanted (standing when it wants nothing is free).
      let dev: number;
      if (c === DIRS) dev = want > 1e-3 ? 0.6 * Math.min(1, want) : 0;
      else if (want > 1e-3) dev = (1 - (CX[c]! * wx + CY[c]! * wy)) * 0.5 * Math.min(1, want + 0.3);
      else dev = 0.25;
      const score = danger * 10 + dev + (stuck ? 0.15 : 0);
      if (score < best) {
        best = score;
        bi = c;
        bd = danger;
      }
    }
    const r = this.result;
    r.mx = CX[bi]!;
    r.my = CY[bi]!;
    r.danger = bd;
    return r;
  }

  /** Reads the room's threats into the scratch arrays. */
  private collect(w: World, melee: boolean): void {
    const p = w.player;
    // Shots (lobs are handled by landing, in `danger`).
    let n = 0;
    const shots = w.enemyShots;
    const hitR = p.r * ENEMY_TUNING.playerHitScale;
    for (let i = 0; i < shots.count && n < MAX_SHOTS; i++) {
      const s = shots.items[i]!;
      if (s.allied || s.lob || s.age < REACTION) continue;
      const sp = Math.hypot(s.vx, s.vy);
      const d = Math.hypot(s.x - p.x, s.y - p.y);
      if (d - (sp + Math.abs(s.accel) * LOOK) * LOOK - 120 * LOOK > s.r + hitR + 4) continue;
      let x = s.x;
      let y = s.y;
      let vx = s.vx;
      let vy = s.vy;
      for (let k = 0; k < STEPS; k++) {
        if (s.curve !== 0) {
          const c = Math.cos(s.curve * DT);
          const sn = Math.sin(s.curve * DT);
          const nvx = vx * c - vy * sn;
          vy = vx * sn + vy * c;
          vx = nvx;
        }
        if (s.accel !== 0) {
          const v = Math.hypot(vx, vy);
          if (v > 1e-3) {
            const nv = Math.min(420, Math.max(0, v + s.accel * DT));
            vx *= nv / v;
            vy *= nv / v;
          }
        }
        x += vx * DT;
        y += vy * DT;
        this.sx[n * STEPS + k] = x;
        this.sy[n * STEPS + k] = y;
      }
      this.sr[n] = s.r + hitR + 1.5;
      n++;
    }
    this.ns = n;
    // Foes that hurt on contact.
    let f = 0;
    const foes = w.enemies;
    for (let i = 0; i < foes.count && f < MAX_FOES; i++) {
      const e = foes.items[i]!;
      if (e.dead || e.dying || e.burrowed || e.hidden || e.faded) continue;
      if (e.def.contact <= 0 || hasStatus(e.status, ST_CHARM) || hasStatus(e.status, ST_FREEZE)) continue;
      if (e.boss !== null && (e.boss.introT > 0 || w.boss.introT > 0)) continue;
      this.fx[f] = e.x;
      this.fy[f] = e.y;
      this.fvx[f] = e.vx + e.kx;
      this.fvy[f] = e.vy + e.ky;
      this.fr[f] = e.r * ENEMY_TUNING.contactScale + p.r + 1;
      this.fdelay[f] = e.spawnT;
      f++;
    }
    this.nf = f;
    void melee;
  }

  /** Danger of the path in px / py (earlier hits weigh more). */
  private danger(w: World, melee: boolean, fight: boolean): number {
    const p = w.player;
    let danger = 0;
    // Shots.
    for (let i = 0; i < this.ns; i++) {
      const r = this.sr[i]!;
      const r2 = r * r;
      for (let k = 0; k < STEPS; k++) {
        const ddx = this.px[k]! - this.sx[i * STEPS + k]!;
        const ddy = this.py[k]! - this.sy[i * STEPS + k]!;
        if (ddx * ddx + ddy * ddy < r2) {
          danger += hitAt(k);
          break;
        }
      }
    }
    const hitR = p.r * ENEMY_TUNING.playerHitScale;
    // Lobs, debris and strikes: where they land, when they land.
    const shots = w.enemyShots;
    for (let i = 0; i < shots.count; i++) {
      const s = shots.items[i]!;
      if (s.allied || !s.lob || s.age < REACTION) continue;
      const land = s.air - s.age;
      if (land > LOOK) continue;
      const k = Math.max(0, Math.min(STEPS - 1, Math.round(land / DT) - 1));
      const r = s.splash + hitR + 3;
      const ddx = this.px[k]! - s.tx;
      const ddy = this.py[k]! - s.ty;
      if (ddx * ddx + ddy * ddy < r * r) danger += hitAt(k);
    }
    // Shockwave rings.
    if (!p.flags.flying) {
      const waves = w.waves;
      for (let i = 0; i < waves.count; i++) {
        const v = waves.items[i]!;
        if (v.allied || v.hitPlayer) continue;
        for (let k = 0; k < STEPS; k++) {
          const rad = v.rad + v.speed * (k + 1) * DT;
          if (rad >= v.maxRad) break;
          const d = Math.hypot(this.px[k]! - v.x, this.py[k]! - v.y);
          if (Math.abs(d - rad) < v.band + p.r * 0.5 + 2) {
            danger += hitAt(k);
            break;
          }
        }
      }
      // Hostile creep (flat ellipses), unless it dries up first.
      const creep = w.creep;
      for (let i = 0; i < creep.count; i++) {
        const c = creep.items[i]!;
        if (c.allied || c.life < c.maxLife * 0.2) continue;
        const rr = c.r + p.r * 0.4 + 2;
        for (let k = 0; k < STEPS; k++) {
          if (c.life - (k + 1) * DT < c.maxLife * 0.2) break;
          const ddx = this.px[k]! - c.x;
          const ddy = (this.py[k]! - c.y) * 2;
          if (ddx * ddx + ddy * ddy < rr * rr) {
            danger += hitAt(k) * 0.8;
            break;
          }
        }
      }
    }
    // Foes: contact is a hit; being inside the buffer is a nudge away.
    const buffer = melee ? 2 : 14;
    for (let i = 0; i < this.nf; i++) {
      const r = this.fr[i]!;
      for (let k = 0; k < STEPS; k++) {
        const t = (k + 1) * DT;
        if (t < this.fdelay[i]!) continue;
        const ex = this.fx[i]! + this.fvx[i]! * t;
        const ey = this.fy[i]! + this.fvy[i]! * t;
        const d = Math.hypot(this.px[k]! - ex, this.py[k]! - ey);
        if (d < r) {
          danger += hitAt(k);
          break;
        }
        if (d < r + buffer) danger += 0.012 * (1 - (d - r) / buffer);
      }
    }
    // Bosses: beams (turned ahead as fast as they sweep), the landing marker, a charge's telegraph line.
    const foes = w.enemies;
    for (let i = 0; i < foes.count; i++) {
      const e = foes.items[i]!;
      const b = e.boss;
      if (!b || e.dead || e.dying || hasStatus(e.status, ST_CHARM)) continue;
      for (let j = 0; j < 2; j++) {
        const bm = b.beams[j]!;
        const key = e.uid * 2 + j;
        if (!bm.on) {
          this.beamAngle.delete(key);
          continue;
        }
        let spin = 0;
        const last = this.beamAngle.get(key);
        const lastTick = this.beamTick.get(key) ?? w.tick;
        if (last !== undefined && w.tick > lastTick) spin = (bm.angle - last) / ((w.tick - lastTick) / 60);
        this.beamAngle.set(key, bm.angle);
        this.beamTick.set(key, w.tick);
        const width = bm.width / 2 + p.r * 0.6 + 3 + (bm.tele ? 4 : 0);
        for (let k = 0; k < STEPS; k++) {
          const a = bm.angle + spin * (k + 1) * DT;
          if (beamHits(e.x, e.y, a, Math.max(bm.len, 40), width, this.px[k]!, this.py[k]!)) {
            danger += hitAt(k) * (bm.tele ? 0.7 : 1);
            break;
          }
        }
      }
      if (b.markT > 0) {
        const r = e.r + p.r + 10;
        for (let k = 0; k < STEPS; k++) {
          if ((k + 1) * DT > b.markT + 0.2) break;
          const ddx = this.px[k]! - b.markX;
          const ddy = this.py[k]! - b.markY;
          if (ddx * ddx + ddy * ddy < r * r) {
            danger += hitAt(k) * 0.8;
            break;
          }
        }
      }
      if (b.tellLine) {
        const a = Math.atan2(b.tellY, b.tellX);
        for (let k = 0; k < STEPS; k++) {
          if (beamHits(e.x, e.y, a, 220, e.r + p.r + 4, this.px[k]!, this.py[k]!)) {
            danger += hitAt(k) * 0.6;
            break;
          }
        }
      }
    }
    // Hazards: spikes in fights, and the reach of fires.
    if (!p.flags.flying && fight && !p.flags.spikeImmune) {
      for (let k = 1; k < STEPS; k += 3) {
        const col = Math.floor(this.px[k]! / TILE);
        const row = Math.floor(this.py[k]! / TILE);
        if (w.room.get(col, row) === Tile.Spikes) {
          danger += 0.35;
          break;
        }
      }
    }
    if (!p.flags.fireImmune) {
      const reach = p.r + HAZARD_TUNING.fireReach + 2;
      for (let k = 0; k < 4; k++) {
        if (nearFire(w, this.px[k]!, this.py[k]!, reach)) {
          danger += 0.4;
          break;
        }
      }
    }
    return danger;
  }
}

/** Weight of a hit at sample k: the sooner, the worse. */
function hitAt(k: number): number {
  return 1.2 - (k + 1) * DT;
}

/** Is (x, y) within `w` of the ray from (ox, oy) at angle `a` (length `len`)? */
function beamHits(ox: number, oy: number, a: number, len: number, w: number, x: number, y: number): boolean {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const px = x - ox;
  const py = y - oy;
  const t = Math.max(0, Math.min(len, px * c + py * s));
  const dx = px - c * t;
  const dy = py - s * t;
  return dx * dx + dy * dy < w * w;
}

/** A fire tile's (inset) box within `reach` of (x, y)? */
function nearFire(w: World, x: number, y: number, reach: number): boolean {
  const c0 = Math.floor((x - reach) / TILE);
  const c1 = Math.floor((x + reach) / TILE);
  const r0 = Math.floor((y - reach) / TILE);
  const r1 = Math.floor((y + reach) / TILE);
  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) {
      if (w.room.get(col, row) !== Tile.Fire) continue;
      const left = col * TILE + 2;
      const right = (col + 1) * TILE - 2;
      const top = row * TILE + 2;
      const bottom = (row + 1) * TILE - 2;
      const cx = x < left ? left : x > right ? right : x;
      const cy = y < top ? top : y > bottom ? bottom : y;
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < reach * reach) return true;
    }
  }
  return false;
}
