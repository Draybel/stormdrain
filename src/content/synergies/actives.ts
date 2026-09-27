/**
 * Active-item special synergies (ARCHITECTURE §4.7, SYNERGIES.md): while the active is held next to the
 * right passive, using it does something extra ('use' trigger — it fires right after the active's own
 * effect).
 */

import type { SynergyDef } from '../../sim/types';
import { DEBUT, familiar, hook, stat, when } from '../hooks/synergiesKit';

const synergies: SynergyDef[] = [
  {
    id: 'mirror-lid',
    name: 'Mirror Lid',
    requires: ['pot-lid', 'rearview-mirror'],
    effects: [when('use', hook('syn.reflect', { mode: 'all', speed: 190, dmg: 1 }))],
    style: { color: '#c8d4f0', shape: 'shard', trail: 'sparks' },
    hook: DEBUT,
  },
  {
    id: 'whirlpool',
    name: 'Whirlpool',
    requires: ['drain-plunger', 'snail-shell'],
    effects: [when('use', hook('syn.vortex', { radius: 120, pull: 180, swirl: 200, dmg: 1, slow: 2, puddles: 6, r: 10, sfx: 'puddle_splash' }))],
    style: { color: '#5aa8e8', shape: 'bubble', trail: 'drops' },
    hook: DEBUT,
  },
  {
    id: 'slow-dance',
    name: 'Slow Dance',
    requires: ['crank-radio', 'pocket-metronome'],
    effects: [stat('fireRate', { mul: 1.05 }), when('use', hook('syn.stall', { factor: 0.35, radius: 0, look: 'charm' }))],
    style: { color: '#9aa0c8', trail: 'dust' },
    hook: DEBUT,
  },
  {
    id: 'mushroom-circle',
    name: 'Mushroom Circle',
    requires: ['puffball', 'fairy-ring'],
    effects: [
      when('use', hook('syn.everyFoe', { hook: 'itemsA.sporeCloud', max: 12, radius: 26, dmg: 0.5, poison: 3, power: 0.35, sfx: 'poison' })),
    ],
    style: { color: '#c8ffb0', shape: 'star', trail: 'bubbles' },
    hook: DEBUT,
  },
  {
    id: 'drum-solo',
    name: 'Drum Solo',
    requires: ['rumble-drum', 'chattering-teeth'],
    effects: [when('use', hook('syn.waves', { at: 'player', count: 3, radius: 70, speed: 170, dmg: 1, band: 7, look: 'shock', sfx: 'foe_quake' }))],
    style: { color: '#e05a4a', shape: 'spiky', trail: 'dust' },
    hook: DEBUT,
  },
  {
    id: 'marching-band',
    name: 'Marching Band',
    requires: ['tin-sentry', 'tin-soldier-tin', 'tin-soldier-medal'],
    effects: [
      familiar('tin-sentry'),
      stat('fireRate', { add: 0.3 }),
      when('use', hook('syn.choir', { dmg: 1.5, range: 180, color: '#ffd76a', sfx: 'keeper_chime' })),
    ],
    style: { color: '#e8c050', shape: 'gear', trail: 'sparks' },
    hook: DEBUT,
  },
];

export default synergies;
