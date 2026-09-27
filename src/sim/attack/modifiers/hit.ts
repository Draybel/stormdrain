/**
 * Hit / expire modifiers (§4.4): pierce, split, chain, explode, puddle, knockback. They run for
 * projectiles, beam hit points (rate-limited per beam per target), melee swipes, orbit blades and
 * familiar shots alike. The status effects live in modifiers/status.ts.
 */

import { SRC_PLAYER } from '../../hittable';
import { ATTACK_TUNING } from '../../tuning';
import { chainFrom, queueExplosion, spawnPlayerPuddle, splitShot } from '../impacts';
import { F_BOMB, SK_BEAM, type ModStack, type ModifierDef, type ShotState } from '../state';

const T = ATTACK_TUNING;

/** Passes through enemies (1 + 2 per stack) and hits a little harder per stack. */
const pierce: ModifierDef = {
  id: 'pierce',
  color: '#c8d0e0',
  shape: 'spiky',
  order: 10,
  prepare(st) {
    st.v0 = 1 + 2 * st.stacks + (st.params.pierce ?? 0);
    st.v1 = 1 + 0.08 * st.stacks;
  },
  initShot(s, st) {
    s.pierceLeft += st.v0;
    s.baseDamage *= s.kind === SK_BEAM ? 1 + 0.12 * st.stacks : st.v1;
  },
};

/**
 * Splits on hit into 1 + stacks children (max 6), each half damage; children split again while
 * their depth < min(3, stacks). Beams fork instead (see beam.ts).
 */
const split: ModifierDef = {
  id: 'split',
  color: '#7fe8ff',
  shape: 'shard',
  order: 20,
  prepare(st) {
    st.v0 = Math.min(6, 1 + st.stacks + (st.params.count ?? 0));
    st.v1 = Math.min(T.maxSplitDepth, st.stacks);
  },
  hit(s, t, st, w) {
    if (s.kind === SK_BEAM || s.depth >= st.v1) return;
    splitShot(w, s, t, st.v0);
  },
};

/** Lightning jumps from the target to 1 + stacks more (60 % damage each). */
const chain: ModifierDef = {
  id: 'chain',
  color: '#fff27a',
  trail: 'sparks',
  order: 30,
  prepare(st) {
    st.v0 = 1 + st.stacks + (st.params.jumps ?? 0);
    st.v1 = 52 + 8 * st.stacks;
    st.v2 = 0.6;
  },
  hit(s, t, st, w) {
    chainFrom(w, s, t, st.v0, st.v1, s.damage * st.v2);
  },
};

/** Radius / damage / rock-breaking of a shot's explosion (bomb shots use the bomb numbers v2 / v3). */
function blast(s: ShotState, st: ModStack): void {
  if ((s.flags & F_BOMB) !== 0) {
    blastR = st.v2;
    blastD = s.damage * st.v3;
    blastRocks = true;
  } else {
    blastR = st.v0;
    blastD = s.damage * st.v1;
    blastRocks = false;
  }
  blastR *= Math.sqrt(Math.max(0.2, s.scale));
}
let blastR = 0;
let blastD = 0;
let blastRocks = false;

/**
 * Explodes where it hits and where it ends (player blasts never hurt the player). The bomb rider's
 * copies are implicit explode stacks: its shots / beams / swipes use the BOMB numbers (v2 radius,
 * v3 × damage, break rocks), and explode items held on top grow those further (+5 px, +0.25 × each)
 * instead of being swallowed by them.
 */
const explode: ModifierDef = {
  id: 'explode',
  color: '#ff7a3a',
  trail: 'embers',
  order: 40,
  prepare(st, prof) {
    st.v0 = 16 + 5 * st.stacks;
    st.v1 = 0.5 + 0.25 * st.stacks;
    const extra = Math.max(0, st.stacks - prof.riderBomb);
    st.v2 = T.bombRadius + T.bombRadiusStack * Math.max(0, prof.riderBomb - 1) + 5 * extra;
    st.v3 = T.bombDamage + 0.25 * extra;
  },
  hit(s, _t, st, w) {
    blast(s, st);
    queueExplosion(w, s.x, s.y, blastR, blastD, blastRocks);
  },
  expire(s, st, w) {
    blast(s, st);
    queueExplosion(w, s.x, s.y, blastR, blastD, blastRocks);
  },
};

/** Leaves a damaging puddle (yours: it hurts enemies, never you) where it hits and where it lands. */
const puddle: ModifierDef = {
  id: 'puddle',
  color: '#5aa8e8',
  trail: 'drops',
  shape: 'bubble',
  order: 50,
  prepare(st) {
    st.v0 = 8 + 2 * st.stacks;
    st.v1 = 2.5 + 0.6 * st.stacks;
    st.v2 = 0.25 * (1 + 0.3 * (st.stacks - 1));
  },
  hit(s, _t, st, w) {
    if (w.atk.puddlesThisTick >= 4) return;
    w.atk.puddlesThisTick++;
    spawnPlayerPuddle(w, s.x, s.y, st.v0 * Math.sqrt(s.scale), st.v1, s.damage * st.v2);
  },
  expire(s, st, w) {
    if (w.atk.puddlesThisTick >= 4) return;
    w.atk.puddlesThisTick++;
    spawnPlayerPuddle(w, s.x, s.y, st.v0 * Math.sqrt(s.scale), st.v1, s.damage * st.v2);
  },
};

/** Hits shove much harder and daze briefly. */
const knockback: ModifierDef = {
  id: 'knockback',
  color: '#c89060',
  order: 90,
  prepare(st) {
    st.v0 = 1.8 + 0.8 * st.stacks;
    st.v1 = 0.12 * st.stacks;
    st.v2 = 60 + 30 * st.stacks;
  },
  initShot(s, st) {
    s.knock *= st.v0;
  },
  hit(_s, t, st) {
    t.applyStatus('knockback', st.v1, st.v2, SRC_PLAYER);
  },
};

export const HIT_MODIFIERS: readonly ModifierDef[] = [pierce, split, chain, explode, puddle, knockback];
