/**
 * Bootstrap: display + input + audio + scenes + loop + lifecycle, saves (meta progress, the run save,
 * achievements — src/meta/save.ts), toasts, the service worker, and the window.__SD test hooks.
 *
 * Polish batch 3: the crash guard (an exception in a scene's update / render returns to the title with a toast,
 * never overwriting the last good run save), the PWA state (`app.pwa`: a Safari tab or the home-screen app, a waiting
 * update → the title's RELOAD), other tabs' meta saves merged in ('storage' events), and every display change
 * re-lays out the run buttons (their 44 pt floor depends on the scale) and the DOM modal (portrait included; the
 * rotate card is not drawn behind an open modal).
 */

import { createAudio } from './audio/engine';
import { ButtonRegistry } from './engine/buttons';
import { Display } from './engine/display';
import { Input } from './engine/input';
import { installLifecycle } from './engine/lifecycle';
import { Loop } from './engine/loop';
import { defaultSettings, SettingsStore } from './meta/settings';
import { META_KEY, fromRuntimeSettings, toRuntimeSettings } from './meta/metaState';
import { RUN_KEY } from './meta/runSave';
import { GameSave, installGameSave, saveRunNow } from './meta/save';
import { createStorage, requestPersistentStorage } from './meta/storage';
import { readPlatform, type PwaState } from './pwa/platform';
import { registerServiceWorker } from './pwa/register';
import { TOAST_ACHIEVEMENT, TOAST_NOTICE, ToastLayer } from './render/toasts';
import { ParticleSystem, PARTICLE_CAP } from './render/particles';
import { RotateScreen } from './render/rotateScreen';
import { ScreenShake } from './render/shake';
import { CAP_ENEMIES, CAP_ENEMY_SHOTS, CAP_PROJECTILES } from './sim/constants';
import type { RunOptions } from './sim/run/types';
import type { App, Nav } from './ui/app';
import { AchievementsScene } from './ui/achievementsPage';
import { BestiaryScene } from './ui/bestiary';
import { CharacterSelectScene, lastCharacter } from './ui/characterSelect';
import { CollectionScene } from './ui/collection';
import { DomModal } from './ui/domModal';
import { EndingScene } from './ui/ending';
import { GameOverScene } from './ui/gameOver';
import { MapScene } from './ui/mapOverlay';
import { ModalScene, openSeedEntry } from './ui/modals';
import { PauseScene } from './ui/pause';
import { RunScene } from './ui/run';
import { SceneManager } from './ui/scene';
import { SettingsScene } from './ui/settingsPanel';
import { StatsScene } from './ui/statsPage';
import { TitleScene } from './ui/title';
import { utcDateKey } from './meta/metaState';
import { dailySeedInfo, randomSeedCode, rolledOverDaily } from './meta/seedCode';
import { drawText, type TextStyle } from './render/font';
import { GAME_H } from './engine/screen';
import { DebugActions } from './debug/actions';
import { DebugMenu } from './debug/debugMenu';
import { PerfOverlay } from './debug/perfOverlay';
import { installSdHooks } from './debug/sdHooks';

