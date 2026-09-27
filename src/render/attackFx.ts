/**
 * Juice for the attack pipeline (presentation only — Math.random is fine here):
 * - Storm Lance: sparks gathering while it charges, a ready burst, and on release a BLINDING
 *   blue-white full-screen flash, heavy shake with a recoil kick, a burst at the muzzle, sparks
 *   crawling along the beam and spraying where it bites into the wall and into enemies;
 * - trails behind styled shots (embers, bubbles, ice, sparks, wisps, dust, drops), bounce sparks,
 *   split shards, chain-lightning arcs (drawn as jagged lines for a few frames), swipe streaks,
 *   blade catches, keeper-marble sparkles, familiar poofs, and costume sparks around the player.
 * The owner (WorldFx) forwards unknown events here and calls `tick` / `drawArcs`.
 */

import type { GameEvent } from '../engine/events';
import { findItem } from '../content/registry';
import { BK_LANCE, BK_LASER } from '../sim/attack/beam';
import { CM_LANCE } from '../sim/attack/profile';
import { F_BOMB, F_FALLING } from '../sim/attack/state';
import { ATTACK_TUNING } from '../sim/tuning';
import { costumeList, type TrailKind } from '../sim/types';
import type { World } from '../sim/world';
import { ROOM_X, ROOM_Y } from './layout';
import { P_RING, P_STREAK, type ParticleSystem } from './particles';
import type { ScreenShake } from './shake';

const BOLT = ['#ffffff', '#e6f6ff', '#9fdcff', '#5fb0f0'] as const;
const GOLD = ['#fff4b0', '#ffcf57', '#ffffff'] as const;
const PUFF = ['#8691ad', '#c9d3f0', '#5c6580'] as const;
const EMBER = ['#ffcf57', '#ff7a2a', '#fff3b0'] as const;
const ICE = ['#ffffff', '#c8f4ff', '#8fd8f8'] as const;
const IMPACT = ['#ffffff', '#fff4b0', '#dfe6f2'] as const;

/** Presentation hooks the attack effects need from their owner. */
export interface FlashSink {
  flash: number;
  flashColor: string;
  flashMax: number;
  /** Flash fade speed (1/s). */
  flashDecay: number;
}

const ARCS = 40;

export class AttackFx {
  /** Chain-lightning arcs: from, to, life left (s), colour. */
  private readonly ax1 = new Float32Array(ARCS);
  private readonly ay1 = new Float32Array(ARCS);
  private readonly ax2 = new Float32Array(ARCS);
  private readonly ay2 = new Float32Array(ARCS);
  private readonly alife = new Float32Array(ARCS);
  private readonly acol: string[] = new Array<string>(ARCS).fill('#fff27a');
  private ahead = 0;
  /** Reusable 2-colour list for style-coloured bursts. */
  private readonly tint: string[] = ['#ffffff', '#ffffff', '#ffffff'];
  private sparkColor = '';
  private sparkFor = -1;

  constructor(
    private readonly particles: ParticleSystem,
    private readonly shake: ScreenShake,
    private readonly sink: FlashSink,
  ) {}

  private tinted(c: string): readonly string[] {
    const t = this.tint;
    t[0] = c || '#ffcf57';
    t[1] = '#ffffff';
    t[2] = c || '#ffe08a';
    return t;
  }

