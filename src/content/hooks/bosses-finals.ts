/**
 * Per-boss code of the three final bosses (sim/bosses/hooks.ts), for what the pattern library can't say:
 *
 *   old-thunderhead       looms along the top of the room, drifting after Wren without sitting on her;
 *                         its look changes with each phase; a send-off of lightning that ends in sunshine
 *   thunderhead-blackout  (a 'hook' pattern) the room goes dark — Wren's own little light, bolts
 *                         striking around her, lightning flashes lighting the room now and then
 *   nestmother            her look per phase; the hive crumbles around her as she falls
 *   undertow              sits in the middle of the room and slowly drags Wren toward it (stronger each
 *                         phase, half as strong on a flyer), churning; the water grows still as it falls
 *
 * Hook code only touches the World it is handed (no sim imports beyond pure constants), so the content
 * registry stays free of import cycles. Darkness borrows the Curse of Darkness (`world.curse`): the
 * floor's own curse is kept aside and put back when the blackout ends, the phase changes or the boss
 * falls (a debug kill mid-blackout leaves it dark until the next room).
 */

import { ROOM_H, ROOM_W, TILE } from '../../sim/constants';
import { registerBossHook, type BossHookCtx } from '../../sim/bosses/hooks';
import { Deco, Tile } from '../../sim/tiles';
import { ENEMY_TUNING } from '../../sim/tuning';
import type { SpriteDef } from '../../sim/types';
import type { World } from '../../sim/world';
import { NESTMOTHER_PHASES } from '../sprites/finals-nestmother';
import { THUNDERHEAD_PHASES } from '../sprites/finals-thunderhead';
import { UNDERTOW_PHASES } from '../sprites/finals-undertow';

// ── Shared bits ─────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** The phase's own look (sprites swap in when a phase begins). */
function phaseLook(ctx: BossHookCtx, list: readonly SpriteDef[], i: number): void {
  const s = list[Math.min(i, list.length - 1)];
  if (s) ctx.e.sprite = s;
}

/** A line of the boss's for the top band. */
function say(w: World, x: number, y: number, text: string): void {
  w.events.emit('npcSay', x, y, 0, 0, text);
}

function sfx(w: World, x: number, y: number, name: string): void {
  w.events.emit('sfx', x, y, 0, 0, name);
}

/** A lightning strike that is only light and noise (no damage): the flash, sparks and thunder. */
function flashBolt(w: World, x: number, y: number, ring = 10): void {
  w.events.emit('lobLand', x, y, ring, 0, 'bolt');
}

/** A harmless burst of droplets in a colour, with a ring (and a splash). */
function burst(w: World, x: number, y: number, color: string): void {
  w.events.emit('splash', x, y, 1, 0, color);
}

/** A harmless splash of a shot style (a glob landing: bits, a ring). */
function spatter(w: World, x: number, y: number, style: number, ring = 8): void {
  w.events.emit('lobLand', x, y, ring, style, '');
}

/** Shot style indices (ENEMY_SHOT_STYLES) used for cosmetic splashes. */
export const STYLE_WATER = 1;
export const STYLE_EMBER = 4;
/**
 * Damage source for hurting its own adds (sim/hittable SRC_HAZARD: no kill credit). Kept as a literal
 * because hittable.ts pulls in half the sim; tests/content-bosses-finals.test.ts checks it matches.
 */
export const SRC_HAZARD = 5;

/** Pushes the player along (vx, vy) px/s through her shove channel (settles at exactly that speed). */
function drift(w: World, vx: number, vy: number, dt: number): void {
  const p = w.player;
  if (p.dead) return;
  const k = ENEMY_TUNING.playerPushDecay * dt;
  p.pushX += vx * k;
  p.pushY += vy * k;
}

/** Per-death bookkeeping (a WeakMap entry per dying boss state, made once). */
interface SendOff {
  /** Seconds the sequence lasts in all (after the extension). */
  total: number;
  /** Next beat of the sequence (seconds elapsed). */
  next: number;
  n: number;
}
const sendOffs = new WeakMap<object, SendOff>();

/** What `sendOff` found (one reused object: read it during the call). */
const beat = { s: null as unknown as SendOff, t: 0, first: false };

/** The first call of a death sequence lengthens it by `extra` s; returns the bookkeeping and elapsed time. */
function sendOff(ctx: BossHookCtx, extra: number): typeof beat {
  let s = sendOffs.get(ctx.b);
  beat.first = false;
  if (!s) {
    ctx.b.dieT += extra;
    s = { total: ctx.b.dieT, next: 0, n: 0 };
    sendOffs.set(ctx.b, s);
    beat.first = true;
  }
  beat.s = s;
  beat.t = s.total - ctx.t;
  return beat;
}

