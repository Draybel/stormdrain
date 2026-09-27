/**
 * Special-room art (original): the NPCs — Magpie the shopkeeper, the Moth Broker, Old Pell the snail
 * trader — the donation jar, the Gumball Gambler, the Rain Barrel Arena's pressure plate, the
 * hidden-route drain grate, the whirlpool to The Undertow, falling debris, and the two boss minions
 * (bubble wards, nest drones). Built with the pixel painter; every actor has the 1 px dark outline.
 */

import type { SpriteDef } from '../../sim/types';
import { OUTLINE } from './palette';
import { Pix, hash2 } from './paint';

const o = OUTLINE;

// ── Magpie, the shopkeeper (perches on the top wall) ────────────────────────

/** 0 idle, 1 blink, 2 pleased (wing up), 3 shaking her head. */
function magpie(frame: number): string[] {
  const p = new Pix(16, 16);
  // Tail.
  p.line(0, 9, 4, 11, 'K').line(1, 10, 4, 12, 'K').set(1, 9, 'b').set(2, 10, 'b');
  // Body, belly, wing.
  p.ellipse(8, 10.5, 4.6, 3.4, 'K');
  p.ellipse(9.5, 11.5, 2.6, 2.1, 'W');
  if (frame === 2) p.ellipse(6, 7, 3.4, 1.8, 'b').set(4, 6, 'B').set(5, 6, 'B');
  else p.ellipse(6.5, 9.8, 3.2, 1.8, 'b').set(5, 9, 'B').set(6, 9, 'B');
  // Head (turned away when shaking it).
  const hx = frame === 3 ? 9 : 11;
  p.disc(hx, 6, 3, 'K');
  if (frame === 3) {
    p.set(6, 6, 'g').set(5, 6, 'g').set(8, 5, 'W');
  } else {
    p.set(14, 6, 'g').set(15, 6, 'g').set(14, 7, 'g');
    if (frame === 1) p.set(12, 5, 'K').set(11, 5, 'W');
    else p.set(12, 5, 'W').set(12, 4, 'W').set(13, 5, 'k');
    // A gold monocle.
    p.set(11, 3, 'y').set(14, 4, 'y').set(14, 5, 'y');
  }
  // A red scarf and the feet.
  p.set(10, 9, 'r').set(11, 9, 'r').set(12, 8, 'r').set(10, 10, 'R');
  p.set(7, 14, 'y').set(8, 14, 'y').set(10, 14, 'y').set(11, 14, 'y');
  return p.outline('o').rows();
}

export const MAGPIE_SPRITE: SpriteDef = {
  id: 'npc.magpie',
  w: 16,
  h: 16,
  palette: { o, K: '#1b1b26', W: '#eef0f5', b: '#2f6f8e', B: '#62b6cf', g: '#3a3a44', k: '#0a0a10', y: '#f2c94c', r: '#c8433a', R: '#e8705a' },
  frames: [magpie(0), magpie(1), magpie(2), magpie(3)],
  anims: { idle: { frames: [0, 0, 0, 1], fps: 2, loop: true }, happy: { frames: [2], fps: 1, loop: true }, no: { frames: [3, 0], fps: 6, loop: true } },
};

// ── The Moth Broker (hangs on the top wall of the Nook) ─────────────────────

function broker(frame: number): string[] {
  const p = new Pix(20, 16);
  const lift = frame === 1 ? 1 : frame === 2 ? -2 : 0;
  // Wings with eye spots.
  p.ellipse(5.5, 7 + lift, 4.4, 4.2, 'w').ellipse(14.5, 7 + lift, 4.4, 4.2, 'w');
  p.ellipse(6.5, 12, 3.2, 2.4, 'v').ellipse(13.5, 12, 3.2, 2.4, 'v');
  p.map((x, y, c) => (c === 'w' && hash2(x, y, 4) > 0.8 ? 'W' : null));
  p.disc(5, 7 + lift, 1.6, 'e').set(5, 7 + lift, 'k').disc(15, 7 + lift, 1.6, 'e').set(15, 7 + lift, 'k');
  // Fuzzy body and head with a tiny top hat.
  p.ellipse(10, 9, 2.4, 5, 'F').ellipse(10, 5, 2.6, 2.2, 'F');
  p.map((x, y, c) => (c === 'F' && (x + y) % 3 === 0 ? 'f' : null));
  p.set(9, 5, 'y').set(11, 5, 'y');
  p.rect(8, 0, 5, 2, 'h').rect(7, 2, 7, 1, 'h').set(9, 1, 'H').set(10, 1, 'H');
  // Feathery antennae.
  p.line(9, 3, 6, 0, 'a').line(11, 3, 14, 0, 'a');
  return p.outline('o').rows();
}