  /** Handles attack events; returns false for events it doesn't know. */
  onEvent(e: GameEvent): boolean {
    const P = this.particles;
    const x = e.x + ROOM_X;
    const y = e.y + ROOM_Y;
    const h = ATTACK_TUNING.beamHeight;
    switch (e.type) {
      case 'shotBounce': {
        P.burst(x, y - 6, 4, 20, 60, 0.2, this.tinted(e.id), 1, 0, 6);
        const r = P.spawn(x, y, 0, 0, 0.15, '#ffffff', 1, P_RING);
        if (r) r.endSize = 4;
        return true;
      }
      case 'shotSplit': {
        P.burst(x, y - 6, 6 + e.a * 2, 30, 90, 0.3, this.tinted(e.id), 1, 60, 3);
        return true;
      }
      case 'chainArc': {
        const i = this.ahead;
        this.ahead = (i + 1) % ARCS;
        this.ax1[i] = e.x;
        this.ay1[i] = e.y;
        this.ax2[i] = e.a;
        this.ay2[i] = e.b;
        this.alife[i] = 0.14;
        this.acol[i] = e.id || '#fff27a';
        P.burst(e.a + ROOM_X, e.b + ROOM_Y, 5, 30, 80, 0.2, BOLT, 1, 0, 5);
        return true;
      }
      case 'bladeCatch': {
        P.burst(x, y - 6, 6, 20, 50, 0.25, GOLD, 1, 0, 5);
        return true;
      }
      case 'bladeSpawn': {
        P.burst(x, y - 6, 5, 15, 40, 0.3, PUFF, 1, -10, 4);
        return true;
      }
      case 'swipe': {
        // Streaks flung along the arc.
        const mini = e.id === 'mini';
        for (let k = 0; k < (mini ? 3 : 7); k++) {
          const a = Math.atan2(e.b, e.a) + (Math.random() - 0.5) * 1.8;
          const sp = 60 + Math.random() * 80;
          const p = P.spawn(x + Math.cos(a) * 10, y - 5 + Math.sin(a) * 10, Math.cos(a) * sp, Math.sin(a) * sp, 0.14, k % 2 ? '#ffffff' : '#dfe6f2', 1);
          if (p) p.drag = 8;
        }
        return true;
      }
      case 'swipeHit': {
        P.burst(x, y, 8, 40, 110, 0.25, IMPACT, 1, 100, 4);
        this.shake.add(0.12);
        this.shake.kick(e.a * 1.5, e.b * 1.5);
        return true;
      }
      case 'lanceCharge': {
        // Crackle ticks while holding a full charge.
        if (e.a >= 1) P.burst(x, y - 2, 3, 30, 70, 0.15, BOLT, 1, 0, 6);
        return true;
      }
      case 'lanceReady': {
        P.burst(x, y, e.a >= 2 ? 22 : 14, 40, 110, 0.35, e.a >= 2 ? GOLD : BOLT, 1, 0, 4);
        const r = P.spawn(x, y + 8, 0, 0, 0.25, e.a >= 2 ? '#fff27a' : '#bfe8ff', 1, P_RING);
        if (r) r.endSize = 12;
        this.shake.add(0.1);
        return true;
      }
      case 'lanceFire': {
        const mini = e.id === 'mini';
        const ca = Math.cos(e.b);
        const sa = Math.sin(e.b);
        if (mini) {
          this.sink.flash = Math.max(this.sink.flash, 0.3);
          this.shake.add(0.15);
        } else {
          // Blinding flash, heavy shake, a recoil kick against the beam.
          this.sink.flash = 1;
          this.sink.flashColor = '#e2f5ff';
          this.sink.flashMax = 0.85;
          this.sink.flashDecay = 3.5;
          this.shake.add(1);
          this.shake.kick(-ca * 5, -sa * 5);
        }
        const n = mini ? 8 : 26;
        for (let k = 0; k < n; k++) {
          const a = e.b + (Math.random() - 0.5) * 2.4;
          const sp = 60 + Math.random() * 160;
          const p = P.spawn(x + ca * 6, y - h + sa * 6, Math.cos(a) * sp, Math.sin(a) * sp, 0.25 + Math.random() * 0.2, BOLT[k & 3]!, k % 5 === 0 ? 2 : 1);
          if (p) p.drag = 5;
        }
        const r = P.spawn(x, y, 0, 0, 0.3, '#bfe8ff', 1, P_RING);
        if (r) r.endSize = mini ? 8 : 18;
        return true;
      }
      case 'lanceFizzle': {
        P.burst(x, y, 7, 15, 45, 0.3, PUFF, 1, -30, 3);
        P.burst(x, y, 3, 30, 60, 0.15, BOLT, 1, 0, 5);
        return true;
      }
      case 'laserFire': {
        const ca = Math.cos(e.b);
        const sa = Math.sin(e.b);
        for (let k = 0; k < (e.id === 'mini' ? 1 : 3); k++) {
          const p = P.spawn(x + ca * 5, y - h + sa * 5, ca * (40 + Math.random() * 60) + (Math.random() - 0.5) * 30, sa * (40 + Math.random() * 60) + (Math.random() - 0.5) * 30, 0.1, '#ffffff');
          if (p) p.drag = 6;
        }
        if (e.id !== 'mini') this.shake.add(0.04);
        return true;
      }
      case 'beamHit': {
        for (let k = 0; k < 4; k++) {
          const a = Math.random() * Math.PI * 2;
          const sp = 50 + Math.random() * 100;
          const p = P.spawn(x, y, Math.cos(a) * sp, Math.sin(a) * sp - 30, 0.18 + Math.random() * 0.12, BOLT[k & 3]!);
          if (p) {
            p.drag = 4;
            p.gravity = 200;
          }
        }
        return true;
      }
      case 'chargeTick': {
        const a = Math.random() * Math.PI * 2;
        const p = P.spawn(x + Math.cos(a) * 14, y + Math.sin(a) * 10, -Math.cos(a) * 50, -Math.sin(a) * 36, 0.25, GOLD[(Math.random() * 3) | 0]!);
        if (p) p.drag = 2;
        return true;
      }
      case 'chargeReady': {
        P.burst(x, y, 12, 30, 80, 0.3, GOLD, 1, 0, 4);
        return true;
      }
      case 'chargeRelease': {
        P.burst(x, y, 4 + Math.round(e.a * 12), 30, 60 + e.a * 80, 0.3, GOLD, 1, 0, 4);
        this.shake.add(0.1 + e.a * 0.3);
        return true;
      }
      case 'keeper': {
        P.burst(x, y, 12, 30, 90, 0.4, GOLD, 1, 0, 3);
        const r = P.spawn(x, y, 0, 0, 0.25, '#fff4b0', 1, P_RING);
        if (r) r.endSize = 8;
        return true;
      }
      case 'familiar': {
        P.burst(x, y - 4, 12, 15, 50, 0.4, PUFF, 1, -20, 3);
        P.burst(x, y - 4, 6, 20, 50, 0.4, GOLD, 1, -20, 3);
        return true;
      }
      default:
        return false;
    }
  }

