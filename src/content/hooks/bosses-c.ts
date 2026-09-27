/**
 * Boss hooks of boss pack C (chapters 5-6; guide: docs/content-bosses-c.md). One per boss, all built by
 * `phaseLook`:
 *
 * - The LATER-PHASE LOOK: each phase can wear its own sprite (the Withered Marrowbough, the Cracked
 *   Vaultwarden, the Ambergut's cocoon and hatchling…). `phase` swaps `enemy.sprite` the moment the
 *   roar starts (the white flash hides the swap); `tick` re-asserts it (split parts, fights started
 *   without an intro). The renderer only ever reads `enemy.sprite`, so this is presentation only.
 * - WINGS: a phase from `flyFrom` on flies (the Ambergut hatches).
 * - DEPTH: a boss met in a chapter deeper than its home one (the multi-chapter minibosses, or a boss
 *   borrowed by a chapter without its own) runs a little faster — `pace` × (1 + 6 % per chapter),
 *   0.85-1.25 — on top of the HP scaling of `bossHpFor`. Idempotent: tick sets pace = phase pace ×
 *   factor, so it never compounds.
 */

import { registerBossHook, type BossHookCtx } from '../../sim/bosses/hooks';
import type { SpriteDef } from '../../sim/types';
import {
  AMBERGUT_HATCHED_SPRITE,
  AMBERGUT_PUPA_SPRITE,
  AMBERGUT_SPRITE,
  SLAGJACKET_OVERHEATED_SPRITE,
  SLAGJACKET_SPRITE,
} from '../sprites/bossesCNest';
import {
  GLOAMKEEPER_GUTTERING_SPRITE,
  GLOAMKEEPER_SPRITE,
  MARROWBOUGH_SPRITE,
  MARROWBOUGH_WITHERED_SPRITE,
  TATTERJACK_SPRITE,
  TATTERJACK_UNSTUFFED_SPRITE,
} from '../sprites/bossesCOrchard';
import { SQUALLVANE_SPRITE, SQUALLVANE_STRUCK_SPRITE, SQUALLVANE_UNMOORED_SPRITE } from '../sprites/bossesCStorm';
import {
  HOARQUILL_SHEDDING_SPRITE,
  HOARQUILL_SPRITE,
  SHIVERWING_SHATTERED_SPRITE,
  SHIVERWING_SPRITE,
  VAULTWARDEN_CRACKED_SPRITE,
  VAULTWARDEN_SPRITE,
} from '../sprites/bossesCVault';

/** Chapter number (1-6) of every chapter id (main and alt share their number). */
export const CHAPTER_DEPTH: Readonly<Record<string, number>> = {
  gutterways: 1,
  drowned_nursery: 1,
  rootcellar: 2,
  candlewick_crypt: 2,
  grinding_works: 3,
  rust_foundry: 3,
  mushroom_hollow: 4,
  glimmer_grotto: 4,
  bone_orchard: 5,
  frostbitten_vault: 5,
  eye_of_storm: 6,
  hollow_nest: 6,
};

/** Pace per chapter of depth past the home chapter, and its clamp. */
export const DEPTH_PACE = 0.06;
const PACE_MIN = 0.85;
const PACE_MAX = 1.25;

/** The pace factor for a boss from `home` fighting in `chapter`. */
export function depthPace(home: string, chapter: string): number {
  const h = CHAPTER_DEPTH[home];
  const c = CHAPTER_DEPTH[chapter];
  if (h === undefined || c === undefined) return 1;
  return Math.min(PACE_MAX, Math.max(PACE_MIN, 1 + DEPTH_PACE * (c - h)));
}

interface LookSpec {
  /** Sprite per phase (the last one covers any later phases). */
  sprites: readonly SpriteDef[];
  /** Home chapter (the first in the BossDef's `chapters`). */
  home: string;
  /** Phase index from which it flies. */
  flyFrom?: number;
}

/** Registered hook name → its spec (tests read it). */
export const BOSS_LOOKS_C = new Map<string, LookSpec>();

function apply(ctx: BossHookCtx, spec: LookSpec, phase: number): void {
  const e = ctx.e;
  const want = spec.sprites[Math.min(phase, spec.sprites.length - 1)]!;
  if (e.sprite !== want) e.sprite = want;
  if (spec.flyFrom !== undefined && phase >= spec.flyFrom && !e.flying) e.flying = true;
  const b = ctx.b;
  const pace = b.c.phases[phase]!.pace * depthPace(spec.home, ctx.w.chapter);
  if (b.pace !== pace) b.pace = pace;
}

function phaseLook(name: string, spec: LookSpec): void {
  BOSS_LOOKS_C.set(name, spec);
  registerBossHook(name, {
    looks: spec.sprites,
    phase: (ctx, i) => apply(ctx, spec, i),
    tick: (ctx) => apply(ctx, spec, ctx.b.phase),
  });
}

phaseLook('bossesC.marrowbough', { sprites: [MARROWBOUGH_SPRITE, MARROWBOUGH_WITHERED_SPRITE], home: 'bone_orchard' });
phaseLook('bossesC.gloamkeeper', { sprites: [GLOAMKEEPER_SPRITE, GLOAMKEEPER_GUTTERING_SPRITE], home: 'bone_orchard' });
phaseLook('bossesC.hoarquill', { sprites: [HOARQUILL_SPRITE, HOARQUILL_SHEDDING_SPRITE], home: 'frostbitten_vault' });
phaseLook('bossesC.vaultwarden', { sprites: [VAULTWARDEN_SPRITE, VAULTWARDEN_CRACKED_SPRITE], home: 'frostbitten_vault' });
phaseLook('bossesC.squallvane', {
  sprites: [SQUALLVANE_SPRITE, SQUALLVANE_STRUCK_SPRITE, SQUALLVANE_UNMOORED_SPRITE],
  home: 'eye_of_storm',
});
phaseLook('bossesC.ambergut', { sprites: [AMBERGUT_SPRITE, AMBERGUT_PUPA_SPRITE, AMBERGUT_HATCHED_SPRITE], home: 'hollow_nest', flyFrom: 2 });
phaseLook('bossesC.tatterjack', { sprites: [TATTERJACK_SPRITE, TATTERJACK_UNSTUFFED_SPRITE], home: 'bone_orchard' });
phaseLook('bossesC.shiverwing', { sprites: [SHIVERWING_SPRITE, SHIVERWING_SHATTERED_SPRITE], home: 'glimmer_grotto' });
phaseLook('bossesC.slagjacket', { sprites: [SLAGJACKET_SPRITE, SLAGJACKET_OVERHEATED_SPRITE], home: 'rust_foundry' });