export const MOTH_BROKER_SPRITE: SpriteDef = {
  id: 'npc.mothBroker',
  w: 20,
  h: 16,
  palette: { o, w: '#9a8a70', W: '#c8b894', v: '#6e6250', e: '#d8c070', k: '#1a120a', F: '#d8ccb0', f: '#b8a888', y: '#ffe06a', h: '#26222e', H: '#8a3a5a', a: '#c8b894' },
  frames: [broker(0), broker(1), broker(2)],
  anims: { idle: { frames: [0, 1], fps: 4, loop: true }, happy: { frames: [2, 0], fps: 6, loop: true }, no: { frames: [1], fps: 1, loop: true } },
};

// ── Old Pell, the wandering snail trader ─────────────────────────────────────

function pell(frame: number): string[] {
  const p = new Pix(20, 18);
  // The foot / body.
  p.ellipse(10, 15, 9, 2.4, 'S').rect(15, 8 + (frame === 1 ? 1 : 0), 3, 7, 'S');
  p.map((x, y, c) => (c === 'S' && y >= 16 ? 's' : null));
  // A big spiral shell with a traveller's pack.
  p.disc(8, 10, 5.6, 'A');
  p.map((x, y, c) => {
    if (c !== 'A') return null;
    const a = Math.atan2(y + 0.5 - 10, x + 0.5 - 8);
    const r = Math.hypot(x + 0.5 - 8, y + 0.5 - 10);
    return Math.sin(a + r * 1.3) > 0.55 ? 'B' : r > 4.6 ? 'C' : null;
  });
  p.rect(3, 3, 6, 3, 'P').rect(3, 3, 6, 1, 'Q').set(5, 4, 'y');
  // Eyestalks with spectacles.
  const sway = frame === 1 ? 1 : 0;
  p.line(16, 8, 15 + sway, 3, 'S').line(17, 8, 19, 4 - sway, 'S');
  p.set(15 + sway, 2, 'e').set(19, 3 - sway, 'e').set(15 + sway, 3, 'k').set(19, 4 - sway, 'k');
  p.set(16 + sway, 2, 'g').set(18, 3 - sway, 'g');
  // A sleepy smile.
  p.set(17, 11, 'k').set(18, 11, 'k');
  return p.outline('o').rows();
}

export const OLD_PELL_SPRITE: SpriteDef = {
  id: 'npc.oldPell',
  w: 20,
  h: 18,
  palette: { o, S: '#8aa08a', s: '#5e7460', A: '#c8773a', B: '#8a4a26', C: '#e8a060', P: '#6a4a8a', Q: '#8a6aaa', y: '#f2c94c', e: '#f4f0e0', k: '#141018', g: '#c8d8f0' },
  frames: [pell(0), pell(1)],
  anims: { idle: { frames: [0, 1], fps: 1.5, loop: true } },
};

// ── Donation jar ──────────────────────────────────────────────────────────

function jar(fill: number): string[] {
  const p = new Pix(12, 14);
  p.rect(2, 3, 8, 10, 'g').rect(1, 5, 10, 7, 'g');
  p.rect(3, 1, 6, 2, 'L').rect(3, 1, 6, 1, 'l').set(5, 1, 'k').set(6, 1, 'k');
  // Coins inside (more with every threshold).
  const top = 12 - fill * 3;
  for (let y = top; y <= 12; y++) for (let x = 2; x <= 9; x++) if (hash2(x, y, 3) > 0.25) p.set(x, y, hash2(x, y, 9) > 0.5 ? 'c' : 'C');
  // Glass shine and a label with a heart.
  p.set(2, 5, 'G').set(2, 6, 'G').set(2, 7, 'G');
  p.rect(3, 8, 6, 3, 'w').set(5, 9, 'r').set(6, 9, 'r');
  return p.outline('o').rows();
}

export const DONATION_JAR_SPRITE: SpriteDef = {
  id: 'prop.jar',
  w: 12,
  h: 14,
  palette: { o, g: '#6f9fbf80', G: '#e6f6ff', L: '#8a6a3a', l: '#c8a060', k: '#1a120a', c: '#f2c230', C: '#c8773a', w: '#efe6c8', r: '#e0515a' },
  frames: [jar(0), jar(1), jar(2)],
};

// ── The Gumball Gambler ────────────────────────────────────────────────────

