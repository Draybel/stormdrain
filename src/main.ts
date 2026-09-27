/**
 * Bootstrap: display + input + audio + scenes + loop + lifecycle, saves (meta progress, the run save,
 * achievements — src/meta/save.ts), toasts, the service worker, and the window.__SD test hooks.
 */

import { createAudio } from './audio/engine';
import { ButtonRegistry } from './engine/buttons';
import { Display } from './engine/display';
import { Input } from './engine/input';
import { installLifecycle } from './engine/lifecycle';
import { Loop } from './engine/loop';
import { defaultSettings, SettingsStore } from './meta/settings';
import { fromRuntimeSettings, toRuntimeSettings } from './meta/metaState';
import { GameSave, installGameSave, saveRunNow } from './meta/save';
import { createStorage, requestPersistentStorage } from './meta/storage';
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
import { dailySeedCode, randomSeedCode } from './meta/seedCode';
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

  const modal = new DomModal(display);
  const nav: Nav = {
    title: () => {
      // Leaving a run keeps it for Continue (saved as it was when the player entered the room).
      saveRunNow();
      scenes.replace(new TitleScene(app));
    },
    newRun: () => nav.startRun({ character: lastCharacter(), seed: { code: randomSeedCode(), kind: 'random' } }),
    startRun: (start) => {
      // Starting a run abandons a saved one (a 'quit': the win streak ends).
      save.abandonSavedRun();
      scenes.replace(new RunScene(app, 'run', null, start));
    },
    characters: (seed) => scenes.push(new CharacterSelectScene(app, seed)),
    daily: () => {
      const date = utcDateKey(Date.now());
      // One scored attempt per UTC day: a replay of a day already played runs unscored.
      nav.characters({ code: dailySeedCode(date), kind: 'daily', date, scored: !save.meta.hasDaily(date) });
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
  const app: App = { display, input, scenes, audio, settings, particles, shake, nav, save, toasts, modal };
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
      `SCENE ${scenes.names.join('>').toUpperCase()}  TICK ${loop.ticks}  DROP ${loop.droppedSteps}`,
      `SHOTS ${sim?.world.projectiles.count ?? 0}/${CAP_PROJECTILES}  BEAMS ${sim?.world.atk.beams.count ?? 0}  PARTS ${particles.count}/${PARTICLE_CAP}`,
      `EVENTS DROPPED ${sim?.events.dropped ?? 0}  DUMMIES ${sim?.world.dummies.count ?? 0}  PICKUPS ${sim?.world.pickups.count ?? 0}  BOMBS ${sim?.world.bombs.count ?? 0}`,
      `ENEMIES ${sim?.world.enemies.count ?? 0}/${CAP_ENEMIES}  ESHOTS ${sim?.world.enemyShots.count ?? 0}/${CAP_ENEMY_SHOTS}  CREEP ${sim?.world.creep.count ?? 0}`,
      `VIEW ${v.scale.toFixed(2)}X  DPR ${display.dpr.toFixed(2)}  ${Math.round(display.cssW)}X${Math.round(display.cssH)}`,
    ];
  };

  let wasPortrait = false;
  const loop = new Loop({
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
      if (display.portrait) {
        if (!wasPortrait) {
          // Rotating to portrait pauses the run; it resumes from the pause menu.
          wasPortrait = true;
          input.releaseAll();
          scenes.background();
        }
        rotate ??= new RotateScreen();
        display.presentOther(rotate.draw(clock));
        return;
      }
      wasPortrait = false;
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
  const restartRun = (opts: RunOptions, seed?: number | string): boolean => {
    const run = scenes.find('run');
    if (!(run instanceof RunScene)) return false;
    run.restartRun(opts, seed);
    return true;
  };
  installSdHooks({ app, loop, perf, registry, getSim, getHudRects, actions: debugActions, getPresentation, restartRun });
  scenes.replace(new TitleScene(app));
  loop.start();

  // Offline play + the home-screen app (production builds on secure origins only; never blocks boot).
  void registerServiceWorker({
    onUpdate: () => toasts.push(TOAST_NOTICE, 'GAME UPDATED', 'RESTART TO PLAY THE NEW VERSION'),
  });
  // Ask the browser not to evict the saves (best effort).
  void requestPersistentStorage();
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
