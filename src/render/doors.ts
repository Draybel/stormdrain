/**
 * Doors on the four wall centres. Floor runs draw each slot of `world.doors` in its kind's frame
 * (content/sprites/doors.ts): hidden secret walls stay plain wall (with a faint crack when hinted),
 * locked doors show a padlocked leaf (fading out as the key turns), blasted secret walls fade in as a
 * rubble hole, and every open door gets iron bars while a wave lives (`shut`, the arena's 0 → 1).
 * The training yard (doors disabled) shows four plain doors. Sprites are 24×16, authored for the top
 * wall and rotated (cached) for the others.
 */

import { DOOR_NORMAL, DOOR_SPRITES, SECRET_HINT_SPRITE } from '../content/sprites/doors';
import { ROOM_COLS, ROOM_ROWS, TILE } from '../sim/constants';
import { DK, DS, type RoomDoors } from '../sim/doors';
import { ROOM_OUTER_X, ROOM_OUTER_Y, ROOM_X, ROOM_Y } from './layout';
import { getRotated } from './sprites';
import type { Warmup } from './warmup';

const BAR_FRAMES = 5;
const LOCKED_FRAME = 6;
const MID_X = Math.floor(ROOM_COLS / 2) * TILE;
const MID_Y = Math.floor(ROOM_ROWS / 2) * TILE;
/** Top-left of each side's 24×16 (or rotated 16×24) door sprite, before shake. */
const DX = [ROOM_X + MID_X - 4, ROOM_X + ROOM_COLS * TILE, ROOM_X + MID_X - 4, ROOM_OUTER_X];
const DY = [ROOM_OUTER_Y, ROOM_Y + MID_Y - 4, ROOM_Y + ROOM_ROWS * TILE, ROOM_Y + MID_Y - 4];
/** The 16×16 hint crack sits on the wall slot itself. */
const HX = [ROOM_X + MID_X, ROOM_X + ROOM_COLS * TILE, ROOM_X + MID_X, ROOM_OUTER_X];
const HY = [ROOM_OUTER_Y, ROOM_Y + MID_Y, ROOM_Y + ROOM_ROWS * TILE, ROOM_Y + MID_Y];

/** Warm the rotated frames. */
export function prepareDoors(q?: Warmup): void {
  // With a warm-up queue (polish batch 2): one job per door kind, spread over idle frames.
  for (const s of DOOR_SPRITES) {
    if (!s) continue;
    const job = (): void => {
      for (let f = 0; f < s.frames.length; f++) for (let t = 0; t < 4; t++) getRotated(s, f, t);
    };
    if (q) q.add(`door.${s.id}`, job);
    else job();
  }
  const hint = (): void => {
    for (let t = 0; t < 4; t++) getRotated(SECRET_HINT_SPRITE, 0, t);
  };
  if (q) q.add('door.hint', hint);
  else hint();
}

/**
 * @param shut arena door animation (0 open … 1 barred)
 * @param time presentation clock (hint flicker)
 */
export function drawDoors(ctx: CanvasRenderingContext2D, doors: RoomDoors, shut: number, sx: number, sy: number, time = 0): void {
  const barFrame = Math.max(0, Math.min(BAR_FRAMES, Math.round(shut * BAR_FRAMES)));
  if (!doors.enabled) {
    for (let side = 0; side < 4; side++) ctx.drawImage(getRotated(DOOR_NORMAL, barFrame, side), DX[side]! + sx, DY[side]! + sy);
    return;
  }
  for (let side = 0; side < 4; side++) {
    const d = doors.slots[side]!;
    if (d.kind === DK.None) continue;
    if (d.state === DS.Hidden) {
      if (d.hint) {
        // A faint crack that breathes a little (deep secret walls are fainter still).
        ctx.globalAlpha = (d.deep ? 0.35 : 0.6) + 0.15 * Math.sin(time * 1.7 + side);
        ctx.drawImage(getRotated(SECRET_HINT_SPRITE, 0, side), HX[side]! + sx, HY[side]! + sy);
        ctx.globalAlpha = 1;
      }
      continue;
    }
    const sprite = DOOR_SPRITES[d.kind] ?? DOOR_NORMAL;
    const x = DX[side]! + sx;
    const y = DY[side]! + sy;
    if (d.state === DS.Locked) {
      ctx.drawImage(getRotated(sprite, LOCKED_FRAME, side), x, y);
      continue;
    }
    if (d.anim < 1 && d.kind === DK.Secret) {
      // Freshly blasted: the hole fades in.
      ctx.globalAlpha = d.anim;
      ctx.drawImage(getRotated(sprite, barFrame, side), x, y);
      ctx.globalAlpha = 1;
      continue;
    }
    ctx.drawImage(getRotated(sprite, barFrame, side), x, y);
    if (d.anim < 1) {
      // Just unlocked: the padlocked leaf fades away.
      ctx.globalAlpha = 1 - d.anim;
      ctx.drawImage(getRotated(sprite, LOCKED_FRAME, side), x, y);
      ctx.globalAlpha = 1;
    }
  }
}
