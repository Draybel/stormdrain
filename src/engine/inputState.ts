/**
 * InputState — the ONLY way the simulation reads input (ARCHITECTURE §2).
 * DOM-free so the headless sim and tests can build and script it directly.
 * One instance is reused forever; edge-triggered flags are cleared after each sim tick.
 */
export interface InputState {
  /** Analog movement, each axis -1..1, magnitude <= 1. */
  moveX: number;
  moveY: number;
  /** Aim direction: unit vector, or (0, 0) when not aiming. */
  aimX: number;
  aimY: number;
  /** Shoot stick / arrow key held with a direction. */
  fireHeld: boolean;
  /** Edge: fire started since the last tick. */
  firePressed: boolean;
  /** Edge: fire ended since the last tick. */
  fireReleased: boolean;
  /** Edges: action buttons. */
  bomb: boolean;
  active: boolean;
  consumable: boolean;
  pause: boolean;
  map: boolean;
}

export function createInputState(): InputState {
  return {
    moveX: 0,
    moveY: 0,
    aimX: 0,
    aimY: 0,
    fireHeld: false,
    firePressed: false,
    fireReleased: false,
    bomb: false,
    active: false,
    consumable: false,
    pause: false,
    map: false,
  };
}

/** Clears the edge-triggered flags. Called after every sim tick. */
export function clearEdges(s: InputState): void {
  s.firePressed = false;
  s.fireReleased = false;
  s.bomb = false;
  s.active = false;
  s.consumable = false;
  s.pause = false;
  s.map = false;
}

/** Resets everything (continuous values too), e.g. when a scene loses input focus. */
export function resetInput(s: InputState): void {
  s.moveX = 0;
  s.moveY = 0;
  s.aimX = 0;
  s.aimY = 0;
  s.fireHeld = false;
  clearEdges(s);
}

export type InputAction = 'bomb' | 'active' | 'consumable' | 'pause' | 'map';
