/**
 * Orbit rider (§4.2): 1 + stacks spinning blades (max 8) ride a ring around the player. They are
 * projectiles with a permanent orbit (kind SK_ORBIT, updated in shot.ts): they hit what they touch
 * (inheriting every hit modifier — poison, split, chain, explode…), swat enemy shots, and whenever the
 * player fires they each fire a mini (scale 0.4) version of the primary through fireVolley.
 */

import { ATTACK_TUNING } from '../tuning';
import type { World } from '../world';
import { copySource, fireVolley } from './fire';
import { allocShot, finishShot, type Shot } from './shot';
import { AttackSource, F_BOMB, OWN_BLADE, OWN_PLAYER, SK_ORBIT } from './state';

const T = ATTACK_TUNING;

/** The player's blades (stable slots) and their pool serials (a released + reused shot is detected). */
export class OrbitBlades {
  readonly shots: (Shot | null)[] = new Array<Shot | null>(T.orbitMax).fill(null);
  readonly sources: AttackSource[] = [];
  constructor() {
    for (let i = 0; i < T.orbitMax; i++) {
      const s = new AttackSource();
      s.ownerKind = OWN_BLADE;
      s.mini = true;
      this.sources.push(s);
    }
  }
  clear(): void {
    this.shots.fill(null);
  }
}

function isBlade(s: Shot | null): s is Shot {
  return s !== null && s.alive && s.kind === SK_ORBIT && s.ownerKind === OWN_PLAYER;
}

/** Keeps the blade count / numbers in step with the profile (cheap; runs every tick). */
export function syncOrbit(w: World): void {
  const p = w.player;
  const prof = p.attack;
  const blades = w.atk.orbit;
  const want = p.dead ? 0 : prof.orbitCount;
  for (let i = 0; i < T.orbitMax; i++) {
    let s: Shot | null = blades.shots[i]!;
    if (!isBlade(s)) {
      s = null;
      blades.shots[i] = null;
    }
    if (i >= want) {
      if (s) w.projectiles.release(s);
      blades.shots[i] = null;
      continue;
    }
    if (s === null) {
      s = allocShot(w);
      if (!s) continue;
      s.kind = SK_ORBIT;
      s.bladeIndex = i;
      const a = w.time * T.orbitSpin + (i / want) * Math.PI * 2;
      s.x = p.x + Math.cos(a) * T.orbitRadius;
      s.y = p.y + Math.sin(a) * T.orbitRadius;
      s.z = T.flyHeight;
      s.anchor = p;
      s.ownerKind = OWN_PLAYER;
      s.life = Infinity;
      s.range = Infinity;
      s.rehit = T.orbitRehit;
      s.scale = 1;
      blades.shots[i] = s;
      bladeNumbers(w, s);
      finishShot(w, s);
      w.events.emit('bladeSpawn', s.x, s.y, i, want);
    } else if (s.profile !== prof) {
      bladeNumbers(w, s);
    }
  }
}

function bladeNumbers(w: World, s: Shot): void {
  const prof = w.player.attack;
  s.profile = prof;
  s.style = prof.style;
  s.baseDamage = s.damage = prof.damage * T.orbitDamage * (1 + 0.1 * Math.max(0, prof.riderOrbit - 1));
  s.baseSize = s.size = T.orbitSize * Math.sqrt(Math.max(0.5, prof.size) / 3);
  s.knock = prof.knockback;
  s.flags = prof.riderBomb > 0 ? F_BOMB : 0;
}

const dir = { x: 1, y: 0 };
const origin = { x: 0, y: 0 };

/** The player fired: every blade fires a mini volley in the same direction. */
export function bladeVolleys(w: World, ang: number, from: AttackSource): void {
  const blades = w.atk.orbit;
  const prof = w.player.attack;
  dir.x = Math.cos(ang);
  dir.y = Math.sin(ang);
  for (let i = 0; i < T.orbitMax; i++) {
    const s = blades.shots[i]!;
    if (!isBlade(s)) continue;
    const src = blades.sources[i]!;
    copySource(src, from);
    src.ownerKind = OWN_BLADE;
    src.anchor = s;
    src.vx = src.vy = 0;
    src.mini = true;
    src.quiet = true;
    origin.x = s.x;
    origin.y = s.y;
    fireVolley(w, src, origin, dir, prof, T.orbitMiniScale);
  }
}
