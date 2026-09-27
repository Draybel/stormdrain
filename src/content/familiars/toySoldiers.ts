/**
 * Item-C familiars: the Tin Soldiers called by the Tin Soldier Tin active (three for the room).
 * They join the follower chain and fire the player's whole attack profile at a small scale, so they
 * pick up every carrier and modifier like the other shooters.
 */

import type { FamiliarDef } from '../../sim/types';
import { TIN_SOLDIER_SPRITE } from '../sprites/itemsCActives';

const familiars: FamiliarDef[] = [
  {
    id: 'tin-soldier',
    name: 'Tin Soldier',
    desc: 'A wind-up toy soldier that marches behind you and fires when you do.',
    sprite: TIN_SOLDIER_SPRITE,
    behavior: 'follow',
    radius: 4,
    attackScale: 0.3,
    fireRateMul: 0.8,
    speed: 115,
  },
];

export default familiars;
