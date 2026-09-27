/**
 * Floor objects of the current room placed by the floor run (sim/run) and drawn by the renderer
 * (`world.props`): the Rain Barrel Arena's pressure plate, the hidden-route drain grate, the whirlpool
 * and the skylight that appear after a final boss, and the shopkeeper / broker perched on the top wall.
 * Pure data: the run owns the rules (sim/run/special.ts).
 */

export class FloorThing {
  active = false;
  x = 0;
  y = 0;
  /** Seconds since it appeared / last changed (animation). */
  t = 0;
  /** Plate: 0 up, 1 pressed. Grate: 0 cracked (bomb it), 1 open. */
  state = 0;
  /** The player has been off it since it appeared (stepping on it only counts after that). */
  armed = false;

  place(x: number, y: number, state = 0): void {
    this.active = true;
    this.x = x;
    this.y = y;
    this.t = 0;
    this.state = state;
    this.armed = false;
  }

  reset(): void {
    this.active = false;
    this.t = 0;
    this.state = 0;
    this.armed = false;
  }
}

/** Wall NPCs. */
export const NPC_NONE = 0;
export const NPC_MAGPIE = 1;
export const NPC_BROKER = 2;

export class RoomProps {
  readonly plate = new FloorThing();
  readonly grate = new FloorThing();
  readonly whirlpool = new FloorThing();
  readonly skylight = new FloorThing();
  /** The NPC perched on the top wall (NPC_*), its x (room px) and its reaction. */
  npc = NPC_NONE;
  npcX = 0;
  /** 0 idle, 1 pleased (a sale), 2 shaking its head (can't afford); seconds since it changed. */
  npcMood = 0;
  npcT = 9;

  reset(): void {
    this.plate.reset();
    this.grate.reset();
    this.whirlpool.reset();
    this.skylight.reset();
    this.npc = NPC_NONE;
    this.npcX = 0;
    this.npcMood = 0;
    this.npcT = 9;
  }

  update(dt: number): void {
    this.plate.t += dt;
    this.grate.t += dt;
    this.whirlpool.t += dt;
    this.skylight.t += dt;
    this.npcT += dt;
    if (this.npcMood !== 0 && this.npcT > 1.2) this.npcMood = 0;
  }
}
