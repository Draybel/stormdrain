/**
 * Familiars that belong to characters rather than items:
 * - Firefly (Juniper's jar, sim/mechanics.ts): a little glowing bug circling her that fires a small copy of her
 *   attack whenever she does. Two are innate; cleared rooms let more out (up to six). It doesn't block shots.
 */

import type { FamiliarDef } from '../../sim/types';
import { FIREFLY_SPRITE } from '../sprites/characters';

const familiars: FamiliarDef[] = [
  {
    id: 'firefly',
    name: 'Firefly',
    desc: "A firefly from Juniper's jar. It circles her and shoots when she does.",
    sprite: FIREFLY_SPRITE,
    behavior: 'orbit',
    radius: 3,
    attackScale: 0.5,
    fireRateMul: 0.9,
    speed: 130,
    blocks: false,
    glow: '255,236,120',
  },
];

export default familiars;