  /** Per tick: shot trails, beam sparks, lance charge sparks, costume sparks. */
  tick(w: World, dt: number): void {
    const P = this.particles;
    for (let i = 0; i < ARCS; i++) if (this.alife[i]! > 0) this.alife[i] = this.alife[i]! - dt;

    // Trails: fewer per shot when there are many shots (the particle cap is shared).
    const shots = w.projectiles;
    const rate = Math.min(0.6, 50 / Math.max(1, shots.count));
    for (let i = 0; i < shots.count; i++) {
      const s = shots.items[i]!;
      const st = s.style;
      if (!st || Math.random() > rate) continue;
      const bomb = (s.flags & F_BOMB) !== 0;
      const trails = st.trails;
      if (trails.length === 0 && !bomb) continue;
      const sx = s.x + ROOM_X;
      const sy = s.y + ROOM_Y - s.z;
      if (bomb && (trails.length === 0 || Math.random() < 0.5)) {
        const p = P.spawn(sx + 1, sy - s.size - 1, (Math.random() - 0.5) * 30, -20 - Math.random() * 30, 0.15, Math.random() < 0.5 ? '#fff3b0' : '#ffcf57');
        if (p) p.gravity = 120;
        continue;
      }
      const k = (i + w.tick) % trails.length;
      this.trail(trails[k]!, st.trailColors[k]!, sx, sy, s.size, (s.flags & F_FALLING) !== 0);
    }

    // Beams: sparks crawling along the lance, spraying off the wall it hits.
    const beams = w.atk.beams;
    const h = ATTACK_TUNING.beamHeight;
    for (let i = 0; i < beams.count; i++) {
      const b = beams.items[i]!;
      if (b.n < 2) continue;
      const lance = b.kind === BK_LANCE;
      if (!lance && b.kind !== BK_LASER) continue;
      const along = lance ? 3 : 0;
      for (let k = 0; k < along; k++) {
        const j = (Math.random() * (b.segLen[0]! - 1)) | 0;
        const x = b.px[j]! + ROOM_X;
        const y = b.py[j]! + ROOM_Y - h;
        const p = P.spawn(x + (Math.random() - 0.5) * b.width, y + (Math.random() - 0.5) * b.width * 0.6, (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60 - 20, 0.12 + Math.random() * 0.1, BOLT[k & 3]!);
        if (p) p.drag = 6;
      }
      if (b.endWall && (lance || Math.random() < 0.4)) {
        const ex = b.endX + ROOM_X;
        const ey = b.endY + ROOM_Y - h;
        for (let k = 0; k < (lance ? 3 : 1); k++) {
          const a = Math.random() * Math.PI * 2;
          const sp = 40 + Math.random() * 120;
          const p = P.spawn(ex, ey, Math.cos(a) * sp, Math.sin(a) * sp - 40, 0.2 + Math.random() * 0.2, BOLT[(k + 1) & 3]!);
          if (p) {
            p.gravity = 260;
            p.drag = 2;
            p.floorY = ey + h + 3;
          }
        }
      }
    }

    // The lance charging: sparks drawn in toward Wren.
    const pl = w.player;
    if (pl.atk.charging && pl.attack.chargeMode === CM_LANCE && !pl.dead) {
      const c = Math.min(1, pl.atk.charge);
      const n = c >= 1 ? 2 : Math.random() < 0.3 + c * 0.7 ? 1 : 0;
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2;
        const d = 12 + Math.random() * 8;
        const px = pl.x + ROOM_X + Math.cos(a) * d;
        const py = pl.y + ROOM_Y - 7 + Math.sin(a) * d * 0.8;
        const p = P.spawn(px, py, -Math.cos(a) * d * 5, -Math.sin(a) * d * 4, 0.18, BOLT[(Math.random() * 4) | 0]!);
        if (p) p.fade = false;
      }
    }

    // Costume sparks (the Storm Lance crackles around you).
    const L = pl.loadout;
    if (this.sparkFor !== L.version) {
      this.sparkFor = L.version;
      this.sparkColor = '';
      for (const id of L.costumes) {
        for (const c of costumeList(findItem(id)?.costume)) if (c.sparks) this.sparkColor = c.sparks;
      }
    }
    if (this.sparkColor && !pl.dead && Math.random() < 0.18) {
      const a = Math.random() * Math.PI * 2;
      const p = P.spawn(pl.x + ROOM_X + Math.cos(a) * 8, pl.y + ROOM_Y - 7 + Math.sin(a) * 9, (Math.random() - 0.5) * 30, -10 - Math.random() * 20, 0.16, Math.random() < 0.5 ? '#ffffff' : this.sparkColor);
      if (p) p.drag = 3;
    }
  }

