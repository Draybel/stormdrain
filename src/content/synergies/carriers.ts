/**
 * Special synergies built on the other attack types (ARCHITECTURE §4.7, SYNERGIES.md): the Neon Tube's
 * lasers, the Rusty Boomerang's blades, the Broken Oar's swings and the orbiting blades.
 */

import type { SynergyDef } from '../../sim/types';
import { DEBUT, hook, mod, stat, when } from '../hooks/synergiesKit';

const synergies: SynergyDef[] = [
  // ── Lasers ──
  {
    id: 'mirror-ball',
    name: 'Mirror Ball',
    requires: ['neon-tube', 'kaleidoscope'],
    effects: [
      mod('circleFirst'),
      when('fire', hook('syn.ring', { at: 'player', n: 8, speed: 110, dmg: 0.3, style: 'charm', life: 1.2 }), { cooldown: 1 }),
    ],
    style: { color: '#ff9af0', shape: 'star', trail: 'sparks', glow: 3 },
    hook: DEBUT,
  },
  {
    id: 'lasso-laser',
    name: 'Lasso Laser',
    requires: ['neon-tube', 'rusty-boomerang'],
    effects: [
      mod('boomerang'),
      when('fire', hook('syn.lasso', { reach: 120, width: 20, pull: 230, dmg: 0.25, slow: 1.5, color: '#ff6a9a' }), { cooldown: 0.35 }),
    ],
    style: { color: '#ff6a9a', trail: 'wisps', glow: 2 },
    hook: DEBUT,
  },
  {
    id: 'neon-sign',
    name: 'Neon Sign',
    requires: ['neon-tube', 'glowworm-vial'],
    effects: [
      mod('pierce'),
      stat('luck', { add: 1 }),
      when('kill', hook('syn.burst', { radius: 22, dmg: 0.5, look: '#7affc8' }), { cooldown: 0.2 }),
    ],
    style: { color: '#7affc8', trail: 'sparks', glow: 6 },
    hook: DEBUT,
  },
  {
    id: 'refraction',
    name: 'Refraction',
    requires: ['neon-tube', { tag: 'glimmer', count: 3 }],
    effects: [
      mod('split'),
      mod('spread'),
      when('kill', hook('syn.ring', { n: 5, speed: 150, dmg: 0.4, style: 'ice', life: 0.8 }), { cooldown: 0.25 }),
    ],
    style: { color: '#c8a0ff', shape: 'shard', trail: 'sparks', glow: 3 },
    hook: DEBUT,
  },

  // ── Boomerang ──
  {
    id: 'kite-line',
    name: 'Kite Line',
    requires: ['rusty-boomerang', 'kite-string'],
    effects: [stat('range', { add: 25 }), when('fire', hook('syn.tether', { dmg: 0.6, width: 5, color: '#bfe8ff' }))],
    style: { color: '#ff7a6a', trail: 'sparks', tether: '#bfe8ff' },
    hook: DEBUT,
  },
  {
    id: 'walk-the-dog',
    name: 'Walk the Dog',
    requires: ['rusty-boomerang', 'yo-yo-string'],
    effects: [mod('spiral'), stat('damage', { add: 0.5 })],
    style: { color: '#ffd08a', shape: 'blade', trail: 'dust', glow: 1 },
    hook: DEBUT,
  },
  {
    id: 'funny-bone',
    name: 'Funny Bone',
    requires: ['rusty-boomerang', { tag: 'ossuary', count: 2 }],
    effects: [
      mod('knockback'),
      mod('fear'),
      when('kill', hook('syn.burst', { radius: 44, status: 'fear', time: 2.5, look: 'ink' }), { chance: 0.3, cooldown: 1 }),
    ],
    style: { color: '#f3ecd8', shape: 'blade', trail: 'dust' },
    hook: DEBUT,
  },

  // ── Melee ──
  {
    id: 'batter-up',
    name: 'Batter Up',
    requires: ['broken-oar', 'rubber-ball'],
    effects: [mod('knockback'), when('fire', hook('syn.reflect', { mode: 'cone', radius: 36, cone: 1.2, speed: 210, dmg: 1 }))],
    style: { color: '#ffe8a0', shape: 'crescent', trail: 'dust', glow: 1 },
    hook: DEBUT,
  },
  {
    id: 'merry-go-round',
    name: 'Merry-Go-Round',
    requires: ['broken-oar', 'carousel-horse'],
    effects: [
      mod('sideShots'),
      mod('backShot'),
      when('fire', hook('syn.gust', { radius: 36, push: 200, dmg: 0.3, look: 'charm' }), { cooldown: 0.6 }),
    ],
    style: { color: '#f4d0ff', shape: 'crescent', trail: 'wisps' },
    hook: DEBUT,
  },
  {
    id: 'rowing-stroke',
    name: 'Rowing Stroke',
    requires: ['broken-oar', { tag: 'water', count: 2 }],
    effects: [
      mod('puddle'),
      stat('moveSpeed', { add: 8 }),
      when('fire', hook('syn.waves', { at: 'player', count: 1, radius: 52, speed: 160, dmg: 0.5, band: 6, look: 'splash' }), { cooldown: 0.5 }),
    ],
    style: { color: '#6fc0f0', shape: 'crescent', trail: 'drops' },
    hook: DEBUT,
  },

  // ── Orbiting blades ──
  {
    id: 'orrery',
    name: 'Orrery',
    requires: ['tin-pinwheel', 'tiny-moon'],
    effects: [{ type: 'carrier', carrier: 'orbit' }, mod('orbitPlayer'), stat('range', { add: 20 })],
    style: { color: '#b8b8ff', trail: 'wisps', glow: 3 },
    hook: DEBUT,
  },
  {
    id: 'bell-tower',
    name: 'Bell Tower',
    requires: ['grave-bell', 'bone-jacks'],
    effects: [
      stat('damage', { add: 0.5 }),
      when('use', [
        hook('syn.ring', { at: 'player', n: 12, speed: 150, dmg: 0.8, style: 'dust', life: 1.4, look: 'ink', sfx: 'yard_bell' }),
        hook('syn.burst', { at: 'player', radius: 90, status: 'fear', time: 3 }),
      ]),
    ],
    style: { color: '#d8b070', shape: 'spiky', trail: 'dust' },
    hook: DEBUT,
  },
];

export default synergies;
