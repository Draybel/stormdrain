/**
 * Laser: as the primary a thin rapid beam (short life, fires at the fire rate) that pierces enemies
 * and stops at rocks (unless phasing). As a RIDER: projectiles sprout thin side-lasers that zap nearby
 * enemies (F_SIDELASER, see shot.ts); the lance gets feathered sub-beams beside it.
 */

import { ATTACK_TUNING } from '../../tuning';
import { BK_FEATHER, BK_LANCE, BK_LASER, spawnBeam } from '../beam';
import { noteBeam } from '../fire';
import { ownerTag, type Carrier } from './carrier';

const T = ATTACK_TUNING;

export const LASER: Carrier = {
  id: 'laser',
  rank: 4,
  color: '#ff5a78',
  emit(v, i) {
    const p = v.profile;
    const ctx = v.ctx;
    const src = v.src;
    const mul = ctx.dmg[i]! * src.mul * (i === v.keeper ? 3 : 1);
    const b = spawnBeam(v.w, BK_LASER, p, src.anchor, v.x, v.y, v.ang + ctx.ang[i]!, v.scale);
    if (!b) {
      if (v.lastBeam) v.lastBeam.dmg += p.laserDamage * v.scale * mul;
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
    if (i === 0) v.w.events.emit('laserFire', v.x, v.y, b.width, b.ang, ownerTag(v));
  },
  rider(v, stacks) {
    // Projectile primaries already carry F_SIDELASER (fire.ts). The lance grows feathers.
    const pairs = Math.min(3, stacks);
    const n = v.nBeams;
    for (let k = 0; k < n; k++) {
      const b = v.beams[k]!;
      if (b.kind !== BK_LANCE) continue;
      for (let j = 1; j <= pairs; j++) {
        for (let sg = -1; sg <= 1; sg += 2) {
          const f = spawnBeam(v.w, BK_FEATHER, v.profile, b.anchor, b.fx, b.fy, b.ang + sg * j * T.featherAngle, v.scale);
          if (!f) return;
          f.dmg *= v.src.mul;
          f.life = b.life;
          f.sweep = b.sweep;
          f.ownerKind = b.ownerKind;
          f.vIndex = b.vIndex;
        }
      }
    }
  },
};
