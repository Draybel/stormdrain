/**
 * The four room doors, drawn over the pre-rendered walls at the wall centres. `shut` (0 open … 1
 * barred, animated by the sim's Arena) picks the frame: iron bars slide down while enemies live.
 * The door sprite is authored for the top wall and rotated (cached) for the others.
 */

import { DOOR_SPRITE } from '../content/sprites/combat';
import { ROOM_COLS, ROOM_ROWS, TILE } from '../sim/constants';
import { ROOM_OUTER_X, ROOM_OUTER_Y, ROOM_X, ROOM_Y } from './layout';
import { getRotated } from './sprites';

const LAST = DOOR_SPRITE.frames.length - 1;
const MID_X = Math.floor(ROOM_COLS / 2) * TILE;
const MID_Y = Math.floor(ROOM_ROWS / 2) * TILE;

/** Warm the rotated frames. */
export function prepareDoors(): void {
  for (let f = 0; f <= LAST; f++) for (let t = 0; t < 4; t++) getRotated(DOOR_SPRITE, f, t);
}

export function drawDoors(ctx: CanvasRenderingContext2D, shut: number, sx: number, sy: number): void {
  const f = Math.max(0, Math.min(LAST, Math.round(shut * LAST)));
  // Top (as authored), right (1 turn), bottom (2), left (3): the opening always faces the room.
  ctx.drawImage(getRotated(DOOR_SPRITE, f, 0), ROOM_X + MID_X + sx, ROOM_OUTER_Y + sy);
  ctx.drawImage(getRotated(DOOR_SPRITE, f, 1), ROOM_X + ROOM_COLS * TILE + sx, ROOM_Y + MID_Y + sy);
  ctx.drawImage(getRotated(DOOR_SPRITE, f, 2), ROOM_X + MID_X + sx, ROOM_Y + ROOM_ROWS * TILE + sy);
  ctx.drawImage(getRotated(DOOR_SPRITE, f, 3), ROOM_OUTER_X + sx, ROOM_Y + MID_Y + sy);
}
