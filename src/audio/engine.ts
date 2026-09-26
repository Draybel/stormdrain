/**
 * Web Audio engine. The AudioContext is created lazily and unlocked on the first user gesture
 * (pointerdown / touchend / keydown / click): resume() + a 1-sample silent buffer, which is what
 * iOS Safari needs. The listeners stay installed (they are cheap) so an "interrupted" context —
 * e.g. after a phone call — is resumed by the next tap.
 *
 * Buses: master → { music, sfx }. `NullAudio` is a no-op stand-in for headless tests and for
 * browsers without Web Audio.
 */

import { SfxPlayer, type SfxName } from './sfx';

export interface Volumes {
  master: number;
  music: number;
  sfx: number;
}

export interface AudioOut {
  readonly unlocked: boolean;
  play(name: SfxName, pan?: number, volume?: number): void;
  setVolumes(v: Volumes): void;
  /** Background / lifecycle. */
  suspend(): void;
  resume(): void;
}

export class NullAudio implements AudioOut {
  readonly unlocked = false;
  play(): void {}
  setVolumes(): void {}
  suspend(): void {}
  resume(): void {}
}

type AudioContextCtor = typeof AudioContext;

function audioContextCtor(): AudioContextCtor | null {
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** pointerup (touch) and touchend are activation-triggering in WebKit; pointerdown covers mice. */
const GESTURES = ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click'] as const;

export class WebAudio implements AudioOut {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private sfx: SfxPlayer | null = null;
  private volumes: Volumes;
  /** True while the page is backgrounded: never resume then. */
  private suspendedByLifecycle = false;
  /** performance.now() of the last gesture that asked a suspended context to resume. */
  private unlockAt = -1e9;
  private readonly Ctor: AudioContextCtor;

  constructor(Ctor: AudioContextCtor, volumes: Volumes) {
    this.Ctor = Ctor;
    this.volumes = { ...volumes };
    for (const ev of GESTURES) document.addEventListener(ev, this.onGesture, { capture: true, passive: true });
  }

  get unlocked(): boolean {
    return this.ctx?.state === 'running';
  }

  private readonly onGesture = (): void => {
    if (this.suspendedByLifecycle) return;
    if (!this.ctx) this.create();
    const ctx = this.ctx;
    if (!ctx) return;
    if (ctx.state !== 'running') {
      this.unlockAt = performance.now();
      ctx.resume().catch(() => {});
      // iOS: playing any buffer inside the gesture fully unlocks output.
      try {
        const b = ctx.createBuffer(1, 1, 22050);
        const s = ctx.createBufferSource();
        s.buffer = b;
        s.connect(ctx.destination);
        s.start(0);
      } catch {
        /* ignore */
      }
    }
  };

  private create(): void {
    try {
      const ctx = new this.Ctor({ latencyHint: 'interactive' });
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.musicBus = ctx.createGain();
      this.sfxBus = ctx.createGain();
      this.musicBus.connect(this.master);
      this.sfxBus.connect(this.master);
      this.master.connect(ctx.destination);
      this.sfx = new SfxPlayer(ctx, this.sfxBus);
      this.applyVolumes();
    } catch {
      this.ctx = null;
    }
  }

  private applyVolumes(): void {
    if (!this.master || !this.musicBus || !this.sfxBus) return;
    this.master.gain.value = this.volumes.master;
    this.musicBus.gain.value = this.volumes.music;
    this.sfxBus.gain.value = this.volumes.sfx;
  }

  setVolumes(v: Volumes): void {
    this.volumes = { ...v };
    this.applyVolumes();
  }

  play(name: SfxName, pan = 0, volume = 1): void {
    const ctx = this.ctx;
    if (!this.sfx || !ctx || this.suspendedByLifecycle) return;
    // Right after an unlocking gesture, resume() is still pending: schedule anyway so the very
    // first UI click is heard the moment the context starts. Otherwise only play when running.
    if (ctx.state !== 'running' && !(ctx.state === 'suspended' && performance.now() - this.unlockAt < 300)) return;
    this.sfx.play(name, pan, volume);
  }

  suspend(): void {
    this.suspendedByLifecycle = true;
    this.ctx?.suspend().catch(() => {});
  }

  resume(): void {
    this.suspendedByLifecycle = false;
    // May be refused without a gesture on iOS; the gesture listener retries on the next tap.
    if (this.ctx && this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
  }
}

export function createAudio(volumes: Volumes): AudioOut {
  if (typeof window === 'undefined' || typeof document === 'undefined') return new NullAudio();
  const Ctor = audioContextCtor();
  return Ctor ? new WebAudio(Ctor, volumes) : new NullAudio();
}