  private trail(kind: TrailKind, color: string, x: number, y: number, r: number, falling: boolean): void {
    const P = this.particles;
    const jx = (Math.random() - 0.5) * r;
    const jy = (Math.random() - 0.5) * r;
    switch (kind) {
      case 'embers': {
        const p = P.spawn(x + jx, y + jy, (Math.random() - 0.5) * 12, -18 - Math.random() * 18, 0.3 + Math.random() * 0.2, EMBER[(Math.random() * 3) | 0]!);
        if (p) p.drag = 1.5;
        break;
      }
      case 'bubbles': {
        const p = P.spawn(x + jx, y + jy, 0, -10 - Math.random() * 8, 0.45, Math.random() < 0.5 ? color : '#c8ff9a', 1, P_RING);
        if (p) p.endSize = 2;
        break;
      }
      case 'ice': {
        const p = P.spawn(x + jx, y + jy, (Math.random() - 0.5) * 10, 8 + Math.random() * 12, 0.35, ICE[(Math.random() * 3) | 0]!);
        if (p) p.drag = 2;
        break;
      }
      case 'sparks': {
        const p = P.spawn(x + jx, y + jy, (Math.random() - 0.5) * 50, (Math.random() - 0.5) * 50, 0.12, Math.random() < 0.5 ? '#ffffff' : color);
        if (p) p.drag = 6;
        break;
      }
      case 'wisps': {
        const p = P.spawn(x + jx, y + jy, (Math.random() - 0.5) * 8, -6 - Math.random() * 6, 0.5, color);
        if (p) p.drag = 1;
        break;
      }
      case 'dust': {
        const p = P.spawn(x + jx, y + jy + r, (Math.random() - 0.5) * 8, 4, 0.4, Math.random() < 0.5 ? color : '#5c6580');
        if (p) p.drag = 3;
        break;
      }
      case 'drops': {
        const p = P.spawn(x + jx, y + jy, (Math.random() - 0.5) * 6, falling ? 30 : 10, 0.3, Math.random() < 0.5 ? color : '#bfe8ff', 2, P_STREAK);
        if (p) p.gravity = 180;
        break;
      }
      default:
        break;
    }
  }

  /** Chain-lightning arcs: jagged 1 px bolts with a glow, a few frames each. */
  drawArcs(ctx: CanvasRenderingContext2D, sx: number, sy: number): void {
    let any = false;
    for (let i = 0; i < ARCS; i++) if (this.alife[i]! > 0) any = true;
    if (!any) return;
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineJoin = 'round';
    for (let i = 0; i < ARCS; i++) {
      const life = this.alife[i]!;
      if (life <= 0) continue;
      const x1 = this.ax1[i]! + ROOM_X + sx;
      const y1 = this.ay1[i]! + ROOM_Y + sy;
      const x2 = this.ax2[i]! + ROOM_X + sx;
      const y2 = this.ay2[i]! + ROOM_Y + sy;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const l = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = -dy / l;
      const ny = dx / l;
      const segs = Math.max(3, Math.min(9, Math.round(l / 8)));
      for (let pass = 0; pass < 2; pass++) {
        ctx.globalAlpha = Math.min(1, life / 0.08) * (pass === 0 ? 0.35 : 1);
        ctx.strokeStyle = pass === 0 ? this.acol[i]! : '#ffffff';
        ctx.lineWidth = pass === 0 ? 3 : 1;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        for (let k = 1; k < segs; k++) {
          const t = k / segs;
          const j = (Math.random() - 0.5) * 7;
          ctx.lineTo(x1 + dx * t + nx * j, y1 + dy * t + ny * j);
        }
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  clear(): void {
    this.alife.fill(0);
  }
}
