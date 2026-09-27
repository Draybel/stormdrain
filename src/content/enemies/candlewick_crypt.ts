/**
 * Chapter 2 (alt track) — The Candlewick Crypt: wax, candles and moths. Four enemies:
 *   Dusk Moth        orbitPlayer (circles your glow, flying)   bursts of wing dust
 *   Tallow Trudger   chase (slow, straight)                    hot wax trail + a flicked spark
 *   Grim Candelabra  turret                                    three-flame fan + a turning ring
 *   Waxwraith        float (flying drift)                      drops hot wax that pools
 * (The Dust Bunny also haunts here — see drowned_nursery.ts.) Tuned for floors 3-4: HP 14-36.
 */

import type { EnemyDef } from '../../sim/types';
import {
  DUSK_MOTH_SPRITE,
  GRIM_CANDELABRA_SPRITE,
  TALLOW_TRUDGER_SPRITE,
  WAXWRAITH_SPRITE,
} from '../sprites/enemiesACrypt';

const CH = ['candlewick_crypt'] as const;

const enemies: EnemyDef[] = [
  {
    id: 'dusk-moth',
    name: 'Dusk Moth',
    hp: 14,
    speed: 62,
    radius: 5,
    contact: 1,
    flying: true,
    move: { kind: 'orbitPlayer', params: { radius: 46, spin: 1.5, dir: 0 } },
    attacks: [{ kind: 'burst', cooldown: 2.6, params: { count: 3, interval: 0.18, jitter: 6, speed: 92, windup: 0.4 } }],
    sprite: DUSK_MOTH_SPRITE,
    chapters: CH,
    weight: 8,
    championable: true,
    shot: 'dust',
    goo: ['#8a6aa8', '#f0e0c0', '#f0a040', '#5a4278'],
    bestiary: 'Moths cannot resist a light, and your marbles glow. It circles you like a lamp, flicking dust.',
  },
  {
    id: 'tallow-trudger',
    name: 'Tallow Trudger',
    hp: 32,
    speed: 26,
    radius: 6,
    contact: 1,
    mass: 1.5,
    move: { kind: 'chase' },
    attacks: [
      { kind: 'leaveTrail', cooldown: 0.4, params: { radius: 6, life: 3.5, dmg: 1, moving: 1 } },
      { kind: 'aimedShot', cooldown: 2.4, params: { speed: 85, size: 3, windup: 0.5, range: 150 } },
    ],
    sprite: TALLOW_TRUDGER_SPRITE,
    chapters: CH,
    weight: 7,
    championable: true,
    shot: 'ember',
    goo: ['#f0e4c8', '#c8b090', '#ffcf57', '#e8862e'],
    bestiary: 'A candle stub that got tired of standing still. It trudges after you, dripping hot wax.',
  },
  {
    id: 'grim-candelabra',
    name: 'Grim Candelabra',
    hp: 36,
    speed: 0,
    radius: 7,
    contact: 1,
    mass: 99,
    move: { kind: 'turret' },
    attacks: [
      { kind: 'spreadFan', cooldown: 1.9, params: { count: 3, spread: 36, speed: 95, windup: 0.5, range: 200 } },
      { kind: 'ringN', cooldown: 4.4, params: { count: 6, spin: 30, speed: 62, windup: 0.65 } },
    ],
    sprite: GRIM_CANDELABRA_SPRITE,
    chapters: CH,
    weight: 5,
    championable: true,
    shot: 'ember',
    goo: ['#c8a04a', '#f0d890', '#ffcf57', '#e8e0d0'],
    bestiary: 'Three candles on a crooked stand, all of them watching you. It flings sparks from every flame.',
  },
  {
    id: 'waxwraith',
    name: 'Waxwraith',
    hp: 24,
    speed: 30,
    radius: 6,
    contact: 1,
    flying: true,
    move: { kind: 'float', params: { wobble: 0.8, freq: 0.4, drift: 1 } },
    attacks: [
      {
        kind: 'lob',
        cooldown: 2.5,
        params: { count: 1, creep: 1, splash: 12, scatter: 6, air: 1, height: 32, windup: 0.5, range: 170 },
      },
    ],
    sprite: WAXWRAITH_SPRITE,
    chapters: CH,
    weight: 7,
    championable: true,
    shot: 'ember',
    goo: ['#e8dcc8', '#b8a484', '#ffb040', '#fff8e8'],
    bestiary: 'Candle wax that forgot how to be a candle. It drifts overhead and drips hot wax where you stand.',
  },
];

export default enemies;
