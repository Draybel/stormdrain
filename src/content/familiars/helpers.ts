/**
 * Familiars (FamiliarDef, sim/attack/familiars.ts). Shooters fire the player's whole attack profile at
 * their `attackScale`, so they pick up every carrier and modifier (a Lamplet with the Storm Lance
 * charges with you and fires its own little beam).
 */

import type { FamiliarDef } from '../../sim/types';
import { BOTTLECAP_BEETLE_SPRITE, LAMPLET_SPRITE, PAPER_BOAT_SPRITE } from '../sprites/attack';

const familiars: FamiliarDef[] = [
  {
    id: 'lamplet',
    name: 'Lamplet',
    desc: 'A paper-lantern sprite that bobs behind you and shoots when you do.',
    sprite: LAMPLET_SPRITE,
    behavior: 'follow',
    radius: 4,
    attackScale: 0.45,
    fireRateMul: 0.9,
    glow: '255,190,90',
  },
  {
    id: 'paper-boat',
    name: 'Paper Boat',
    desc: 'A folded boat that sails along in your wake, firing small shots.',
    sprite: PAPER_BOAT_SPRITE,
    behavior: 'follow',
    radius: 4,
    attackScale: 0.35,
    fireRateMul: 1.25,
    speed: 120,
  },
  {
    id: 'bottlecap-beetle',
    name: 'Bottlecap Beetle',
    desc: 'Circles you in its bottle-cap shell, bumping foes and blocking shots.',
    sprite: BOTTLECAP_BEETLE_SPRITE,
    behavior: 'orbit',
    radius: 4,
    attackScale: 0,
    contactDamage: 4,
    blocks: true,
  },
];

export default familiars;
