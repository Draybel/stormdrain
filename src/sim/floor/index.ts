/**
 * Floor generation public API (see docs/floorgen.md).
 * Pure/headless: layouts, template picking and minimap knowledge — no rendering.
 */

export * from './types';
export {
  FLOORGEN_VERSION,
  FLOOR_W,
  FLOOR_H,
  START_GX,
  START_GY,
  FINAL_ROUTE_FLOOR,
  UNDERTOW_FLOOR,
  MAX_FLOOR,
  TREASURE_LOCK_FLOOR,
  SHOP_LOCK_FLOOR,
  MINIBOSS_MIN_FLOOR,
  lockedOnFloor,
  baseRoomCount,
  curseChance,
  chapterOfFloor,
  isFinalFloor,
  finalBossFor,
  templateRng,
  generateFloor,
  roomAt,
  neighborRoom,
  regularDoorCount,
  openNook,
  layoutBounds,
} from './generate';
export {
  TEMPLATE_COLS,
  TEMPLATE_ROWS,
  DOOR_FRONTS,
  TEMPLATE_CHARS,
  BLOCKING_CHARS,
  HAZARD_CHARS,
  MARKER_CHARS,
  validateTemplate,
  validateTemplates,
  fitsChapter,
  templateChar,
  templateGrid,
  targetDifficulty,
  pickTemplates,
} from './templates';
export * from './minimap';
export { floorToAscii } from './ascii';
export { ROOM_TEMPLATES } from './library';
