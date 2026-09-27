/**
 * Items pack A familiars (ARCHITECTURE §4.8). Shooters fire the player's whole attack profile at their
 * `attackScale`, so they inherit every carrier and modifier; duplicates of the item add more of them.
 * - Blinkbug (hover): a lightning bug that zips along in your wake, firing small, quick shots.
 * - Gloamwing (orbit): a dusk moth that circles you, swats enemy shots, bumps foes and shoots a little.
 * - Tin Cuckoo (follow): a wind-up bird that pops out shots faster than you do.
 * - Toddlecap (chase): a walking mushroom that headbutts the nearest foe.
 * - Tallow Tot (follow): a stubby candle that shoots a bit slower but harder.
 */

import type { FamiliarDef } from '../../sim/types';
import {
  BLINKBUG_SPRITE,
  GLOAMWING_SPRITE,
  TALLOW_TOT_SPRITE,
  TIN_CUCKOO_SPRITE,
  TODDLECAP_SPRITE,
} from '../sprites/itemsA-familiars';

const familiars: FamiliarDef[] = [
  {
    id: 'blinkbug',
    name: 'Blinkbug',
    desc: 'A lightning bug that zips along behind you, blinking out quick little shots.',
    sprite: BLINKBUG_SPRITE,
    behavior: 'hover',
    radius: 4,
    attackScale: 0.3,
    fireRateMul: 1.5,
    speed: 125,
    glow: '255,240,120',
  },
  {
    id: 'gloamwing',
    name: 'Gloamwing',
    desc: 'A dusk moth that circles you, swatting shots aside and shooting now and then.',
    sprite: GLOAMWING_SPRITE,
    behavior: 'orbit',
    radius: 4,
    attackScale: 0.3,
    fireRateMul: 0.7,
    contactDamage: 3,
    blocks: true,
    glow: '220,200,255',
  },
  {
    id: 'tin-cuckoo',
    name: 'Tin Cuckoo',
    desc: 'A wind-up bird that trails after you and cuckoos out shots on the beat.',
    sprite: TIN_CUCKOO_SPRITE,
    behavior: 'follow',
    radius: 4,
    attackScale: 0.35,
    fireRateMul: 1.3,
    speed: 115,
  },
  {
    id: 'toddlecap',
    name: 'Toddlecap',
    desc: 'A little walking mushroom that waddles over and headbutts your foes.',
    sprite: TODDLECAP_SPRITE,
    behavior: 'chase',
    radius: 4,
    attackScale: 0,
    contactDamage: 5,
    speed: 115,
    blocks: false,
  },
  {
    id: 'tallow-tot',
    name: 'Tallow Tot',
    desc: 'A stubby candle with a sleepy face that follows you and fires big, slow shots.',
    sprite: TALLOW_TOT_SPRITE,
    behavior: 'follow',
    radius: 4,
    attackScale: 0.5,
    fireRateMul: 0.75,
    glow: '255,190,110',
  },
];

export default familiars;
