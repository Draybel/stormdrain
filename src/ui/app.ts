/** Shared services handed to every scene (built once in main.ts). */

import type { AudioOut } from '../audio/engine';
import type { Display } from '../engine/display';
import type { Input } from '../engine/input';
import type { GameSave } from '../meta/save';
import type { SettingsStore } from '../meta/settings';
import type { ParticleSystem } from '../render/particles';
import type { ToastLayer } from '../render/toasts';
import type { ScreenShake } from '../render/shake';
import type { SceneManager } from './scene';

/** Scene navigation, implemented in main.ts so scenes never import each other. */
export interface Nav {
  title(): void;
  /** A real run (floor 1). A saved run is abandoned (it counts as quit). */
  newRun(): void;
  /** Resumes the saved run (title → Continue). False (with a notice) when it can't be continued. */
  continueRun(): boolean;
  /** The training yard (debug menu). */
  yard(): void;
  /** The expanded floor map over the run (tap the minimap / Tab). */
  map(): void;
  settings(): void;
  pause(): void;
  resume(): void;
  /** Opens the hidden debug menu over the run (or closes it when it is on top). */
  debug(): void;
}

export interface App {
  readonly display: Display;
  readonly input: Input;
  readonly scenes: SceneManager;
  readonly audio: AudioOut;
  readonly settings: SettingsStore;
  /** One shared particle pool (cap 1500), cleared on scene changes. */
  readonly particles: ParticleSystem;
  readonly shake: ScreenShake;
  readonly nav: Nav;
  /** Saves: meta progress, the run save, achievements, the meta tracker (src/meta/save.ts). */
  readonly save: GameSave;
  /** Achievement / notice toasts, drawn over every scene. */
  readonly toasts: ToastLayer;
}