// ── Old Thunderhead ─────────────────────────────────────────────────────────

const BLACKOUT = 'thunderhead-blackout';

interface Dark {
  on: boolean;
  /** The floor's own curse, put back afterwards. */
  saved: World['curse'];
  /** A reveal flash is lighting the room (seconds left). */
  litT: number;
  strikes: number;
  flashes: number;
  /** The first blackout of a fight (by its group uid) gets a line. */
  saidFor: number;
}
const darks = new WeakMap<World, Dark>();

function darkOf(w: World): Dark {
  let d = darks.get(w);
  if (!d) {
    d = { on: false, saved: null, litT: 0, strikes: 0, flashes: 0, saidFor: -1 };
    darks.set(w, d);
  }
  return d;
}

/** Lights back on: the floor's own curse returns. */
function endBlackout(w: World): void {
  const d = darks.get(w);
  if (!d || !d.on) return;
  d.on = false;
  d.litT = 0;
  w.curse = d.saved;
}

function lightsOn(d: Dark): World['curse'] {
  return d.saved === 'darkness' ? null : d.saved;
}

registerBossHook('old-thunderhead', {
  tick(ctx) {
    const { w, e, b, dt } = ctx;
    const blackout = b.pat !== null && b.pat.hook === BLACKOUT;
    // Lights back on whenever the blackout isn't running (it was cut short).
    if (!blackout) endBlackout(w);
    if (blackout) return;
    // Looming: drift along the top of the room after her, never settling on top of her.
    const p = w.player;
    const top = e.r + 8;
    let gx = p.x + Math.sin(e.age * 0.45) * 34;
    let gy = top + 6 + Math.sin(e.age * 0.9) * 4;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 52) {
      // Too close: back off, away from her (downward if she has climbed up under it).
      const k = d > 1 ? 1 / d : 0;
      gx = e.x + dx * k * 40;
      gy = p.y < top + 26 ? Math.min(ROOM_H - e.r - 4, p.y + 60) : e.y + dy * k * 40;
    }
    gx = clamp(gx, e.r + 4, ROOM_W - e.r - 4);
    gy = clamp(gy, top, ROOM_H - e.r - 4);
    const spd = 24 * b.pace;
    e.sepX += clamp((gx - e.x) * 1.4, -spd, spd) * dt;
    e.sepY += clamp((gy - e.y) * 1.4, -spd, spd) * dt;
    if (Math.abs(p.x - e.x) > 6) e.face = p.x > e.x ? 1 : -1;
  },
  phase(ctx, i) {
    const { w, e } = ctx;
    endBlackout(w);
    phaseLook(ctx, THUNDERHEAD_PHASES, i);
    if (i === 1) {
      say(w, e.x, e.y, 'OLD THUNDERHEAD: GRUMBLE... GRUMBLE... RUMBLE!');
      flashBolt(w, e.x - 30, e.y + 10, 14);
      flashBolt(w, e.x + 30, e.y + 10, 14);
    } else if (i === 2) {
      say(w, e.x, e.y, 'OLD THUNDERHEAD: I WILL RAIN ON YOU FOREVER!');
      flashBolt(w, e.x, e.y + 16, 20);
      sfx(w, e.x, e.y, 'explosion_big');
      w.events.emit('shake', e.x, e.y, 0.8);
    }
  },
  dying(ctx) {
    const { w, e } = ctx;
    endBlackout(w);
    const { s, t, first } = sendOff(ctx, 1.1);
    if (first) {
      say(w, e.x, e.y, 'OLD THUNDERHEAD: ...FINE. HAVE YOUR SUNSHINE.');
      sfx(w, e.x, e.y, 'thunder');
    }
    const f = t / s.total;
    // It rains itself out: smaller and smaller.
    e.scale = 1 - 0.38 * f;
    // One last tantrum of lightning all over the room...
    if (t >= s.next && f < 0.72) {
      s.next = t + 0.22;
      const r = ctx.api.random();
      const q = ctx.api.random();
      flashBolt(w, 14 + r * (ROOM_W - 28), 12 + q * (ROOM_H - 24), 8 + ((s.n++ * 5) % 9));
    }
    // ...then the sun breaks through.
    if (f >= 0.86 && s.n >= 0) {
      s.n = -1;
      burst(w, e.x, e.y - 8, '#fff2a8');
      burst(w, e.x - 16, e.y - 2, '#ffd84a');
      burst(w, e.x + 16, e.y - 2, '#ffd84a');
      sfx(w, e.x, e.y, 'active_ready');
    }
  },
});

/**
 * The blackout: dark for ~5 s. Bolts strike around Wren (their markers sit inside her own light), the
 * straight shots in the air fizzle when the lights go out, and lightning lights the whole room for a
 * moment every ~1.3 s.
 */
