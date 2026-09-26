/**
 * Phase 1 training room (13×7). Uses the room legend from ARCHITECTURE §5 plus two
 * test-room-only markers:  `@` player start,  `D` training dummy.
 * Intentionally NOT in content/rooms/ so floor generation never picks it up.
 */
export const TEST_ROOM: readonly string[] = [
  '##...........',
  '#....#...D...',
  '.............',
  '..@...OO..D..',
  '.......O.....',
  '.....#...D..#',
  '...........##',
];
