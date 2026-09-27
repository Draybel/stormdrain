/**
 * Special synergies of the odd ones (ARCHITECTURE §4.7, SYNERGIES.md): "useless alone" weird items that
 * find their other half, lucky charms that stack their luck, and the cosy health items.
 */

import type { SynergyDef } from '../../sim/types';
import { DEBUT, hook, mod, stat, when } from '../hooks/synergiesKit';

const synergies: SynergyDef[] = [
  {
    id: 'continental-drift',
    name: 'Continental Drift',
    requires: ['snail-mail-stamp', 'paperweight'],
    effects: [mod('pierce', 2), mod('grow'), stat('damage', { mul: 1.1 })],
    style: { color: '#a08a70', trail: 'dust', glow: 1 },
    hook: DEBUT,
  },
  {
    id: 'heart-mail',
    name: 'Heart Mail',
    requires: ['paper-valentine', 'snail-mail-stamp'],
    effects: [
      mod('charm'),
      when('fire', hook('syn.foeRings', { needs: 'charm', n: 4, speed: 120, dmg: 0.6, style: 'charm', maxFoes: 8 }), { cooldown: 1.2 }),
    ],
    style: { color: '#ff6ab0', shape: 'star', trail: 'wisps' },
    hook: DEBUT,
  },
  {
    id: 'moonwalk',
    name: 'Moonwalk',
    requires: ['backwards-cap', 'rearview-mirror'],
    effects: [mod('homing'), mod('backShot'), stat('damage', { add: 0.5 })],
    style: { color: '#c8f0ff', trail: 'wisps', glow: 1 },
    hook: DEBUT,
  },
  {
    id: 'biscuit-dunk',
    name: 'Biscuit Dunk',
    requires: ['crumbly-biscuit', 'thermos-of-soup'],
    effects: [mod('puddle'), mod('split'), when('roomClear', { type: 'heal', amount: 1 }, { chance: 0.3 })],
    style: { color: '#e0b070', shape: 'shard', trail: 'drops' },
    hook: DEBUT,
  },
  {
    id: 'tea-party',
    name: 'Tea Party',
    requires: ['teacup-tempest', 'shrieking-kettle'],
    effects: [
      when(
        'fire',
        [mod('extraShots', 2), mod('burn'), mod('homing'), stat('fireRate', { add: 1 })].map((e) => ({ ...e, duration: 4 })),
        { chance: 0.05, luck: 0.01, maxChance: 0.2, cooldown: 6, say: 'THE KETTLE SINGS!' },
      ),
    ],
    style: { color: '#b0e8c0', trail: 'wisps' },
    hook: DEBUT,
  },
  {
    id: 'loaded-dice',
    name: 'Loaded Dice',
    requires: ['weighted-die', 'bent-horseshoe'],
    effects: [
      stat('luck', { add: 2 }),
      when('fire', [mod('extraShots', 2), mod('homing'), mod('pierce')].map((e) => ({ ...e, duration: 3 })), {
        chance: 0.02,
        luck: 0.01,
        maxChance: 0.12,
        cooldown: 5,
        say: 'JACKPOT!',
      }),
    ],
    style: { color: '#7ee06a', shape: 'star', trail: 'sparks' },
    hook: DEBUT,
  },
  {
    id: 'haunted-house',
    name: 'Haunted House',
    requires: ['bedsheet-ghost', 'wisp-in-a-bottle'],
    effects: [mod('fear'), when('kill', hook('syn.ghosts', { n: 1, speed: 90, dmg: 1.2, style: 'dust', life: 3 }), { cooldown: 0.2 })],
    style: { color: '#f0f0ff', shape: 'bubble', trail: 'wisps', glow: 2 },
    hook: DEBUT,
  },
  {
    id: 'tin-can-knight',
    name: 'Tin Can Knight',
    requires: ['sardine-tin', 'tin-ribcage', 'pot-lid'],
    effects: [
      when('floorStart', { type: 'hearts', tin: 2 }),
      when('hurt', hook('syn.ring', { at: 'player', n: 8, speed: 150, dmg: 0.8, style: 'dust', look: '#c0c8d8', sfx: 'tin_break' })),
    ],
    style: { color: '#c0c8d8', shape: 'gear' },
    hook: DEBUT,
  },
  {
    id: 'hearthside',
    name: 'Hearthside',
    requires: ['hot-water-bottle', 'warming-pan'],
    effects: [mod('burn'), when('floorStart', { type: 'hearts', ember: 1 })],
    style: { color: '#ff5a5a', trail: 'embers', glow: 2 },
    hook: DEBUT,
  },
];

export default synergies;
