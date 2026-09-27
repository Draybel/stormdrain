/**
 * Trinket + item special synergies (ARCHITECTURE §4.7, SYNERGIES.md): small pocket things that wake up
 * next to the right item — a static sock and a wool mitten, a matchbook and birthday candles…
 */

import type { SynergyDef } from '../../sim/types';
import { DEBUT, hook, mod, stat, when } from '../hooks/synergiesKit';

const synergies: SynergyDef[] = [
  {
    id: 'static-shock',
    name: 'Static Shock',
    requires: ['static-sock', 'wool-mitten'],
    effects: [
      mod('chain'),
      when('pickup', hook('syn.skyBolts', { at: 'player', count: 1, dmg: 2, radius: 12, color: '#fff8a0' }), { cooldown: 0.3 }),
    ],
    style: { color: '#b0ff6a', shape: 'spiky', trail: 'sparks' },
    hook: DEBUT,
  },
  {
    id: 'make-a-wish',
    name: 'Make a Wish',
    requires: ['birthday-candles', 'matchbook'],
    effects: [
      mod('burn'),
      when('use', [
        hook('syn.burst', { at: 'player', radius: 100, dmg: 1, status: 'burn', time: 4, power: 0.4, look: 'ember' }),
        { type: 'pickups', spawn: [{ kind: 'luckyCoin' }] },
      ]),
    ],
    style: { color: '#ffb0a0', shape: 'star', trail: 'embers', glow: 2 },
    hook: DEBUT,
  },
  {
    id: 'frozen-moment',
    name: 'Frozen Moment',
    requires: ['frozen-pocketwatch', 'frost-bead'],
    effects: [
      when('use', hook('syn.foeRings', { needs: 'freeze', n: 4, speed: 130, dmg: 0.6, style: 'ice', maxFoes: 12, sfx: 'st_shatter' })),
      when('hurt', hook('syn.foeRings', { needs: 'freeze', n: 4, speed: 130, dmg: 0.6, style: 'ice', maxFoes: 12, sfx: 'st_shatter' })),
    ],
    style: { color: '#9ab8ff', shape: 'gear', trail: 'ice' },
    hook: DEBUT,
  },
  {
    id: 'ember-harvest',
    name: 'Ember Harvest',
    requires: ['hot-coal', 'candle-snuffer'],
    effects: [mod('burn'), when('kill', hook('syn.loot', { needs: 'burn', kind: 'emberHeart', chance: 0.05, luck: 0.01, maxChance: 0.15 }))],
    style: { color: '#ff7a2a', trail: 'embers', glow: 1 },
    hook: DEBUT,
  },
  {
    id: 'bath-time',
    name: 'Bath Time',
    requires: ['rubber-duck', 'rain-stick'],
    effects: [when('use', hook('syn.puddleRain', { n: 8, r: 11, life: 5, dmg: 0.35, style: 'water', sfx: 'bounce_ping' }))],
    style: { color: '#ffe066', shape: 'bubble', trail: 'bubbles' },
    hook: DEBUT,
  },
  {
    id: 'true-north',
    name: 'True North',
    requires: ['cracked-compass', 'feathery-antennae'],
    effects: [mod('homing', 1, { turn: 3, radius: 40 }), when('floorStart', hook('itemsC.revealMap', { level: 'layout' }))],
    style: { color: '#ff6a6a', shape: 'spiky', trail: 'wisps', glow: 2 },
    hook: DEBUT,
  },
  {
    id: 'crow-call',
    name: 'Crow Call',
    requires: ['crow-feather', 'crows-jawbone'],
    effects: [
      stat('shotSpeed', { add: 20 }),
      when('hurt', hook('syn.ghosts', { at: 'player', n: 4, speed: 130, dmg: 1, style: 'dust', life: 2, sfx: 'boomerang_whoosh' })),
    ],
    style: { color: '#8a7ab8', shape: 'spiky', trail: 'dust' },
    hook: DEBUT,
  },
  {
    id: 'tooth-fairy',
    name: 'Tooth Fairy',
    requires: ['baby-tooth', 'weighted-die'],
    effects: [
      stat('luck', { add: 1 }),
      when('kill', { type: 'pickups', spawn: [{ kind: 'silverCoin' }] }, { chance: 0.03, luck: 0.01, maxChance: 0.12 }),
    ],
    style: { color: '#f0c0ff', shape: 'star', glow: 3 },
    hook: DEBUT,
  },
  {
    id: 'overcharge',
    name: 'Overcharge',
    requires: ['jar-of-lightning', 'spare-battery'],
    effects: [when('use', hook('syn.skyBolts', { at: 'player', count: 5, dmg: 1.5, radius: 12, color: '#9fdcff' }))],
    style: { color: '#8ab4ff', shape: 'spiky', trail: 'sparks' },
    hook: DEBUT,
  },
  {
    id: 'sugar-rush',
    name: 'Sugar Rush',
    requires: ['candy-wrapper', 'cold-brew-can'],
    effects: [
      when('pickup', [stat('fireRate', { add: 0.8 }, 3), hook('syn.burst', { at: 'player', radius: 18, look: 'charm' })], { cooldown: 1 }),
    ],
    style: { color: '#80e8ff', trail: 'sparks', glow: 1 },
    hook: DEBUT,
  },
];

export default synergies;
