/**
 * Player settings. Phase 1 keeps them in memory only; Phase 4 persists them inside the
 * versioned `stormdrain.meta` save envelope (see DECISIONS.md).
 */

export interface Settings {
  /** Free 360° aim on the shoot stick instead of 4-way snapping. */
  aim360: boolean;
  /** On-screen button size multiplier. */
  buttonScale: number;
  /** Screen shake multiplier (0 = off). */
  shake: number;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
}

export const BUTTON_SCALES = [0.75, 1, 1.25, 1.5] as const;
export const SHAKE_LEVELS = [1, 0.5, 0] as const;

export function defaultSettings(): Settings {
  return {
    aim360: false,
    buttonScale: 1,
    shake: 1,
    masterVolume: 0.8,
    musicVolume: 0.7,
    sfxVolume: 0.9,
  };
}

/** Tiny observable wrapper so systems can react to changes (aim mode, button layout, volumes). */
export class SettingsStore {
  private current: Settings;
  private readonly listeners: ((s: Readonly<Settings>) => void)[] = [];

  constructor(initial: Settings = defaultSettings()) {
    this.current = { ...initial };
  }

  get value(): Readonly<Settings> {
    return this.current;
  }

  update(patch: Partial<Settings>): void {
    this.current = { ...this.current, ...patch };
    for (const l of this.listeners) l(this.current);
  }

  subscribe(fn: (s: Readonly<Settings>) => void): void {
    this.listeners.push(fn);
    fn(this.current);
  }
}

/** Next value in a cycle list (wraps). */
export function cycle<T>(list: readonly T[], current: T): T {
  const i = list.indexOf(current);
  return list[(i + 1) % list.length] as T;
}
