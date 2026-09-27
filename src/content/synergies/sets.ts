/**
 * Set-flavoured special synergies (ARCHITECTURE §4.7, SYNERGIES.md): two DESIGN.md item sets meeting
 * halfway (distinct items with the sets' tags, so they can happen long before either transformation),
 * or a set's centrepiece with its crowd.
 */

import type { SynergyDef } from '../../sim/types';
import { DEBUT, familiar, hook, mod, stat, when } from '../hooks/synergiesKit';

const synergies: SynergyDef[] = [
  {
    id: 'thunderstorm',
    name: 'Thunderstorm',
    requires: [
      { tag: 'stormcaller', count: 2 },
      { tag: 'tidewalker', count: 2 },
    ],
    effects: [mod('puddle'), when('fire', hook('syn.conduct', { dmg: 0.4, link: 44, color: '#9fdcff' }), { cooldown: 0.5 })],
    style: { color: '#9fd8ff', trail: 'drops', glow: 2 },
    hook: DEBUT,
  },
  {
    id: 'bog-bloom',
    name: 'Bog Bloom',
    requires: ['earthstar', { tag: 'sporeling', count: 2 }],
    effects: [
      mod('poison'),
      when('fire', hook('syn.puddles', { style: 'muck', grow: 0.3, status: 'poison', time: 3, power: 0.35, sfx: 'poison' }), { cooldown: 0.6 }),
    ],
    style: { color: '#9ad060', shape: 'bubble', trail: 'bubbles' },
    hook: DEBUT,
  },
  {
    id: 'wind-up-army',
    name: 'Wind-Up Army',
    requires: [
      { tag: 'clockwork', count: 2 },
      { tag: 'toybox', count: 2 },
    ],
    effects: [
      familiar('tin-sentry'),
      stat('fireRate', { add: 0.25 }),
      // Timed and cooled down (one boost at a time, however fast rooms are cleared).
      when('roomClear', stat('fireRate', { add: 1 }, 8), { cooldown: 8, say: 'WOUND UP TIGHT!' }),
    ],
    style: { color: '#b89060', shape: 'gear', trail: 'dust' },
    hook: DEBUT,
  },
  {
    id: 'king-of-the-toybox',
    name: 'King of the Toybox',
    requires: ['paper-crown', { tag: 'toybox', count: 3 }],
    effects: [
      familiar('threadbare-bear'),
      stat('damage', { add: 0.5 }),
      stat('luck', { add: 1 }),
      when('roomClear', { type: 'pickups', table: 'roomClear' }, { chance: 0.2, luck: 0.04, maxChance: 0.5, say: 'A TRIBUTE FOR THE KING!' }),
    ],
    style: { color: '#ffd76a', shape: 'star', trail: 'sparks', glow: 2 },
    hook: DEBUT,
  },
];

export default synergies;