function gambler(frame: number): string[] {
  const p = new Pix(14, 20);
  const broken = frame === 3;
  // Red cast-iron body with a coin slot, a crank and a chute.
  p.rect(2, 10, 10, 8, 'R').rect(2, 10, 10, 1, 'r').rect(1, 17, 12, 2, 'D');
  p.rect(6, 12, 2, 1, 'k').rect(5, 15, 4, 2, 'k').set(6, 16, 'y');
  const crank = frame === 1 ? 0 : frame === 2 ? 2 : 1;
  p.set(12, 12 + crank, 'S').set(13, 12 + crank, 'S').set(13, 11 + crank, 's');
  // The glass globe full of gumballs.
  if (broken) {
    p.ellipse(7, 7, 5, 3, 'g').set(3, 5, 'G').set(10, 4, 'G').set(6, 3, 'G');
    for (const [x, y, c] of [
      [4, 8, 'a'],
      [7, 9, 'b'],
      [9, 8, 'c'],
    ] as const)
      p.set(x, y, c);
  } else {
    p.disc(7, 5.5, 5, 'g');
    for (let y = 2; y < 10; y++) {
      for (let x = 3; x < 12; x++) {
        if (p.get(x, y) !== 'g') continue;
        const h = hash2(x + (frame === 1 ? 1 : frame === 2 ? 2 : 0), y, 5);
        if (h > 0.5) p.set(x, y, h > 0.85 ? 'a' : h > 0.7 ? 'b' : h > 0.6 ? 'c' : 'd');
      }
    }
    p.set(4, 3, 'G').set(5, 2, 'G');
    p.rect(5, 0, 4, 1, 'D');
  }
  return p.outline('o').rows();
}

export const GUMBALL_GAMBLER_SPRITE: SpriteDef = {
  id: 'prop.gambler',
  w: 14,
  h: 20,
  palette: {
    o,
    R: '#c0403a',
    r: '#e8705a',
    D: '#7a2226',
    k: '#1a0e10',
    y: '#f2c230',
    S: '#9aa6c0',
    s: '#e4ebf7',
    g: '#bfe0f080',
    G: '#ffffff',
    a: '#ff6a8a',
    b: '#6ad0ff',
    c: '#ffe06a',
    d: '#8aff9a',
  },
  frames: [gambler(0), gambler(1), gambler(2), gambler(3)],
};

// ── The Rain Barrel Arena's pressure plate ──────────────────────────────────

function plate(pressed: boolean): string[] {
  const p = new Pix(16, 16);
  const y = pressed ? 9 : 8;
  p.ellipse(8, y, 7, 4.5, 'S').ellipse(8, y - (pressed ? 0 : 1), 6, 3.4, 'T');
  if (!pressed) p.rect(2, y, 12, 2, 'U');
  // A raindrop emblem (glowing once pressed).
  const e = pressed ? 'Y' : 'b';
  p.set(8, y - 3, e).set(7, y - 2, e).set(8, y - 2, e).set(9, y - 2, e).set(7, y - 1, e).set(8, y - 1, e).set(9, y - 1, e);
  return p.outline('o').rows();
}

export const PRESSURE_PLATE_SPRITE: SpriteDef = {
  id: 'prop.plate',
  w: 16,
  h: 16,
  palette: { o, S: '#56607c', T: '#7d89a8', U: '#3e455a', b: '#3b78c0', Y: '#9fe0ff' },
  frames: [plate(false), plate(true)],
};

// ── The hidden-route drain grate ─────────────────────────────────────────────

function grate(open: boolean): string[] {
  const p = new Pix(16, 16);
  p.ellipse(8, 8, 7, 6, 'I');
  if (open) {
    p.ellipse(8, 8, 5.5, 4.6, 'v').ellipse(8, 8.5, 3, 2.4, 'w');
    p.map((x, y, c) => (c === 'w' && (x + y) % 3 === 0 ? 'W' : null));
    p.set(3, 6, 'r').set(12, 10, 'r').set(10, 3, 'r');
  } else {
    p.ellipse(8, 8, 5.5, 4.6, 'v');
    for (let x = 3; x <= 13; x += 2) p.line(x, 4, x, 12, 'I');
    // The crack (the hint).
    p.line(4, 5, 7, 8, 'c').line(7, 8, 6, 11, 'c').line(7, 8, 11, 9, 'c');
    p.set(9, 12, 'w');
  }
  return p.outline('o').rows();
}

