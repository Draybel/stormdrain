/**
 * Melee: as the primary a close-range arc swipe (strong damage + knockback, swats enemy shots) PLUS a
 * short crescent wave projectile, so projectile modifiers apply to melee too. As a RIDER: projectile
 * volleys launch out of a swipe that also hits close; beams sweep across an arc while active (the
 * lance / laser emitters read `riderMelee`).
 */

import { ATTACK_TUNING } from '../../tuning';
import { launchProjectile, type Volley } from '../fire';
import { spawnSwipe } from '../melee';
import { SK_CRESCENT } from '../state';
import type { Carrier } from './carrier';

const T = ATTACK_TUNING;

/** One swipe per distinct direction in a volley (at least 60° apart, max 4). */
function wantsSwipe(v: Volley, ang: number): boolean {
  if (v.swipes >= v.swipeAng.length) return false;
  for (let k = 0; k < v.swipes; k++) {
    const d = Math.abs(Math.atan2(Math.sin(ang - v.swipeAng[k]!), Math.cos(ang - v.swipeAng[k]!)));
    if (d < Math.PI / 3) return false;
  }
  return true;
}

function swipe(v: Volley, ang: number, dmg: number, reach: number): void {
  const src = v.src;
  const knock = v.profile.knockback * T.meleeKnock * (0.5 + 0.5 * v.scale);
  const s = spawnSwipe(v.w, v.profile, src.anchor, v.x, v.y, ang, reach, dmg, knock, v.scale, src.ownerKind);
  if (s) v.swipeAng[v.swipes++] = ang;
}

export const MELEE: Carrier = {
  id: 'melee',
  rank: 2,
  color: '#f4f7ff',
  shape: 'crescent',
  emit(v, i) {
    const p = v.profile;
    const ctx = v.ctx;
    const extra = Math.max(0, p.stacksOf('melee') - 1);
    const ang = v.ang + ctx.ang[i]!;
    if (wantsSwipe(v, ang)) {
      const reach = T.meleeReach * (1 + 0.15 * extra) * Math.sqrt(v.scale) * Math.min(1.6, ctx.size[i]! * v.src.sizeMul);
      const dmg = p.damage * T.meleeDamage * (1 + 0.3 * extra) * ctx.dmg[i]! * v.scale * v.src.mul * (i === v.keeper ? 3 : 1);
      swipe(v, ang, dmg, reach);
    }
    const s = launchProjectile(v, i, SK_CRESCENT, T.crescentDamage, T.crescentSpeed, T.crescentRange, 1.3);
    if (s) s.pierceLeft += 1;
  },
  rider(v, stacks) {
    if (v.profile.beam) return; // beams sweep instead (set when they are emitted)
    const p = v.profile;
    const reach = T.meleeReach * (1 + 0.15 * (stacks - 1)) * Math.sqrt(v.scale);
    const dmg = p.damage * T.meleeRiderDamage * (1 + 0.25 * (stacks - 1)) * v.scale * v.src.mul;
    if (wantsSwipe(v, v.ang)) swipe(v, v.ang, dmg, reach);
  },
};
