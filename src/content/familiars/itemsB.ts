/**
 * Familiars of the "items B" passives (ARCHITECTURE §4.8):
 * - Tin Sentry (follow, shooter): a wind-up toy soldier — slower, harder volleys than a Lamplet.
 *   The Toybox set adds two more to the parade.
 * - Threadbare Bear (guard): a patched teddy circling close, hugging enemy shots out of the air.
 * - Tadpole (hover, shooter): a little gutter tadpole that spits fast, small shots.
 * - Gutter Ferret (chase, shooter): darts at the nearest foe, nips it and fires point-blank, so every
 *   hit modifier the player holds lands right in the enemy's face.
 * Shooters fire the player's whole attack profile at their scale (every carrier and modifier).
 */

import type { FamiliarDef } from '../../sim/types';
import { GUTTER_FERRET_SPRITE, TADPOLE_SPRITE, THREADBARE_BEAR_SPRITE, TIN_SENTRY_SPRITE } from '../sprites/itemsBFamiliars';

const familiars: FamiliarDef[] = [
  {
    id: 'tin-sentry',
    name: 'Tin Sentry',
    desc: 'A wind-up toy soldier that marches behind you and fires sturdy volleys.',
    sprite: TIN_SENTRY_SPRITE,
    behavior: 'follow',
    radius: 4,
    attackScale: 0.5,
    fireRateMul: 0.85,
    speed: 105,
  },
  {
    id: 'threadbare-bear',
    name: 'Threadbare Bear',
    desc: 'A patched teddy bear that circles close and hugs enemy shots out of the air.',
    sprite: THREADBARE_BEAR_SPRITE,
    behavior: 'guard',
    radius: 5,
    attackScale: 0,
    contactDamage: 3,
    speed: 90,
    blocks: true,
  },
  {
    id: 'tadpole',
    name: 'Tadpole',
    desc: 'A gutter tadpole that wiggles along beside you and spits quick little shots.',
    sprite: TADPOLE_SPRITE,
    behavior: 'hover',
    radius: 4,
    attackScale: 0.3,
    fireRateMul: 1.5,
    speed: 115,
    glow: '150,210,255',
  },
  {
    id: 'gutter-ferret',
    name: 'Gutter Ferret',
    desc: 'A masked ferret that darts at the nearest foe, nips it and fires point-blank.',
    sprite: GUTTER_FERRET_SPRITE,
    behavior: 'chase',
    radius: 4,
    attackScale: 0.3,
    fireRateMul: 0.8,
    contactDamage: 4,
    speed: 160,
    blocks: false,
  },
];

export default familiars;
