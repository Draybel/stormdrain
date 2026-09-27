/**
 * Thorn Room (cursed) variants for every chapter: richer rewards, prickly to reach.
 * The doors are always joined by a thorn-free path; the loot may not be.
 * Legend (ARCHITECTURE §5): . floor  # rock  $ tinted rock  M metal  O pit  ^ spikes  f fire
 * x crate  u urn  e enemy  E elite  c chest  p pickup  i item pedestal.
 */

import type { RoomTemplate } from '../../sim/floor/types';

const ALL = ['*'] as const;

const rooms: RoomTemplate[] = [
  {
    // A crown of thorns around the prize and two satchels; open at the front and back.
    id: 'special.cursed.thorn_crown',
    chapters: ALL,
    type: 'cursed',
    difficulty: 2,
    grid: [
      '^...........^',
      '..^^^...^^^e.',
      '..^.......^..',
      '....c.i.c....',
      '..^.......^..',
      '.e^^^...^^^..',
      '^...........^',
    ],
  },
  {
    // Briar pockets: each chest is sealed in thorns. The keepsake between them is free... this time.
    id: 'special.cursed.briar_pockets',
    chapters: ALL,
    type: 'cursed',
    difficulty: 3,
    grid: [
      '.............',
      '.e.........e.',
      '...^^^.^^^...',
      '...^c^i^c^...',
      '...^^^.^^^...',
      '.E.........E.',
      '.............',
    ],
  },
];

export default rooms;
