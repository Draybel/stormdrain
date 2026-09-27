/**
 * One item per shot modifier (ARCHITECTURE §4.4), each a round "token" icon in the modifier's colour
 * with a glyph. Duplicates stack (§4.5). The most showy ones are tagged 'starter-special' so the
 * training yard offers them next to the other special passives.
 */

import type { ItemDef, ItemQuality, ModId } from '../../sim/types';
import { modToken } from '../sprites/attack';

interface ModItem {
  id: string;
  name: string;
  desc: string;
  mod: ModId;
  color: string;
  quality: ItemQuality;
  glyph: readonly string[];
  special?: boolean;
}

const LIST: readonly ModItem[] = [
  { id: 'twin-straws', name: 'Twin Straws', desc: 'ONE MORE SHOT PER VOLLEY', mod: 'extraShots', color: '#e8c060', quality: 3, glyph: ['..#..', '..#..', '#####', '..#..', '..#..'] },
  { id: 'acorn-buckshot', name: 'Acorn Buckshot', desc: 'SPRAYS A FAN OF SMALL PELLETS', mod: 'spread', color: '#a86a3a', quality: 2, glyph: ['#.#.#', '.###.', '..#..', '.....', '.....'] },
  { id: 'back-pocket-sling', name: 'Back-Pocket Sling', desc: 'A SHOT FLIES OUT BEHIND YOU TOO', mod: 'backShot', color: '#6a8a5a', quality: 1, glyph: ['..#..', '.#...', '#####', '.#...', '..#..'] },
  { id: 'crab-claws', name: 'Crab Claws', desc: 'SHOTS FLY OUT TO BOTH SIDES', mod: 'sideShots', color: '#d05a4a', quality: 2, glyph: ['.....', '.#.#.', '#####', '.#.#.', '.....'] },
  { id: 'carousel-horse', name: 'Carousel Horse', desc: 'SHOTS CIRCLE YOU, THEN LAUNCH', mod: 'circleFirst', color: '#c9a0ff', quality: 2, glyph: ['.###.', '#...#', '#.#.#', '#...#', '.###.'] },
  { id: 'wobbly-spectacles', name: 'Wobbly Spectacles', desc: 'WILD AIM · HARDER HITS', mod: 'inaccuracy', color: '#8a94b0', quality: 1, glyph: ['.###.', '#...#', '..##.', '.....', '..#..'] },
  { id: 'compass-needle', name: 'Compass Needle', desc: 'SHOTS SEEK OUT ENEMIES', mod: 'homing', color: '#b07aff', quality: 3, glyph: ['..#..', '.#.#.', '##.##', '.#.#.', '..#..'], special: true },
  { id: 'wiggle-worm', name: 'Wiggle Worm', desc: 'SHOTS SNAKE BACK AND FORTH', mod: 'wavy', color: '#5fe0d0', quality: 1, glyph: ['.....', '.#...', '#.#.#', '...#.', '.....'] },
  { id: 'snail-shell', name: 'Snail Shell', desc: 'SHOTS CORKSCREW AS THEY FLY', mod: 'spiral', color: '#ff7ad9', quality: 2, glyph: ['####.', '#..#.', '#.##.', '#....', '#####'], special: true },
  { id: 'tiny-moon', name: 'Tiny Moon', desc: 'SHOTS ORBIT AROUND YOU', mod: 'orbitPlayer', color: '#9f9fff', quality: 2, glyph: ['....#', '.##.#', '####.', '#.##.', '#....'], special: true },
  { id: 'yo-yo-string', name: 'Yo-Yo String', desc: 'SHOTS COME BACK TO YOU', mod: 'boomerang', color: '#d0d8e8', quality: 2, glyph: ['##...', '#.#..', '..#..', '...##', '.....'] },
  { id: 'rising-dough', name: 'Rising Dough', desc: 'SHOTS GROW AS THEY FLY', mod: 'grow', color: '#ffb060', quality: 2, glyph: ['..#..', '.###.', '#.#.#', '..#..', '..#..'] },
  { id: 'magnifying-lens', name: 'Magnifying Lens', desc: 'HUGE UP CLOSE · SHRINKS AWAY', mod: 'shrink', color: '#8fe8ff', quality: 2, glyph: ['#####', '#...#', '#.#.#', '#...#', '#####'] },
  { id: 'rocket-sock', name: 'Rocket Sock', desc: 'SHOTS SPEED UP AS THEY FLY', mod: 'accelerate', color: '#ff6040', quality: 1, glyph: ['#.#..', '.#.#.', '..#.#', '.#.#.', '#.#..'] },
  { id: 'molasses-jar', name: 'Molasses Jar', desc: 'SHOTS SLOW DOWN AND LINGER', mod: 'decelerate', color: '#7a5a3a', quality: 1, glyph: ['.....', '##.##', '##.##', '##.##', '.....'] },
  { id: 'rubber-ball', name: 'Rubber Ball', desc: 'SHOTS RICOCHET OFF WALLS', mod: 'bounce', color: '#9be35a', quality: 2, glyph: ['#...#', '#...#', '.#.#.', '.#.#.', '..#..'], special: true },
  { id: 'ghost-chalk', name: 'Ghost Chalk', desc: 'SHOTS PASS THROUGH ROCKS', mod: 'phase', color: '#d8e8ff', quality: 1, glyph: ['.###.', '#.#.#', '#####', '#####', '#.#.#'] },
  { id: 'knitting-needle', name: 'Knitting Needle', desc: 'SHOTS PIERCE THROUGH ENEMIES', mod: 'pierce', color: '#c8d0e0', quality: 2, glyph: ['..#..', '...#.', '#####', '...#.', '..#..'], special: true },
  { id: 'cracked-marble', name: 'Cracked Marble', desc: 'SHOTS SPLIT APART ON HIT', mod: 'split', color: '#7fe8ff', quality: 3, glyph: ['#...#', '.#.#.', '..#..', '..#..', '..#..'], special: true },
  { id: 'copper-wire', name: 'Copper Wire', desc: 'HITS ARC LIGHTNING TO OTHERS', mod: 'chain', color: '#e8a040', quality: 3, glyph: ['..##.', '.##..', '####.', '..##.', '.##..'], special: true },
  { id: 'party-popper', name: 'Party Popper', desc: 'SHOTS EXPLODE · NEVER ON YOU', mod: 'explode', color: '#ff7a3a', quality: 3, glyph: ['#.#.#', '.###.', '#####', '.###.', '#.#.#'], special: true },
  { id: 'leaky-bucket', name: 'Leaky Bucket', desc: 'SHOTS LEAVE STINGING PUDDLES', mod: 'puddle', color: '#5aa8e8', quality: 2, glyph: ['..#..', '.###.', '#####', '#####', '.###.'] },
  { id: 'toadstool-cap', name: 'Toadstool Cap', desc: 'POISONS WHAT IT HITS', mod: 'poison', color: '#7ee06a', quality: 2, glyph: ['.###.', '#.#.#', '#####', '.###.', '.#.#.'], special: true },
  { id: 'matchbook', name: 'Matchbook', desc: 'SETS ENEMIES ON FIRE', mod: 'burn', color: '#ff8a30', quality: 2, glyph: ['..#..', '.##..', '.###.', '#####', '.###.'] },
  { id: 'ice-cube-tray', name: 'Ice Cube Tray', desc: 'MAY FREEZE ENEMIES SOLID', mod: 'freeze', color: '#bff0ff', quality: 3, glyph: ['..#..', '#.#.#', '.###.', '#.#.#', '..#..'] },
  { id: 'jam-jar', name: 'Jam Jar', desc: 'STICKY SHOTS SLOW ENEMIES', mod: 'slow', color: '#b04a6a', quality: 1, glyph: ['#####', '.###.', '..#..', '.###.', '#####'] },
  { id: 'paper-valentine', name: 'Paper Valentine', desc: 'MAY CHARM ENEMIES TO YOUR SIDE', mod: 'charm', color: '#ff8ad0', quality: 3, glyph: ['.#.#.', '#####', '#####', '.###.', '..#..'] },
  { id: 'scary-mask', name: 'Scary Mask', desc: 'MAY SEND ENEMIES FLEEING', mod: 'fear', color: '#9a6ad8', quality: 2, glyph: ['..#..', '..#..', '..#..', '.....', '..#..'] },
  { id: 'boxing-glove', name: 'Boxing Glove', desc: 'SHOTS SHOVE MUCH HARDER', mod: 'knockback', color: '#c85040', quality: 1, glyph: ['###..', '####.', '#####', '####.', '###..'] },
];

const items: ItemDef[] = LIST.map((m) => ({
  id: m.id,
  name: m.name,
  desc: m.desc,
  kind: 'passive',
  quality: m.quality,
  pools: ['treasure'],
  tags: m.special ? ['modifier', 'starter-special'] : ['modifier'],
  effects: [{ type: 'mod', mod: m.mod }],
  sprite: modToken(m.id, m.color, m.glyph),
}));

export default items;
