/**
 * Storm Lance (always the primary when held): hold to charge, release = a huge beam traced instantly
 * to the far wall that pierces everything (and passes through rocks) and ticks rapid damage for ~0.5 s.
 * Charging, the flash / shake / boom and the fizzle live in attack/charge.ts and render/audio.
 * Riders shape the beam: laser → feathered sub-beams, melee → the beam sweeps an arc, bomb →
 * explosions along it, boomerang → it bends back into a U, charge → overcharge, orbit → blades fire
 * mini lances.
 */

import { ATTACK_TUNING } from '../../tuning';
import { BK_LANCE, spawnBeam } from '../beam';
import { noteBeam } from '../fire';
import { ownerTag, type Carrier } from './carrier';

const T = ATTACK_TUNING;

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
    b.bomb = p.riderBomb > 0;
    b.sweep = p.riderMelee > 0 ? T.beamSweep : 0;
    noteBeam(v, b);
    if (i === 0) {
      const ax = src.anchor ? src.anchor.x : v.x;
      const ay = src.anchor ? src.anchor.y : v.y;
      v.w.events.emit('lanceFire', ax, ay, b.width, b.ang, ownerTag(v));
    }
  },
};
