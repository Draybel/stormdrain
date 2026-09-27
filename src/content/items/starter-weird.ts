/**
 * Weird starter items: things that look useless (or worse) on their own and shine in combos.
 * - Backwards Cap: shots also fly out behind you. With homing they U-turn into enemies, with a
 *   boomerang they sweep both ways, with the lance you fire two beams.
 * - Paperweight: huge, slow, lingering shots. With explode / puddle / orbit / homing they turn into
 *   floating mines and slow-motion wrecking balls.
 * - Dizzy Top: shots do a lap around you before launching (a spinning shield with pierce or melee;
 *   the lance sweeps a full circle).
 * - Crumbly Biscuit: shots start big and shrink away — but crumble into pieces on a hit.
 * - Teacup Tempest: each volley has a tiny chance (luck helps, copies stack) to make your shots go
 *   feral for a few seconds: +2 shots, homing, chain lightning, explosions, more damage.
 */

import type { ItemDef } from '../../sim/types';
import { COSTUME_BACKWARDS_CAP, ICON_BACKWARDS_CAP, ICON_CRUMBLY_BISCUIT, ICON_DIZZY_TOP, ICON_PAPERWEIGHT, ICON_TEACUP_TEMPEST } from '../sprites/starterItems';

/** How long the Teacup Tempest's feral spell lasts (s). */
const FERAL = 4;

const items: ItemDef[] = [
  {
    id: 'backwards-cap',
    name: 'Backwards Cap',
    desc: 'SHOTS FLY OUT BACKWARDS TOO · WHY?',
    kind: 'passive',
    quality: 1,
    pools: ['treasure', 'shop'],
    tags: ['weird', 'toybox'],
    effects: [{ type: 'mod', mod: 'backShot', stacks: 2 }],
    sprite: ICON_BACKWARDS_CAP,
    costume: { id: 'backwards-cap', layer: 'hat', sprite: COSTUME_BACKWARDS_CAP, frames: 'dir' },
  },
  {
    id: 'paperweight',
    unlock: 'secret-keeper',
    name: 'Paperweight',
    desc: 'HUGE, SLOW SHOTS THAT JUST... SIT THERE',
    kind: 'passive',
    quality: 2,
    pools: ['treasure'],
    tags: ['weird', 'glimmer'],
    effects: [
      { type: 'mod', mod: 'decelerate' },
      { type: 'stat', stat: 'shotSize', mul: 1.8 },
      { type: 'stat', stat: 'damage', mul: 1.5 },
      { type: 'stat', stat: 'shotSpeed', mul: 0.65 },
      { type: 'stat', stat: 'fireRate', mul: 0.8 },
      { type: 'stat', stat: 'knockback', mul: 1.6 },
    ],
    sprite: ICON_PAPERWEIGHT,
  },
  {
    id: 'dizzy-top',
    unlock: 'it-clicks',
    name: 'Dizzy Top',
    desc: 'SHOTS TAKE A LAP AROUND YOU FIRST. WHEE!',
    kind: 'passive',
    quality: 1,
    pools: ['treasure', 'shop'],
    tags: ['weird', 'toybox'],
    effects: [{ type: 'mod', mod: 'circleFirst', stacks: 2 }],
    sprite: ICON_DIZZY_TOP,
  },
  {
    id: 'crumbly-biscuit',
    name: 'Crumbly Biscuit',
    desc: 'SHOTS SHRINK AWAY, THEN CRUMBLE APART',
    kind: 'passive',
    quality: 1,
    pools: ['treasure', 'shop'],
    tags: ['weird', 'food'],
    effects: [
      { type: 'mod', mod: 'shrink' },
      { type: 'mod', mod: 'split', params: { count: 1 } },
      { type: 'stat', stat: 'damage', mul: 0.9 },
    ],
    sprite: ICON_CRUMBLY_BISCUIT,
  },
  {
    id: 'teacup-tempest',
    unlock: 'bog-standard',
    name: 'Teacup Tempest',
    desc: 'ONCE IN A BLUE MOON, SHOTS GO FERAL',
    kind: 'passive',
    quality: 2,
    pools: ['treasure'],
    tags: ['weird', 'stormcaller'],
    effects: [
      {
        type: 'trigger',
        on: 'fire',
        chance: 0.025,
        luck: 0.01,
        maxChance: 0.15,
        cooldown: FERAL + 1,
        say: 'THE TEACUP BOILS OVER!',
        effects: [
          { type: 'mod', mod: 'extraShots', stacks: 2, duration: FERAL },
          { type: 'mod', mod: 'homing', duration: FERAL },
          { type: 'mod', mod: 'chain', duration: FERAL },
          { type: 'mod', mod: 'explode', duration: FERAL },
          { type: 'stat', stat: 'damage', mul: 1.25, duration: FERAL },
        ],
      },
    ],
    sprite: ICON_TEACUP_TEMPEST,
  },
];

export default items;
