/**
 * Boss pack B hooks (chapters 3-4; guide docs/content-bosses-b.md): each boss and miniboss of the pack
 * changes its LOOK with its phase — cracks, glowing seams, extra parts, not only the renderer's colour
 * wash. The boss def names `bossesB.<id>`; the hook swaps `enemy.sprite` (a plain data reference the
 * renderer draws) to the phase's SpriteDef when the phase begins, and keeps split parts / restored
 * fights in step every tick (one comparison, no allocation). All looks of a boss share its size and
 * anchor (content/sprites/bossesBKit.ts).
 */

import { registerBossHook, type BossHook } from '../../sim/bosses/hooks';
import type { SpriteDef } from '../../sim/types';
import {
  BELLOWBELLY_MELT_SPRITE,
  BELLOWBELLY_RED_SPRITE,
  BELLOWBELLY_SPRITE,
  HAMMERJAW_HOT_SPRITE,
  HAMMERJAW_SLAG_SPRITE,
  HAMMERJAW_SPRITE,
} from '../sprites/bossesBFoundry';
import {
  FACETTA_PRISM_SPRITE,
  FACETTA_SING_SPRITE,
  FACETTA_SPRITE,
  HUSHWING_RING_SPRITE,
  HUSHWING_SHATTER_SPRITE,
  HUSHWING_SPRITE,
} from '../sprites/bossesBGrotto';
import {
  BRAMBLEHORN_SPRITE,
  BRAMBLEHORN_WING_SPRITE,
  GRANDMOTHER_GILL_RIPE_SPRITE,
  GRANDMOTHER_GILL_SPORE_SPRITE,
  GRANDMOTHER_GILL_SPRITE,
} from '../sprites/bossesBHollow';
import { CANSHELL_ROLL_SPRITE, CANSHELL_SPRITE, GLOWTAIL_FLARE_SPRITE, GLOWTAIL_SPRITE } from '../sprites/bossesBMini';
import { GNAWGEAR_SPRITE, GNAWGEAR_STRIPPED_SPRITE, OLD_GOVERNOR_HOT_SPRITE, OLD_GOVERNOR_SPRITE } from '../sprites/bossesBWorks';

/** Boss id → its look per phase (the first is the def's own sprite). */
export const BOSS_B_LOOKS: Readonly<Record<string, readonly SpriteDef[]>> = {
  'old-governor': [OLD_GOVERNOR_SPRITE, OLD_GOVERNOR_HOT_SPRITE],
  gnawgear: [GNAWGEAR_SPRITE, GNAWGEAR_STRIPPED_SPRITE],
  bellowbelly: [BELLOWBELLY_SPRITE, BELLOWBELLY_RED_SPRITE, BELLOWBELLY_MELT_SPRITE],
  'grandmother-gill': [GRANDMOTHER_GILL_SPRITE, GRANDMOTHER_GILL_SPORE_SPRITE, GRANDMOTHER_GILL_RIPE_SPRITE],
  bramblehorn: [BRAMBLEHORN_SPRITE, BRAMBLEHORN_WING_SPRITE],
  hushwing: [HUSHWING_SPRITE, HUSHWING_RING_SPRITE, HUSHWING_SHATTER_SPRITE],
  // Polish batch 4: the alt chapters' second bosses.
  hammerjaw: [HAMMERJAW_SPRITE, HAMMERJAW_HOT_SPRITE, HAMMERJAW_SLAG_SPRITE],
  facetta: [FACETTA_SPRITE, FACETTA_SING_SPRITE, FACETTA_PRISM_SPRITE],
  canshell: [CANSHELL_SPRITE, CANSHELL_ROLL_SPRITE],
  glowtail: [GLOWTAIL_SPRITE, GLOWTAIL_FLARE_SPRITE],
};

/** The hook name a pack-B boss def uses. */
export function bossLookHook(id: string): string {
  return `bossesB.${id}`;
}

function phaseLooks(looks: readonly SpriteDef[]): BossHook {
  const pick = (phase: number): SpriteDef => looks[Math.max(0, Math.min(phase, looks.length - 1))]!;
  return {
    looks,
    phase(ctx, i) {
      ctx.e.sprite = pick(i);
    },
    tick(ctx) {
      const s = pick(ctx.b.phase);
      if (ctx.e.sprite !== s) ctx.e.sprite = s;
    },
  };
}

for (const [id, looks] of Object.entries(BOSS_B_LOOKS)) registerBossHook(bossLookHook(id), phaseLooks(looks));
