/**
 * Chapter 4 (main) — The Mushroom Hollow (floors 7-8): spores, glowcaps, beetles.
 *   Puffcap          hop                          ring of slow spores on every landing; bursts into spores
 *   Glowcap          burrow through the mycelium  ring of glowing spores on surfacing, aimed pair up top
 *   Mossback Beetle  aimed charge (bonks walls)   the moss on its back sprays out when it bonks
 *   Morelob          keeps its distance            lobs sticky spore clumps that leave stinging puddles
 * Tuned for the middle of a run (about twice the Gutterways' HP). Units: ARCHITECTURE §3 (px, px/s, s;
 * contact / shot damage in half hearts).
 */

import type { EnemyDef } from '../../sim/types';
import { GLOWCAP_SPRITE, MORELOB_SPRITE, MOSSBACK_BEETLE_SPRITE, PUFFCAP_SPRITE } from '../sprites/enemiesBMushroom';

const CH = ['mushroom_hollow'] as const;

const enemies: EnemyDef[] = [
  {
    id: 'puffcap',
    name: 'Puffcap',
    hp: 18,
    speed: 0,
    radius: 5,
    contact: 1,
    move: { kind: 'hop', params: { rest: 0.6, crouch: 0.3, air: 0.45, dist: 40, height: 12, aim: 0.7 } },
    attacks: [
      {
        kind: 'ringN',
        cooldown: 0.1,
        params: { on: 1, windup: 0, count: 6, speed: 62, accel: -30, size: 3, life: 3, spin: 30 },
      },
    ],
    onDeath: [{ kind: 'ringN', params: { count: 5, speed: 50 } }],
    sprite: PUFFCAP_SPRITE,
    chapters: CH,
    weight: 10,
    championable: true,
    shot: 'muck',
    goo: ['#d8c49a', '#e8dcb0', '#a58c62', '#b8a070'],
    bestiary: 'A puffball on springy feet. Every landing breathes out slow spores, and popping it lets out the rest.',
  },
  {
    id: 'glowcap',
    name: 'Glowcap',
    hp: 26,
    speed: 44,
    radius: 6,
    contact: 1,
    mass: 1.2,
    move: { kind: 'burrow', params: { under: 1.3, above: 2.2, near: 28, rise: 0.6, dig: 0.35, tunnel: 1.2 } },
    attacks: [
      { kind: 'ringN', cooldown: 0.5, params: { on: 2, windup: 0.15, count: 8, speed: 75, aim: 1 } },
      { kind: 'aimedShot', cooldown: 1.4, params: { windup: 0.45, count: 2, spread: 12, speed: 100, range: 170, first: 0.8 } },
    ],
    sprite: GLOWCAP_SPRITE,
    chapters: CH,
    weight: 8,
    championable: true,
    shot: 'water',
    goo: ['#3fc7b8', '#b8fff2', '#e8dcc0', '#23877f'],
    bestiary: 'Its glow runs through the roots under the floor. Where the ground starts to shine, it is about to pop up.',
  },
  {
    id: 'mossback-beetle',
    name: 'Mossback Beetle',
    hp: 34,
    speed: 34,
    radius: 7,
    contact: 1,
    mass: 2.2,
    move: { kind: 'dash', params: { axis: 0, windup: 0.55, dashSpeed: 210, maxTime: 1.3, stun: 0.9, rest: 1.2, walk: 0.8 } },
    attacks: [{ kind: 'spreadFan', cooldown: 0.2, params: { on: 4, windup: 0, count: 5, spread: 80, speed: 90 } }],
    sprite: MOSSBACK_BEETLE_SPRITE,
    chapters: CH,
    weight: 7,
    championable: true,
    shot: 'muck',
    goo: ['#4f7a3a', '#8fbf5a', '#4a3656', '#e0cc90'],
    bestiary: 'Charges horn-first at anything that moves. When it hits a wall, the moss on its back sprays everywhere.',
  },
  {
    id: 'morelob',
    name: 'Morelob',
    hp: 24,
    speed: 30,
    radius: 6,
    contact: 1,
    move: { kind: 'keepDistance', params: { min: 52, max: 100, strafe: 0.55, flip: 1.8 } },
    attacks: [
      {
        kind: 'lob',
        cooldown: 2.4,
        params: { windup: 0.5, range: 190, count: 2, air: 1, height: 30, scatter: 14, splash: 10, creep: 1 },
      },
    ],
    sprite: MORELOB_SPRITE,
    chapters: CH,
    weight: 7,
    championable: true,
    shot: 'muck',
    goo: ['#9a6a3a', '#efe3c4', '#b8e070', '#5e3a1e'],
    bestiary: 'A wrinkly morel that keeps a polite distance and lobs sticky spore clumps. The puddles sting.',
  },
];

export default enemies;