function boot(): void {
  const canvas = document.getElementById('screen') as HTMLCanvasElement | null;
  if (!canvas) throw new Error('missing #screen canvas');
  const display = new Display(canvas, document.getElementById('safe-probe'));
  const registry = new ButtonRegistry();
  const input = new Input(canvas, display, registry);
  // Saves first: the settings the player chose last time come from the meta save.
  const save = new GameSave(createStorage());
  installGameSave(save);
  const settings = new SettingsStore({ ...defaultSettings(), ...toRuntimeSettings(save.meta.settings) });
  const s0 = settings.value;
  const toasts = new ToastLayer();
  const audio = createAudio({ master: s0.masterVolume, music: s0.musicVolume, sfx: s0.sfxVolume });
  const particles = new ParticleSystem();
  const shake = new ScreenShake();
  const scenes = new SceneManager(input, registry);
  const perf = new PerfOverlay();
  let rotate: RotateScreen | null = null;
  let clock = 0;
  // Where the game runs and what the PWA knows (polish batch 3): the title / settings read it.
  const pwa: PwaState = {
    platform: readPlatform(),
    firstLaunch: save.meta.loaded.status === 'empty',
    persisted: null,
    updateReady: false,
    reload: () => {
      // Nothing is lost: the run (if one is up — never, from the title) and meta are written first.
      saveRunNow();
      location.reload();
    },
  };

  const modal = new DomModal(display);
  const nav: Nav = {
    title: () => {
      // Leaving a run keeps it for Continue (saved as it was when the player entered the room).
      saveRunNow();
      scenes.replace(new TitleScene(app));
    },
    newRun: () => nav.startRun({ character: lastCharacter(), seed: { code: randomSeedCode(), kind: 'random' } }),
    startRun: (start) => {
      // A daily picked before UTC midnight and started after it is the NEW day's daily (its own code and scored
      // flag) — never yesterday's scored attempt on top of today's.
      const rolled = rolledOverDaily(start.seed, utcDateKey(Date.now()), (date) => save.meta.hasDaily(date));
      if (rolled) start = { ...start, seed: rolled };
      // Starting a run abandons a saved one (a 'quit': the win streak ends).
      save.abandonSavedRun();
      scenes.replace(new RunScene(app, 'run', null, start));
    },
    characters: (seed) => scenes.push(new CharacterSelectScene(app, seed)),
    daily: () => {
      const date = utcDateKey(Date.now());
      // One scored attempt per UTC day: a replay of a day already played runs unscored.
      nav.characters(dailySeedInfo(date, save.meta.hasDaily(date)));
    },
    seedEntry: () => openSeedEntry(app),
    collection: () => scenes.push(new CollectionScene(app)),
    bestiary: () => scenes.push(new BestiaryScene(app)),
    stats: () => scenes.push(new StatsScene(app)),
    achievements: () => scenes.push(new AchievementsScene(app)),
    back: () => scenes.pop(),
    gameOver: (info) => scenes.push(new GameOverScene(app, info)),
    victory: (info) => scenes.push(new EndingScene(app, info)),
    continueRun: () => {
      const r = save.loadRun();
      if (!r.ok) {
        toasts.push(TOAST_NOTICE, "CAN'T CONTINUE", r.message);
        // A damaged run can never load: drop it (a newer version's run is left alone).
        if (r.reason === 'corrupt') save.clearRun();
        return false;
      }
      let scene: RunScene;
      try {
        scene = new RunScene(app, 'run', r.snapshot);
      } catch (err) {
        console.warn('run restore failed', err);
        toasts.push(TOAST_NOTICE, "CAN'T CONTINUE", "THE SAVED RUN COULDN'T BE RESTORED");
        save.clearRun();
        return false;
      }
      scenes.replace(scene);
      if (r.restored) toasts.push(TOAST_NOTICE, 'RUN RESTORED', 'THE LATEST SAVE WAS DAMAGED · USED THE ONE BEFORE');
      return true;
    },
    yard: () => scenes.replace(new RunScene(app, 'yard')),
    map: () => {
      const sim = getSim();
      if (scenes.top?.name !== 'run' || !sim?.run || display.portrait) return;
      scenes.push(new MapScene(app, sim));
    },
    settings: () => scenes.push(new SettingsScene(app)),
    importSave: () => {
      const s = new SettingsScene(app);
      scenes.push(s);
      s.startImport();
    },
    pause: () => {
      if (scenes.top?.name !== 'run') return;
      saveRunNow();
      scenes.push(new PauseScene(app));
    },
    resume: () => scenes.pop(),
    debug: () => {
      if (scenes.top?.name === 'debug') {
        scenes.pop();
        return;
      }
      // Only over a run (the menu acts on its sim); elsewhere the key just toggles the perf overlay.
      if (!getSim() || display.portrait) {
        perf.toggle();
        return;
      }
      scenes.push(new DebugMenu(app, debugActions));
    },
  };
  const app: App = { display, input, scenes, audio, settings, particles, shake, nav, save, toasts, modal, pwa };
  // A DOM modal (seed entry, save export / import) blocks the canvas UI while it is open.
  modal.onChange = (open) => {
    if (open) scenes.push(new ModalScene(app));
    else if (scenes.top?.name === 'modal') scenes.pop();
  };

  settings.subscribe((s) => {
    input.setAim360(s.aim360);
    input.setLeftHanded(s.leftHanded);
    shake.scale = s.shake;
    audio.setVolumes({ master: s.masterVolume, music: s.musicVolume, sfx: s.sfxVolume });
    scenes.relayout();
    // Settings persist in the meta save (a no-op when nothing changed).
    save.meta.updateSettings(fromRuntimeSettings(s));
  });
  save.host = {
    savableRun: () => {
      const run = scenes.find('run');
      return run instanceof RunScene ? run.savableSim() : null;
    },
  };
  // Another tab of the game saved (polish batch 3): its meta progress is merged in at once — and its settings applied —
  // so this tab's next save can't wipe it. Two live runs in two tabs would overwrite each other's run save: say so.
  save.meta.subscribe((state, change) => {
    if (change.external && change.settings) settings.update(toRuntimeSettings(state.settings));
  });
  let otherTabWarned = false;
  window.addEventListener('storage', (e) => {
    if (e.key === META_KEY) save.syncMetaFromStorage();
    else if (e.key === RUN_KEY && !otherTabWarned && getSim()?.run) {
      otherTabWarned = true;
      toasts.push(TOAST_NOTICE, 'THE GAME IS OPEN IN ANOTHER TAB', 'PLAY IN ONE AT A TIME TO KEEP YOUR RUN');
    }
  });
  toasts.onShow = (kind) => {
    if (kind === TOAST_ACHIEVEMENT) audio.play('achievement');
  };
  /** Achievements earned this tick → toasts (the trophy banner over the bottom wall; never blocks play). */
  const drainAchievements = (): void => {
    for (let a = save.achievements.drain(); a; a = save.achievements.drain()) {
      toasts.push(TOAST_ACHIEVEMENT, `ACHIEVEMENT · ${a.name}`, a.rewards[0] ?? a.desc);
    }
  };
  // A save restored from its backup / found damaged: a toast at boot. The lasting ones (a newer version's save,
  // no storage) stay on the title instead.
  const notice = save.notice;
  if (notice && !notice.lasting) toasts.push(TOAST_NOTICE, notice.title, notice.line);
  if (save.dropDamagedRun()) toasts.push(TOAST_NOTICE, 'SAVED RUN LOST', "IT WAS DAMAGED AND COULDN'T BE RESTORED");
  input.onDebugToggle = () => nav.debug();
  input.onPerfToggle = () => perf.toggle();

  const getSim = () => {
    const run = scenes.find('run');
    return run instanceof RunScene ? run.sim : null;
  };
  const debugActions = new DebugActions({
    sim: getSim,
    yard: () => nav.yard(),
    newRun: () => nav.newRun(),
    perf: (on) => {
      if (on === undefined || on !== perf.visible) perf.toggle();
      return perf.visible;
    },
    perfVisible: () => perf.visible,
    unlockAll: () => save.debugUnlockAll(),
    resetUnlocks: () => save.debugResetUnlocks(),
  });
  const getHudRects = () => {
    const run = scenes.find('run');
    return run instanceof RunScene ? run.hudRects() : [];
  };

  const perfLines = (): string[] => {
    const sim = getSim();
    const v = display.view;
    return [
      `FPS ${loop.fps}  UPD ${loop.updateMs.toFixed(2)}MS  RND ${loop.renderMs.toFixed(2)}MS`,
      `WORST ${Math.round(loop.stats.worstMs)}MS  GAP ${Math.round(loop.stats.gapMs)}MS  >20: ${loop.stats.over20}`,
      `SCENE ${scenes.names.join('>').toUpperCase()}  TICK ${loop.ticks}  DROP ${loop.droppedSteps}`,
      `SHOTS ${sim?.world.projectiles.count ?? 0}/${CAP_PROJECTILES}  BEAMS ${sim?.world.atk.beams.count ?? 0}  PARTS ${particles.count}/${PARTICLE_CAP}`,
      `EVENTS DROPPED ${sim?.events.dropped ?? 0}  DUMMIES ${sim?.world.dummies.count ?? 0}  PICKUPS ${sim?.world.pickups.count ?? 0}  BOMBS ${sim?.world.bombs.count ?? 0}`,
      `ENEMIES ${sim?.world.enemies.count ?? 0}/${CAP_ENEMIES}  ESHOTS ${sim?.world.enemyShots.count ?? 0}/${CAP_ENEMY_SHOTS}  CREEP ${sim?.world.creep.count ?? 0}`,
      `VIEW ${v.scale.toFixed(2)}X  DPR ${display.dpr.toFixed(2)}  ${Math.round(display.cssW)}X${Math.round(display.cssH)}`,
    ];
  };

  let wasPortrait = false;
  let layoutVersion = display.version;

  // ── Crash guard (polish batch 3) ──
  // An exception escaping a scene used to skip every later render: the game froze without a word. Now the run scene
  // that threw is never saved again (the stored save stays its last good checkpoint: the last room entry or clear),
  // the player is back on the title with a toast, and play goes on. Three crashes within 5 s stop the loop with a note.
  let crashAt = -Infinity;
  let crashes = 0;
  const onCrash = (err: unknown, phase: 'update' | 'render'): void => {
    console.error(`Stormdrain: an error in the game's ${phase}`, err);
    const now = performance.now();
    crashes = now - crashAt < 5000 ? crashes + 1 : 1;
    crashAt = now;
    const run = scenes.find('run');
    if (run instanceof RunScene) run.crashed = true;
    if (crashes >= 3) {
      loop.stop();
      showFatal('Stormdrain hit a problem it could not get past', err);
      return;
    }
    const inRun = run instanceof RunScene && run.mode === 'run';
    if (modal.isOpen) modal.close();
    input.releaseAll();
    scenes.replace(new TitleScene(app));
    toasts.push(TOAST_NOTICE, 'SOMETHING WENT WRONG', inRun && save.hasRun() ? 'YOUR RUN WAS SAVED AT THE LAST ROOM' : 'BACK TO THE TITLE');
  };

  const loop = new Loop({
    error: onCrash,
    update(dt) {
      clock += dt;
      perf.update(dt, perfLines);
      if (display.portrait) {
        input.endTick();
        save.endTick();
        return;
      }
      input.poll();
      scenes.update(dt, input.state);
      input.endTick();
      // Meta: counter achievements, then the end-of-tick save; new achievements become toasts.
      save.endTick();
      drainAchievements();
      toasts.update(dt);
    },
    render(alpha) {
      display.update();
      if (display.version !== layoutVersion) {
        layoutVersion = display.version;
        // The run buttons' 44 pt floor depends on the display scale (not re-laid out for the portrait card: rotating
        // back changes the layout again). The DOM modal follows the display in portrait too.
        if (!display.portrait) scenes.relayout();
        modal.place();
      }
      if (display.portrait) {
        if (!wasPortrait) {
          // Rotating to portrait pauses the run; it resumes from the pause menu.
          wasPortrait = true;
          input.releaseAll();
          scenes.background();
        }
        // An open DOM modal (seed entry, save export / import) stays usable in portrait, laid out for the screen:
        // no rotate card behind it (it would sit under a panel that still takes taps).
        if (!modal.isOpen) {
          rotate ??= new RotateScreen();
          display.presentOther(rotate.draw(clock));
          return;
        }
      } else {
        wasPortrait = false;
      }
      const ctx = display.ctx;
      scenes.render(ctx, alpha);
      toasts.draw(ctx, scenes.top?.toastsAtTop === true);
      if (settings.value.showFps && !perf.visible) drawFps(ctx, loop.fps);
      perf.draw(ctx);
      display.present();
    },
  });

  installLifecycle({
    onHide() {
      input.releaseAll();
      scenes.background();
      saveRunNow();
      audio.suspend();
    },
    onShow() {
      audio.resume();
      loop.resetClock();
    },
  });

  const getPresentation = () => {
    const run = scenes.find('run');
    return run instanceof RunScene ? run.presentation : null;
  };
  const restartRun = (opts: RunOptions, seed?: number | string, character?: string): boolean => {
    const run = scenes.find('run');
    if (!(run instanceof RunScene)) return false;
    run.restartRun(opts, seed, character);
    return true;
  };
  // A new version finished installing in the background: the title offers RELOAD (saves first); a run is never
  // reloaded under the player — mid-run a short toast points to the title.
  const onUpdate = (): void => {
    if (pwa.updateReady) return;
    pwa.updateReady = true;
    if (scenes.find('title') === undefined) toasts.push(TOAST_NOTICE, 'UPDATE READY', 'RELOAD FROM THE TITLE');
  };
  installSdHooks({ app, loop, perf, registry, getSim, getHudRects, actions: debugActions, getPresentation, restartRun, pwaUpdate: onUpdate });
  scenes.replace(new TitleScene(app));
  loop.start();

  // Offline play + the home-screen app (production builds on secure origins only; never blocks boot).
  void registerServiceWorker({ onUpdate });
  // Ask the browser not to evict the saves (best effort); Settings says whether a Safari tab's saves are protected.
  void requestPersistentStorage().then((ok) => {
    pwa.persisted = ok;
  });
}

