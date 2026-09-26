/**
 * Screen layout in game pixels (ARCHITECTURE §2). The back-buffer is 384×192; the room (240×144
 * including 16 px walls) is centred horizontally and flush with the bottom, leaving a 48 px HUD
 * band on top and 72 px side margins for HUD + touch buttons.
 */

import { GAME_H, GAME_W } from '../engine/screen';
import { ROOM_H, ROOM_W, TILE } from '../sim/constants';

export { GAME_H, GAME_W };

export const WALL = TILE;
export const ROOM_OUTER_W = ROOM_W + WALL * 2; // 240
export const ROOM_OUTER_H = ROOM_H + WALL * 2; // 144
export const ROOM_OUTER_X = (GAME_W - ROOM_OUTER_W) / 2; // 72
export const ROOM_OUTER_Y = GAME_H - ROOM_OUTER_H; // 48
/** Screen position of room-local (0, 0) — the top-left of the interior floor. */
export const ROOM_X = ROOM_OUTER_X + WALL; // 88
export const ROOM_Y = ROOM_OUTER_Y + WALL; // 64

export const HUD_BAND_H = ROOM_OUTER_Y;
export const SIDE_MARGIN = ROOM_OUTER_X;
