/**
 * Storm Lance (always the primary when held): hold to charge, release = a huge beam traced instantly
 * to the far wall that pierces everything (and passes through rocks) and ticks rapid damage for ~0.5 s.
 * Charging, the flash / shake / boom and the fizzle live in attack/charge.ts and render/audio.
 * Riders shape the beam: laser → feathered sub-beams, melee → an opening slash plus a swipe and a crescent, bomb →
 * explosions along it, boomerang → it bends back into a U, charge → overcharge, orbit → blades fire
 * mini lances.
 */

import { BK_LANCE, addSlash, spawnBeam } from '../beam';
import { noteBeam } from '../fire';
import { SF_RING } from '../state';
import { ownerTag, type Carrier } from './carrier';

export const LANCE: Carrier = {
  id: 'lance',
  rank: 5,
  color: '#9fdcff',
  trail: 'sparks',
  emit(v, i) {
    const p = v.profile;
    const ctx = v.ctx;
    const src = v.src;
    const mul = ctx.dmg[i]! * src.mul * (i === v.keeper ? 3 : 1);
    const b = spawnBeam(v.w, BK_LANCE, p, src.anchor, v.x, v.y, v.ang + ctx.ang[i]!, v.scale);
    if (!b) {
      // Beam cap: the lost beam's damage makes the last one stronger.
      if (v.lastBeam) v.lastBeam.dmg += p.lanceTick * v.scale * mul;
      return;
    }
    b.dmg *= mul;
    b.width *= Math.min(2.5, ctx.size[i]! * src.sizeMul);
    b.life *= src.lifeMul;
    b.ownerKind = src.ownerKind;
    b.vIndex = i;
    b.ring = (ctx.flags[i]! & SF_RING) !== 0;
    b.bomb = p.riderBomb > 0;
    if (p.riderMelee > 0) addSlash(b);
    noteBeam(v, b);
    if (i === 0) {
      const ax = src.anchor ? src.anchor.x : v.x;
      const ay = src.anchor ? src.anchor.y : v.y;
      v.w.events.emit('lanceFire', ax, ay, b.width, b.ang, ownerTag(v));
    }
  },
};