/** The last resort (the crash guard gave up): a plain page over the canvas. */
function showFatal(title: string, err: unknown): void {
  const msg = document.createElement('pre');
  msg.style.cssText =
    'position:fixed;inset:0;z-index:30;margin:0;background:#000;color:#ccc;font:12px monospace;padding:16px;white-space:pre-wrap';
  msg.textContent = `${title}:\n${String(err)}\n\nYour progress is saved (a run continues from its last room). Reload the page to play on.`;
  document.body.appendChild(msg);
}

const FPS_STYLE: TextStyle = { color: '#8fe0a0', shadow: '#07080d' };
const fpsText: string[] = [];

/** Settings → SHOW FPS: a small readout in the bottom-left corner (text cached per value). */
function drawFps(ctx: CanvasRenderingContext2D, fps: number): void {
  const n = Math.max(0, Math.min(999, Math.round(fps)));
  drawText(ctx, (fpsText[n] ??= `${n} FPS`), 2, GAME_H - 7, FPS_STYLE);
}

try {
  boot();
} catch (err) {
  console.error(err);
  const msg = document.createElement('pre');
  msg.style.cssText = 'color:#ccc;font:12px monospace;padding:16px;white-space:pre-wrap';
  msg.textContent = `Stormdrain failed to start:\n${String(err)}`;
  document.body.appendChild(msg);
}
