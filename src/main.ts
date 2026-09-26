/**
 * Bootstrap: display + input + audio + scenes + loop + lifecycle, and the window.__SD test hooks.
 */

import { createAudio } from './audio/engine';
import { ButtonRegistry } from './engine/buttons';
import { Display } from './engine/display';
import { Input } from './engine/input';
import { installLifecycle } from './engine/lifecycle';
import { Loop } from './engine/loop';
import { SettingsStore } from './meta/settings';
import { saveRunNow } from './meta/save';
import { ParticleSystem, PARTICLE_CAP } from './render/particles';
import { RotateScreen } from './render/rotateScreen';
import { ScreenShake } from './render/shake';
import { CAP_PROJECTILES } from './sim/constants';
import type { App, Nav } from './ui/app';
import { PauseScene } from './ui/pause';
import { RunScene } from './ui/run';
import { SceneManager } from './ui/scene';
import { SettingsScene } from './ui/settingsPanel';
import { TitleScene } from './ui/title';
import { PerfOverlay } from './debug/perfOverlay';
import { installSdHooks } from './debug/sdHooks';

function boot(): void {
  const canvas = document.getElementById('screen') as HTMLCanvasElement | null;
  if (!canvas) throw new Error('missing #screen canvas');
  const display = new Display(canvas, document.getElementById('safe-probe'));
  const registry = new ButtonRegistry();
  const input = new Input(canvas, display, registry);
  const settings = new SettingsStore();
  const s0 = settings.value;
  const audio = createAudio({ master: s0.masterVolume, music: s0.musicVolume, sfx: s0.sfxVolume });
  const particles = new ParticleSystem();
  const shake = new ScreenShake();
  const scenes = new SceneManager(input, registry);
  const perf = new PerfOverlay();
  let rotate: RotateScreen | null = null;
  let clock = 0;

  const nav: Nav = {
    title: () => scenes.replace(new TitleScene(app)),
    newRun: () => scenes.replace(new RunScene(app)),
    settings: () => scenes.push(new SettingsScene(app)),
    pause: () => {
      if (scenes.top?.name !== 'run') return;
      saveRunNow();
      scenes.push(new PauseScene(app));
    },
    resume: () => scenes.pop(),
  };
  const app: App = { display, input, scenes, audio, settings, particles, shake, nav };

  settings.subscribe((s) => {
    input.setAim360(s.aim360);
    shake.scale = s.shake;
    audio.setVolumes({ master: s.masterVolume, music: s.musicVolume, sfx: s.sfxVolume });
    scenes.relayout();
  });
  input.onDebugToggle = () => perf.toggle();

  const getSim = () => {
    const run = scenes.find('run');
    return run instanceof RunScene ? run.sim : null;
  };

  const perfLines = (): string[] => {
    const sim = getSim();
    const v = display.view;
    return [
      `FPS ${loop.fps}  UPD ${loop.updateMs.toFixed(2)}MS  RND ${loop.renderMs.toFixed(2)}MS`,
      `SCENE ${scenes.names.join('>').toUpperCase()}  TICK ${loop.ticks}  DROP ${loop.droppedSteps}`,
      `SHOTS ${sim?.world.projectiles.count ?? 0}/${CAP_PROJECTILES}  PARTS ${particles.count}/${PARTICLE_CAP}`,
      `EVENTS DROPPED ${sim?.events.dropped ?? 0}  DUMMIES ${sim?.world.dummies.count ?? 0}`,
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
        return;
      }
      input.poll();
      scenes.update(dt, input.state);
      input.endTick();
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

  installSdHooks({ app, loop, perf, registry, getSim });
  nav.title();
  loop.start();
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
