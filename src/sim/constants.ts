/** Simulation constants. Units: pixels and seconds (ARCHITECTURE §3). */

export const TICK_HZ = 60;
export const DT = 1 / TICK_HZ;

export const TILE = 16;
export const ROOM_COLS = 13;
export const ROOM_ROWS = 7;
/** Interior floor size in px. Room-local (0,0) is the top-left of the interior floor. */
export const ROOM_W = ROOM_COLS * TILE;
export const ROOM_H = ROOM_ROWS * TILE;

/** Global guardrail caps (ARCHITECTURE §4.5). */
export const CAP_PROJECTILES = 700;
export const CAP_DUMMIES = 16;
export const CAP_PICKUPS = 64;
export const CAP_BOMBS = 16;
export const CAP_PEDESTALS = 8;
/** Enemies alive at once (spawned minions and splits included). */
export const CAP_ENEMIES = 64;
/** Enemy projectiles (ARCHITECTURE §4.5). */
export const CAP_ENEMY_SHOTS = 400;
/** Enemy creep puddles; the oldest is recycled when full. */
export const CAP_CREEP = 48;
/** Expanding ground shockwaves. */
export const CAP_WAVES = 16;