registerBossHook(BLACKOUT, {
  pattern(ctx) {
    const { w, e, b, t } = ctx;
    const d = darkOf(w);
    const pace = b.pace;
    if (!d.on) {
      d.on = true;
      d.saved = w.curse;
      d.litT = 0;
      d.strikes = 0;
      d.flashes = 0;
      w.curse = 'darkness';
      // Nothing unseen stays in the air, and its little clouds are swallowed by the dark.
      const shots = w.enemyShots;
      for (let i = shots.count - 1; i >= 0; i--) {
        const s = shots.items[i]!;
        if (s.allied || s.lob) continue;
        w.events.emitFx('eshotPop', s.x, s.y, 0, s.style);
        shots.release(s);
      }
      const pool = w.enemies;
      for (let i = 0; i < pool.count; i++) {
        const o = pool.items[i]!;
        if (!o.dead && o.parent === e.uid && o.anchor === 0 && o.hittable) o.hurt(o.hp + 1, SRC_HAZARD, 0, 0);
      }
      sfx(w, e.x, e.y, 'curse');
      if (d.saidFor !== b.group) {
        d.saidFor = b.group;
        say(w, e.x, e.y, 'THE LIGHTS GO OUT...');
      }
    }
    const len = 5.2 / Math.sqrt(pace);
    // Reveal flashes: the room lit for a moment.
    if (d.litT > 0) {
      d.litT -= ctx.dt;
      if (d.litT <= 0) w.curse = 'darkness';
    }
    const flashEvery = 1.3 / Math.sqrt(pace);
    if (t >= (d.flashes + 1) * flashEvery && t < len - 0.3) {
      d.flashes++;
      d.litT = 0.24;
      w.curse = lightsOn(d);
      const p = w.player;
      // A distant strike, well away from her.
      const x = p.x < ROOM_W / 2 ? ROOM_W - 20 - ctx.api.random() * 50 : 20 + ctx.api.random() * 50;
      flashBolt(w, x, 14 + ctx.api.random() * (ROOM_H - 28), 12);
    }
    // Strikes around her, every ~0.8 s: one on her, two flanking.
    const strikeEvery = 0.8 / pace;
    if (t >= 0.35 + d.strikes * strikeEvery && t < len - 0.9) {
      d.strikes++;
      const p = w.player;
      const air = 0.85 / Math.sqrt(pace);
      ctx.api.drop(clamp(p.x + (ctx.api.random() - 0.5) * 6, 6, ROOM_W - 6), clamp(p.y + (ctx.api.random() - 0.5) * 6, 6, ROOM_H - 6), air, true);
      const a0 = ctx.api.random() * Math.PI * 2;
      for (let k = 1; k <= 2; k++) {
        const a = a0 + k * 2.3;
        const r = 20 + ctx.api.random() * 10;
        ctx.api.drop(clamp(p.x + Math.cos(a) * r, 6, ROOM_W - 6), clamp(p.y + Math.sin(a) * r * 0.8, 6, ROOM_H - 6), air, true);
      }
    }
    if (t < len) return false;
    endBlackout(w);
    return true;
  },
});

// ── The Nestmother ──────────────────────────────────────────────────────────

registerBossHook('nestmother', {
  phase(ctx, i) {
    const { w, e } = ctx;
    phaseLook(ctx, NESTMOTHER_PHASES, i);
    if (i === 1) {
      say(w, e.x, e.y, 'THE NESTMOTHER: WAKE UP, MY LITTLE ONES!');
      sfx(w, e.x, e.y, 'enemy_spawn');
    } else if (i === 2) {
      say(w, e.x, e.y, 'THE NESTMOTHER: YOU TORE MY BEAUTIFUL HIVE!');
      sfx(w, e.x, e.y, 'fire_nova');
      w.events.emit('shake', e.x, e.y, 0.7);
    }
  },
  dying(ctx) {
    const { w, e } = ctx;
    const { s, t, first } = sendOff(ctx, 1.1);
    if (first) say(w, e.x, e.y, 'THE NESTMOTHER: HUSH NOW... THE HIVE IS SLEEPY...');
    const f = t / s.total;
    e.scale = 1 - 0.22 * f;
    if (t < s.next || f > 0.9) return;
    s.next = t + 0.17;
    s.n++;
    // The paper walls of the hive crumble, nearest first — then honey spatters.
    const room = w.room;
    let best = -1;
    let bd = Infinity;
    for (let i = 0; i < room.tiles.length; i++) {
      if (room.tiles[i] !== Tile.Crate) continue;
      const cx = (i % room.cols) * TILE + TILE / 2;
      const cy = Math.floor(i / room.cols) * TILE + TILE / 2;
      const dd = (cx - e.x) * (cx - e.x) + (cy - e.y) * (cy - e.y);
      if (dd < bd) {
        bd = dd;
        best = i;
      }
    }
    if (best >= 0) {
      const col = best % room.cols;
      const row = Math.floor(best / room.cols);
      room.set(col, row, Tile.Floor);
      room.deco[best] = Deco.Planks;
      w.events.emit('tileBreak', col * TILE + TILE / 2, row * TILE + TILE / 2, Tile.Crate, 0);
    } else {
      const a = ctx.api.random() * Math.PI * 2;
      const r = 16 + ctx.api.random() * 30;
      spatter(w, clamp(e.x + Math.cos(a) * r, 6, ROOM_W - 6), clamp(e.y + Math.sin(a) * r * 0.7, 6, ROOM_H - 6), STYLE_EMBER);
    }
    if (s.n === 12) {
      burst(w, e.x, e.y - 10, '#ffcf57');
      sfx(w, e.x, e.y, 'active_ready');
    }
  },
});

