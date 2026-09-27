/**
 * Special synergies of the Storm Lance (ARCHITECTURE §4.7, SYNERGIES.md). The lance already merges with
 * everything through the attack pipeline; these pairs add something on top of the automatic stacking —
 * a crown of beams, a furrow of thunder, a choir, hanging orbs, a searing glass, a cyclone, a rod that
 * calls the sky down.
 */

import type { SynergyDef } from '../../sim/types';
import { DEBUT, familiar, hook, mod, stat, when } from '../hooks/synergiesKit';

const synergies: SynergyDef[] = [
  {
    id: 'crown-of-storms',
    name: 'Crown of Storms',
    requires: ['storm-lance', 'tin-pinwheel'],
    effects: [
      // The lance fires as a ring of three beams that turns around her (the tiny-planet ring on a beam volley).
      mod('orbitPlayer', 2),
      when('fire', hook('syn.burst', { at: 'player', radius: 34, dmg: 0.5, push: 120, look: 'shock' })),
    ],
    style: { color: '#bfe8ff', shape: 'star', trail: 'sparks', glow: 2 },
    hook: DEBUT,
  },
  {
    id: 'thunder-furrow',
    name: 'Thunder Furrow',
    requires: ['storm-lance', 'firecracker-pouch'],
    effects: [
      mod('explode'),
      when(
        'fire',
        hook('syn.lineStrikes', {
          spacing: 38,
          max: 6,
          dmg: 0.6,
          radius: 14,
          color: '#fff27a',
          crater: 'ember',
          craterR: 9,
          craterLife: 3.5,
          craterDmg: 0.35,
          status: 'burn',
          time: 3,
          power: 0.3,
        }),
      ),
    ],
    style: { color: '#ffd24a', trail: 'embers', glow: 2 },
    hook: DEBUT,
  },
  {
    id: 'storm-choir',
    name: 'Storm Choir',
    requires: ['storm-lance', { tag: 'familiar', count: 2 }],
    effects: [
      familiar('blinkbug'),
      when('fire', hook('syn.choir', { dmg: 1, range: 150, color: '#fff0a8', sfx: 'chain_zap' })),
    ],
    style: { color: '#fff0a8', shape: 'star', glow: 3 },
    hook: DEBUT,
  },
  {
    id: 'ball-lightning',
    name: 'Ball Lightning',
    requires: ['storm-lance', 'static-cling'],
    effects: [
      mod('chain'),
      when('fire', hook('syn.orbs', { spacing: 24, max: 7, dmg: 1, life: 2.4, drift: 8, r: 3, style: 'ice' })),
    ],
    style: { color: '#d8f0ff', shape: 'bubble', trail: 'sparks', glow: 4 },
    hook: DEBUT,
  },
  {
    id: 'burning-glass',
    name: 'Burning Glass',
    requires: ['storm-lance', 'magnifying-glass'],
    effects: [
      mod('burn', 2),
      stat('shotSize', { mul: 1.15 }),
      when('kill', hook('syn.burst', { needs: 'burn', radius: 26, dmg: 0.8, status: 'burn', time: 3, power: 0.3, look: 'ember' }), {
        cooldown: 0.15,
      }),
    ],
    style: { color: '#ffffff', trail: 'embers', glow: 4 },
    hook: DEBUT,
  },
  {
    id: 'cyclone-sweep',
    name: 'Cyclone Sweep',
    requires: ['storm-lance', 'dizzy-top'],
    effects: [
      mod('knockback'),
      when('fire', hook('syn.gust', { radius: 80, push: 280, dmg: 0.4, pop: 1, look: 'shock', sfx: 'boomerang_whoosh' })),
    ],
    style: { color: '#7fffe0', trail: 'wisps', glow: 2 },
    hook: DEBUT,
  },
  {
    id: 'lightning-rod',
    name: 'Lightning Rod',
    requires: ['storm-lance', 'rooftop-rod'],
    effects: [
      mod('chain', 1, { jumps: 1 }),
      when('fire', hook('syn.skyBolts', { count: 3, dmg: 1.2, radius: 10, color: '#fff27a', status: 'slow', time: 1, power: 0.4 })),
    ],
    style: { color: '#fff27a', shape: 'spiky', trail: 'sparks', glow: 3 },
    hook: DEBUT,
  },
];

export default synergies;
