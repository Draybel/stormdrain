/**
 * Player settings — the runtime bus (main.ts subscribes: aim mode, shake, volumes, layout). Persisted in the
 * `stormdrain.meta` save (MetaSettings, adapters in metaState.ts); edited by the Settings scene (ui/settingsPanel.ts).
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
  /** Mirror the touch layout: move stick on the right, shoot stick on the left, button columns swapped. */
  leftHanded: boolean;
  /** A small FPS readout in the corner. */
  showFps: boolean;
  /** Cap every full-screen flash (lance, explosions, novas, boss moments) at a low alpha (polish batch 2). */
  reduceFlashing: boolean;
}

export const BUTTON_SCALES = [0.75, 1, 1.25, 1.5] as const;
export const SHAKE_LEVELS = [1, 0.5, 0] as const;
/** The Settings sliders' ranges and steps. */
export const BUTTON_SCALE_MIN = 0.75;
export const BUTTON_SCALE_MAX = 1.5;
export const BUTTON_SCALE_STEP = 0.05;
export const VOLUME_STEP = 0.05;
export const SHAKE_STEP = 0.1;

export function defaultSettings(): Settings {
  return {
    aim360: false,
    buttonScale: 1,
    shake: 1,
    masterVolume: 0.8,
    musicVolume: 0.7,
    sfxVolume: 0.9,
    leftHanded: false,
    showFps: false,
    reduceFlashing: false,
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