// ── The Undertow ────────────────────────────────────────────────────────────

/** Its pull on Wren by phase (px/s; she walks at ~96). */
export const UNDERTOW_PULL = [14, 20, 26, 34] as const;

interface Churn {
  t: number;
}
const churns = new WeakMap<object, Churn>();

registerBossHook('undertow', {
  tick(ctx) {
    const { w, e, b, dt } = ctx;
    // It keeps to the middle of the room.
    const gx = ROOM_W / 2;
    const gy = ROOM_H / 2;
    e.sepX += clamp((gx - e.x) * 2, -30, 30) * dt;
    e.sepY += clamp((gy - e.y) * 2, -30, 30) * dt;
    // The drag of the water.
    const p = w.player;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    const inner = e.r * 0.7;
    if (d > inner) {
      const pull = UNDERTOW_PULL[Math.min(b.phase, UNDERTOW_PULL.length - 1)]! * Math.min(1, (d - inner) / 24) * (p.flags.flying ? 0.5 : 1);
      drift(w, (dx / d) * pull, (dy / d) * pull, dt);
    }
    // Churning water around it (silent sparkles, the room's pull made visible).
    let c = churns.get(b);
    if (!c) {
      c = { t: 0 };
      churns.set(b, c);
    }
    c.t -= dt;
    if (c.t <= 0) {
      c.t = 0.12;
      const a = ctx.api.random() * Math.PI * 2;
      const r = e.r + 18 + ctx.api.random() * 50;
      w.events.emitFx('eshotPop', clamp(e.x + Math.cos(a) * r, 4, ROOM_W - 4), clamp(e.y + Math.sin(a) * r * 0.7, 4, ROOM_H - 4), 0, 1);
    }
  },
  phase(ctx, i) {
    const { w, e } = ctx;
    phaseLook(ctx, UNDERTOW_PHASES, i);
    if (i === 1) {
      say(w, e.x, e.y, 'THE WATER CHURNS...');
      sfx(w, e.x, e.y, 'teleport');
    } else if (i === 2) {
      say(w, e.x, e.y, 'SOMETHING RISES FROM THE DEEP!');
      sfx(w, e.x, e.y, 'teleport');
      spatter(w, e.x - 20, e.y - 6, STYLE_WATER, 14);
      spatter(w, e.x + 20, e.y - 6, STYLE_WATER, 14);
    } else if (i === 3) {
      say(w, e.x, e.y, 'THE UNDERTOW WILL NOT LET GO!');
      sfx(w, e.x, e.y, 'explosion_big');
      for (let k = 0; k < 4; k++) spatter(w, e.x + Math.cos(k * 1.57) * 26, e.y + Math.sin(k * 1.57) * 16, STYLE_WATER, 16);
      w.events.emit('shake', e.x, e.y, 0.9);
    }
  },
  dying(ctx) {
    const { w, e } = ctx;
    const { s, t, first } = sendOff(ctx, 1.3);
    if (first) say(w, e.x, e.y, 'THE WATER GROWS STILL...');
    const f = t / s.total;
    // The whirlpool closes.
    e.scale = 1 - 0.45 * f;
    if (t < s.next || f > 0.92) return;
    s.next = t + 0.24;
    s.n++;
    const a = s.n * 2.4;
    const x = clamp(e.x + Math.cos(a) * 26 * (1 - f * 0.5), 6, ROOM_W - 6);
    const y = clamp(e.y + Math.sin(a) * 16 * (1 - f * 0.5), 6, ROOM_H - 6);
    // Water settling — and, every other beat, one of the things it kept surfacing with a golden glint.
    if ((s.n & 1) === 1) spatter(w, x, y, STYLE_WATER, 10);
    else burst(w, x, y - 4, '#ffcf57');
    if (s.n === 9) sfx(w, e.x, e.y, 'active_ready');
  },
});
