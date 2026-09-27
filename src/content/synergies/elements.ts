/**
 * Special synergies between hit effects (ARCHITECTURE §4.7, SYNERGIES.md): frost and fire, oil and
 * sparks, crackers and crystals — the status / explosion / puddle pairs that turn into something new.
 */

import type { SynergyDef } from '../../sim/types';
import { DEBUT, hook, mod, stat, when } from '../hooks/synergiesKit';

const synergies: SynergyDef[] = [
  {
    id: 'frost-nova',
    name: 'Frost Nova',
    requires: ['ice-cube-tray', 'party-popper'],
    effects: [
      mod('freeze'),
      when('kill', [
        hook('syn.ring', { needs: 'freeze', n: 10, speed: 160, dmg: 0.7, style: 'ice', life: 1, look: 'frost', sfx: 'freeze' }),
        hook('syn.burst', { needs: 'freeze', radius: 34, status: 'freeze', time: 1.2 }),
      ]),
    ],
    style: { color: '#bff0ff', shape: 'shard', trail: 'ice', glow: 2 },
    hook: DEBUT,
  },
  {
    // Homing + chain: the lightning goes looking for foes, and splits whenever it finds one.
    id: 'fork-in-the-road',
    name: 'Fork in the Road',
    requires: ['lantern-moth', 'brass-kite-key'],
    effects: [
      mod('homing', 1, { radius: 24 }),
      when(
        'fire',
        hook('syn.forkBolt', { range: 150, forkRange: 64, forks: 2, depth: 2, dmg: 0.6, decay: 0.85, color: '#c8ff4a', sfx: 'chain_zap' }),
        { cooldown: 0.45 },
      ),
    ],
    style: { color: '#c8ff4a', shape: 'spiky', trail: 'sparks', glow: 2 },
    hook: DEBUT,
  },
  {
    // Poison + fire: a poisoned foe is a bag of swamp gas waiting for a spark.
    id: 'swamp-gas',
    name: 'Swamp Gas',
    requires: ['toadstool-cap', 'trick-candle'],
    effects: [
      when(
        'kill',
        [
          hook('syn.blasts', { needs: 'poison', mode: 'ring', n: 3, dist: 9, radius: 15, dmg: 0.6 }),
          hook('syn.burst', { needs: 'poison', radius: 32, status: 'burn', time: 3, power: 0.3, look: '#c0b030', sfx: 'fire_nova' }),
        ],
        { cooldown: 0.2 },
      ),
    ],
    style: { color: '#c0b030', shape: 'bubble', trail: 'embers', glow: 1 },
    hook: DEBUT,
  },
  {
    id: 'oil-slick',
    name: 'Oil Slick',
    requires: ['leaky-bucket', 'drippy-candle'],
    effects: [
      mod('puddle'),
      when('fire', hook('syn.puddles', { style: 'ember', grow: 0.5, status: 'burn', time: 2.5, power: 0.3 }), { cooldown: 0.4 }),
    ],
    style: { color: '#d86a2a', shape: 'bubble', trail: 'embers' },
    hook: DEBUT,
  },
  {
    id: 'cluster-crackers',
    name: 'Cluster Crackers',
    requires: ['firecracker-pouch', 'geode'],
    effects: [mod('split'), when('kill', hook('syn.blasts', { mode: 'ring', n: 4, dist: 14, radius: 13, dmg: 0.5 }), { cooldown: 0.3 })],
    style: { color: '#ff5a3a', shape: 'bomb', trail: 'sparks', glow: 2 },
    hook: DEBUT,
  },
  {
    id: 'surprise-party',
    name: 'Surprise Party',
    requires: ['party-popper', 'jack-in-the-box'],
    effects: [stat('luck', { add: 1 }), when('use', hook('syn.blasts', { mode: 'foes', max: 12, radius: 18, dmg: 1.2 }))],
    style: { color: '#ff8ad0', shape: 'star', trail: 'sparks' },
    hook: DEBUT,
  },
  {
    id: 'fireworks-night',
    name: 'Fireworks Night',
    requires: ['leather-apron', 'sparkler-stub'],
    effects: [when('bomb', hook('syn.ring', { n: 10, speed: 120, dmg: 1.5, style: 'charm', life: 1.6, look: 'gold', sfx: 'crackle' }))],
    style: { color: '#ff4a8a', shape: 'spiky', trail: 'sparks', glow: 2 },
    hook: DEBUT,
  },
  {
    id: 'butterfingers',
    name: 'Butterfingers',
    requires: ['greasy-gloves', 'earplugs'],
    effects: [
      mod('explode'),
      stat('range', { mul: 1.25 }),
      when('hurt', hook('syn.blasts', { at: 'player', mode: 'ring', n: 6, dist: 20, radius: 16, dmg: 1 })),
    ],
    style: { color: '#ffb347', shape: 'bomb', trail: 'embers' },
    hook: DEBUT,
  },
  {
    id: 'moth-to-a-flame',
    name: 'Moth to a Flame',
    requires: [
      { tag: 'mothkin', count: 2 },
      { tag: 'waxen', count: 2 },
    ],
    effects: [
      mod('homing'),
      mod('burn'),
      when('kill', hook('syn.contagion', { needs: 'burn', radius: 56, max: 2, time: 3, power: 0.35, color: '#ffb040', sfx: 'burn' })),
    ],
    style: { color: '#ffa878', trail: 'wisps', glow: 2 },
    hook: DEBUT,
  },
  {
    id: 'lantern-parade',
    name: 'Lantern Parade',
    requires: ['lamplet', 'tallow-tot', 'wick-wisp'],
    effects: [
      mod('burn'),
      when('fire', hook('syn.familiarPuddles', { style: 'ember', r: 6, life: 2.2, dmg: 0.15, status: 'burn', time: 2, power: 0.25 }), {
        cooldown: 0.7,
      }),
    ],
    style: { color: '#ffc060', trail: 'embers', glow: 2 },
    hook: DEBUT,
  },
  {
    id: 'nightlight',
    name: 'Nightlight',
    requires: ['gloamwing', 'porch-bulb'],
    effects: [
      mod('slow'),
      mod('homing'),
      when('fire', hook('syn.familiarPuddles', { style: 'dust', r: 7, life: 2.5, dmg: 0.1, status: 'slow', time: 1.5, power: 0.5 }), {
        cooldown: 0.9,
      }),
    ],
    style: { color: '#d8cce6', trail: 'wisps', glow: 2 },
    hook: DEBUT,
  },
];

export default synergies;
