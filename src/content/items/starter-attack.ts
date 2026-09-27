/**
 * Starter attack types (ARCHITECTURE §4.2): one item per carrier. Tag 'starter-attack' — the training
 * yard's attack pedestal rotates through these. Holding two changes HOW damage travels (the primary)
 * and merges the other in as a rider, so every pair makes something new; duplicates stack.
 * The Storm Lance is the signature quality-4 item (DESIGN.md). Set tags follow DESIGN.md's item sets.
 */

import type { ItemDef } from '../../sim/types';
import {
  ICON_BROKEN_OAR,
  ICON_COILED_SPRING,
  ICON_FIRECRACKER_POUCH,
  ICON_NEON_TUBE,
  ICON_RUSTY_BOOMERANG,
  ICON_STORM_LANCE,
  ICON_TIN_PINWHEEL,
  STORM_AURA_SPRITE,
  STORM_EYES_SPRITE,
} from '../sprites/attack';
import { COSTUME_FIRECRACKER_POUCH, COSTUME_NEON_VISOR, COSTUME_TIN_PINWHEEL } from '../sprites/starterItems';

const items: ItemDef[] = [
  {
    id: 'storm-lance',
    name: 'Storm Lance',
    desc: 'HOLD TO CHARGE · RELEASE THE STORM',
    kind: 'passive',
    quality: 4,
    pools: ['treasure', 'boss'],
    tags: ['starter-attack', 'stormcaller', 'lightning'],
    effects: [{ type: 'carrier', carrier: 'lance' }],
    sprite: ICON_STORM_LANCE,
    costume: [
      {
        id: 'storm-aura',
        layer: 'aura',
        sprite: STORM_AURA_SPRITE,
        behind: true,
        frames: 'anim',
        fps: 14,
        glow: '90,170,255',
        sparks: '#bfe8ff',
        additive: true,
      },
      { id: 'storm-eyes', layer: 'eyes', sprite: STORM_EYES_SPRITE, frames: 'dir', glow: '140,220,255', additive: false },
    ],
  },
  {
    id: 'neon-tube',
    name: 'Neon Tube',
    desc: 'FIRES THIN ZAPPING LASERS',
    kind: 'passive',
    quality: 3,
    pools: ['treasure', 'shop'],
    tags: ['starter-attack', 'stormcaller', 'lightning'],
    effects: [{ type: 'carrier', carrier: 'laser' }],
    sprite: ICON_NEON_TUBE,
    costume: { id: 'neon-visor', layer: 'eyes', sprite: COSTUME_NEON_VISOR, frames: 'dir', glow: '255,90,140', additive: true },
  },
  {
    id: 'rusty-boomerang',
    name: 'Rusty Boomerang',
    desc: 'THROW A BLADE · IT COMES BACK',
    kind: 'passive',
    quality: 2,
    pools: ['treasure'],
    tags: ['starter-attack', 'toybox'],
    effects: [{ type: 'carrier', carrier: 'boomerang' }],
    sprite: ICON_RUSTY_BOOMERANG,
  },
  {
    id: 'broken-oar',
    name: 'Broken Oar',
    desc: 'SWING AT THINGS UP CLOSE',
    kind: 'passive',
    quality: 2,
    pools: ['treasure', 'shop'],
    tags: ['starter-attack', 'tidewalker'],
    effects: [{ type: 'carrier', carrier: 'melee' }],
    sprite: ICON_BROKEN_OAR,
  },
  {
    id: 'firecracker-pouch',
    name: 'Firecracker Pouch',
    desc: 'YOUR SHOTS ARE TINY BOMBS',
    kind: 'passive',
    quality: 3,
    pools: ['treasure'],
    tags: ['starter-attack', 'explosive'],
    effects: [{ type: 'carrier', carrier: 'bomb' }],
    sprite: ICON_FIRECRACKER_POUCH,
    costume: { id: 'firecracker-pouch', layer: 'body', sprite: COSTUME_FIRECRACKER_POUCH, frames: 'dir' },
  },
  {
    id: 'coiled-spring',
    name: 'Coiled Spring',
    desc: 'HOLD TO CHARGE A BIGGER SHOT',
    kind: 'passive',
    quality: 2,
    pools: ['treasure', 'shop'],
    tags: ['starter-attack', 'clockwork'],
    effects: [{ type: 'carrier', carrier: 'charge' }],
    sprite: ICON_COILED_SPRING,
  },
  {
    id: 'tin-pinwheel',
    name: 'Tin Pinwheel',
    desc: 'BLADES SPIN AROUND YOU',
    kind: 'passive',
    quality: 3,
    pools: ['treasure'],
    tags: ['starter-attack', 'toybox', 'clockwork'],
    effects: [{ type: 'carrier', carrier: 'orbit' }],
    sprite: ICON_TIN_PINWHEEL,
    costume: { id: 'tin-pinwheel', layer: 'hat', sprite: COSTUME_TIN_PINWHEEL, frames: 'anim', fps: 10 },
  },
];

export default items;
