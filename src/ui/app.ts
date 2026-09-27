/** Shared services handed to every scene (built once in main.ts). */

import type { AudioOut } from '../audio/engine';
import type { Display } from '../engine/display';
import type { Input } from '../engine/input';
import type { GameSave } from '../meta/save';
import type { PwaState } from '../pwa/platform';
import type { SettingsStore } from '../meta/settings';
import type { ParticleSystem } from '../render/particles';
import type { ToastLayer } from '../render/toasts';
import type { ScreenShake } from '../render/shake';
import type { RunSeedInfo } from '../sim/run/types';
import type { Sim } from '../sim/sim';
import type { DomModal } from './domModal';
import type { SceneManager } from './scene';

/** How a new run starts (character select → START): who, and which seed. */
export interface RunStart {
  character: string;
  seed: RunSeedInfo;
  /** The sim seed when it isn't the code's hash (retrying a debug run that has no code). */
  simSeed?: number;
  /**
   * The unlock snapshot to start with instead of the one the seed kind picks (meta/unlocks.ts `unlocksForRun`):
   * RETRY SEED passes the finished run's own `RunData.unlocked`, so the retry is the same run as the original.
   */
  unlocked?: readonly string[];
}

/** A finished run for the game-over / ending screens. */
export interface RunEndInfo {
  /** The finished run (read only). */
  sim: Sim;
  /** 0 = died; 1-3 = the ending reached. */
  ending: number;
  /** Route flags this run unlocked for the first time ('ending1'…), for the ending screen's notices. */
  newFlags: string[];
}

/** Scene navigation, implemented in main.ts so scenes never import each other. */
export interface Nav {
  title(): void;
  /** Starts a random run right away with the last character chosen (debug menu, __SD). A saved run is abandoned. */
  newRun(): void;
  /** Resumes the saved run (title → Continue). False (with a notice) when it can't be continued. */
  continueRun(): boolean;
  /** Character select before a run: `seed` null = a random seed (New Run), else daily / typed. */
  characters(seed: RunSeedInfo | null): void;
  /** Starts a run (character select's START, game over's RESTART). A saved run is abandoned. */
  startRun(start: RunStart): void;
  /** Today's daily run (character select with the date's seed; a replay of a played day is unscored). */
  daily(): void;
  /** Enter Seed: the DOM modal, then character select. */
  seedEntry(): void;
  collection(): void;
  bestiary(): void;
  stats(): void;
  achievements(): void;
  /** The training yard (debug menu). */
  yard(): void;
  /** The expanded floor map over the run (tap the minimap / Tab). */
  map(): void;
  settings(): void;
  /** Settings with its IMPORT SAVE modal open (the title's first-launch hint in the home-screen app). */
  importSave(): void;
  pause(): void;
  resume(): void;
  /** Closes the top scene (a menu page's BACK). */
  back(): void;
  /** The run ended: the game-over screen (over the frozen run) or the ending screen. */
  gameOver(info: RunEndInfo): void;
  victory(info: RunEndInfo): void;
  /** Opens the hidden debug menu over the run (or closes it when it is on top). */
  debug(): void;
}

export interface App {
  readonly display: Display;
  readonly input: Input;
  readonly scenes: SceneManager;
  readonly audio: AudioOut;
  readonly settings: SettingsStore;
  /** One shared particle pool (cap 800), cleared on scene changes. */
  readonly particles: ParticleSystem;
  readonly shake: ScreenShake;
  readonly nav: Nav;
  /** Saves: meta progress, the run save, achievements, the meta tracker (src/meta/save.ts). */
  readonly save: GameSave;
  /** Achievement / notice toasts, drawn over every scene. */
  readonly toasts: ToastLayer;
  /** The DOM modal layer: text entry (seed, save import / export) — the only DOM UI. */
  readonly modal: DomModal;
  /**
   * Polish batch 3: where the game runs (a Safari tab whose saves may be wiped / the home-screen app), whether storage
   * is protected, whether this launch began with no meta save at all, and a waiting update (the title offers a reload).
   */
  readonly pwa: PwaState;
}