export const DRAIN_GRATE_SPRITE: SpriteDef = {
  id: 'prop.grate',
  w: 16,
  h: 16,
  palette: { o, I: '#59617d', v: '#05060a', c: '#a8b4d0', w: '#3b78c0', W: '#8fc8f0', r: '#7a4a2a' },
  frames: [grate(false), grate(true)],
};

// ── The whirlpool (after a final boss, to The Undertow) ─────────────────────

function whirl(turn: number): string[] {
  const p = new Pix(24, 24);
  p.map((x, y) => {
    const dx = (x + 0.5 - 12) / 11;
    const dy = (y + 0.5 - 12) / 8;
    const r = Math.sqrt(dx * dx + dy * dy);
    if (r > 1) return null;
    if (r < 0.18) return 'a';
    const s = Math.sin(Math.atan2(dy, dx) * 2 + Math.log(r + 0.05) * 4 - (turn * Math.PI) / 2);
    return s > 0.55 ? (r > 0.7 ? 'e' : 'd') : s > 0 ? 'c' : s > -0.6 ? 'b' : 'a';
  });
  return p.outline('o').rows();
}

export const WHIRLPOOL_SPRITE: SpriteDef = {
  id: 'prop.whirlpool',
  w: 24,
  h: 24,
  palette: { o, a: '#0a1a30', b: '#17365c', c: '#2f6296', d: '#5a95c8', e: '#cfeeff' },
  frames: [whirl(0), whirl(1), whirl(2), whirl(3)],
};

// ── Falling debris ─────────────────────────────────────────────────────────────

export const DEBRIS_SPRITE: SpriteDef = {
  id: 'prop.debris',
  w: 8,
  h: 7,
  palette: { o, s: '#5c6580', S: '#8691ad', d: '#3e455a' },
  frames: [
    ['..ooo...', '.oSSso..', 'oSSsssoo', 'osssssdo', 'osssdddo', '.oddddo.', '..oooo..'],
    ['...oooo.', '.ooSSso.', 'oSSSssso', 'osssssso', '.osssddo', '.odddo..', '..ooo...'],
  ],
};

// ── Boss minions (content/enemies/boss-minions.ts) ───────────────────────────

/** Bubble ward: a shimmering bubble that orbits The Undertow and soaks up shots (10×10). */
export const BUBBLE_WARD_SPRITE: SpriteDef = {
  id: 'enemy.bubbleWard',
  w: 10,
  h: 10,
  palette: { o, b: '#5a95c8', B: '#a8d4f0', w: '#ffffff', c: '#2f6296' },
  frames: [
    ['..oooooo..', '.oBBbbbbo.', 'oBwBbbbbbo', 'oBBbbbbbbo', 'obbbbbbbbo', 'obbbbbbbco', 'obbbbbbcco', 'obbbbbccco', '.obbcccco.', '..oooooo..'],
    ['..oooooo..', '.obbBBbbo.', 'obbBwBbbbo', 'obbbBBbbbo', 'obbbbbbbbo', 'obbbbbbbco', 'obbbbbbcco', 'obbbbbccco', '.obbcccco.', '..oooooo..'],
  ],
  anims: { idle: { frames: [0, 1], fps: 3, loop: true }, move: { frames: [0, 1], fps: 3, loop: true } },
};

/** Nest drone: a paper wasp the Nestmother calls (12×10). */
export const NEST_DRONE_SPRITE: SpriteDef = {
  id: 'enemy.nestDrone',
  w: 12,
  h: 10,
  palette: { o, w: '#e8e4d8', A: '#d8902c', K: '#2a1c14', r: '#e0503a', k: '#140e10' },
  frames: [
    ['...oo..oo...', '..owwooowwo.', '..owwwowwwo.', '...ooAAooo..', '..oAKAKAAro.', '.oAKAKAKArro', '..oAKAKAAo..', '...oooooo...', '....o..o....', '............'],
    ['............', '............', '..ooo..ooo..', '.owwwooowwwo', '..oAKAKAAro.', '.oAKAKAKArro', '..oAKAKAAo..', '...oooooo...', '....o..o....', '............'],
    ['............', '..ooo..ooo..', '.owwwooowwwo', '..ooAAooo...', '.oAKAKAAro..', 'kAKAKAKArro.', '.oAKAKAAo...', '..oooooo....', '...o..o.....', '............'],
  ],
  anims: { idle: { frames: [0, 1], fps: 12, loop: true }, move: { frames: [0, 1], fps: 14, loop: true }, windup: { frames: [2], fps: 1, loop: true } },
};
