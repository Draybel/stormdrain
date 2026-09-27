/**
 * Boss pack A hooks (sim/bosses/hooks.ts): the bosses of the Drowned Nursery, the Rootcellar and the
 * Candlewick Crypt, and the two chapter 1-2 minibosses, change SHAPE when their phase changes — each
 * wears a second sprite of the same size and anchor from its second phase on (Pirouetta overwound,
 * Sir Sopsalot unstitched, Grandmother Brine fermenting, Old Knotroot uprooted, Vesperwing singed,
 * Wickwarden melting, Bumbershoot inside out, Puddlestomp split into odd boots). On top of that the
 * phase's `tint` still washes the colour.
 *
 * The swap is presentation only: `enemy.sprite` is what the renderer draws; nothing in the sim reads it
 * (the def's sprite stays the bestiary's picture). `phase` swaps it at the roar (under the phase
 * flash); `tick` keeps every part of the fight (split parts spawn wearing the def's sprite) in the
 * phase's look. No allocation: the look table is built once here.
 */

import { registerBossHook } from '../../sim/bosses/hooks';
import type { SpriteDef } from '../../sim/types';
import { PIROUETTA_OVERWOUND_SPRITE, PIROUETTA_SPRITE, SOPSALOT_SPRITE, SOPSALOT_UNSTITCHED_SPRITE } from '../sprites/bossesANursery';
import { GRANDMOTHER_BRINE_FERMENTING_SPRITE, GRANDMOTHER_BRINE_SPRITE, KNOTROOT_SPRITE, KNOTROOT_UPROOTED_SPRITE } from '../sprites/bossesARoot';
import { VESPERWING_SINGED_SPRITE, VESPERWING_SPRITE, WICKWARDEN_MELTING_SPRITE, WICKWARDEN_SPRITE } from '../sprites/bossesACrypt';
import { BUMBERSHOOT_INSIDE_OUT_SPRITE, BUMBERSHOOT_SPRITE, PUDDLESTOMP_ODD_BOOT_SPRITE, PUDDLESTOMP_SPRITE } from '../sprites/bossesAMini';

/** Hook name → the sprite worn in each phase (the last one repeats for later phases). */
export const BOSS_A_LOOKS: Readonly<Record<string, readonly SpriteDef[]>> = {
  'bossesA.pirouetta': [PIROUETTA_SPRITE, PIROUETTA_OVERWOUND_SPRITE],
  'bossesA.sopsalot': [SOPSALOT_SPRITE, SOPSALOT_UNSTITCHED_SPRITE],
  'bossesA.brine': [GRANDMOTHER_BRINE_SPRITE, GRANDMOTHER_BRINE_FERMENTING_SPRITE],
  'bossesA.knotroot': [KNOTROOT_SPRITE, KNOTROOT_UPROOTED_SPRITE],
  'bossesA.vesperwing': [VESPERWING_SPRITE, VESPERWING_SINGED_SPRITE],
  'bossesA.wickwarden': [WICKWARDEN_SPRITE, WICKWARDEN_MELTING_SPRITE],
  'bossesA.bumbershoot': [BUMBERSHOOT_SPRITE, BUMBERSHOOT_INSIDE_OUT_SPRITE],
  'bossesA.puddlestomp': [PUDDLESTOMP_SPRITE, PUDDLESTOMP_ODD_BOOT_SPRITE],
};

/** Hooks whose new look only appears once the phase's entrance has run (Puddlestomp splits first). */
const AFTER_ENTRANCE = new Set(['bossesA.puddlestomp']);

/** The look for phase `i` from a hook's table. */
export function bossALook(hook: string, i: number): SpriteDef | undefined {
  const looks = BOSS_A_LOOKS[hook];
  return looks ? looks[Math.min(Math.max(0, i), looks.length - 1)] : undefined;
}

for (const name of Object.keys(BOSS_A_LOOKS)) {
  const looks = BOSS_A_LOOKS[name]!;
  const last = looks.length - 1;
  const lookFor = (i: number): SpriteDef => looks[i < 0 ? 0 : i > last ? last : i]!;
  const early = !AFTER_ENTRANCE.has(name);
  registerBossHook(name, {
    phase(ctx, i) {
      if (early) ctx.e.sprite = lookFor(i);
    },
    tick(ctx) {
      const want = lookFor(ctx.b.phase);
      if (ctx.e.sprite === want) return;
      // Every part of this fight (split parts are born in the def's sprite).
      const pool = ctx.w.enemies;
      const group = ctx.b.group;
      for (let k = 0; k < pool.count; k++) {
        const o = pool.items[k]!;
        if (!o.dead && o.boss !== null && o.boss.group === group) o.sprite = lookFor(o.boss.phase);
      }
    },
  });
}
