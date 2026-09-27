/**
 * Settings (Phase 4B, overlay scene 'settings'): opened from the title or the pause menu.
 * Left column: MASTER / MUSIC / EFFECTS volume and SCREEN SHAKE sliders, SHOW FPS. Right column: AIM (4-way /
 * 360°), LEFT-HANDED (swaps the sticks and the thumb button columns), BUTTON SIZE (100-150 %: 100 % is the 44 pt floor), EXPORT / IMPORT
 * SAVE (DOM modals, ui/modals.ts), REDUCE FLASHING (polish batch 2: every full-screen flash capped low); the note about
 * separate saves runs along the bottom edge. Every change persists through the meta save (main.ts).
 *
 * Sliders: tap anywhere on the track to jump there, drag to slide; the value is previewed live (volumes)
 * and committed when the finger lifts. Keyboard: arrows move the focus, left / right on a focused slider
 * adjust it, Enter toggles / presses, Esc goes back.
 */

import type { InputState } from '../engine/inputState';
import { GAME_H, GAME_W } from '../engine/screen';
import { UI } from '../content/sprites/palette';
import {
  BUTTON_SCALE_MAX,
  BUTTON_SCALE_MIN,
  BUTTON_SCALE_STEP,
  SHAKE_STEP,
  VOLUME_STEP,
  type Settings,
} from '../meta/settings';
import { drawText, measureText, type TextStyle } from '../render/font';
import { drawPanel } from '../render/pixel';
import type { App } from './app';
import { openExport, openImport } from './modals';
import type { Scene } from './scene';
import { BTN_H, MenuNav, drawMenuButtons, drawPageHeader, pageBackdrop, tickButtons, uiButton, type UiButton } from './widgets';

type NumKey = 'masterVolume' | 'musicVolume' | 'sfxVolume' | 'shake' | 'buttonScale';
type BoolKey = 'aim360' | 'leftHanded' | 'showFps' | 'reduceFlashing';

interface SliderDef {
  key: NumKey;
  label: string;
  min: number;
  max: number;
  step: number;
}

interface ToggleDef {
  key: BoolKey;
  label: string;
  off: string;
  on: string;
}

const LABEL: TextStyle = { color: UI.text, shadow: UI.shadow };
const VALUE: TextStyle = { color: '#fff3c4', shadow: UI.shadow };
const SEG_ON: TextStyle = { color: '#fff3c4', shadow: '#3a2410' };
const SEG_OFF: TextStyle = { color: '#6a7896' };
const NOTE: TextStyle = { color: UI.textDim };
const WARN: TextStyle = { color: '#e0a060', shadow: UI.shadow };

const COL_L = 6;
const COL_R = 196;
const COL_W = 182;
const ROW_Y = [40, 69, 98, 127, 156] as const;
/** Label column width inside a row; the track / segments start after it. */
const LABEL_W = 56;
const VALUE_W = 28;

export class SettingsScene implements Scene {
  readonly name = 'settings';
  readonly overlay = true;
  readonly wantsSticks = false;
  readonly buttons: UiButton[];
  private readonly app: App;
  private readonly menu: MenuNav;
  private readonly sliders: { def: SliderDef; b: UiButton; draft: number; wasHeld: boolean }[] = [];
  private readonly toggles: { def: ToggleDef; b: UiButton }[] = [];
  private readonly back: UiButton;
  private readonly exportBtn: UiButton;
  private readonly importBtn: UiButton;
  private time = 0;
  /** Opened over a run (import is title-only then). */
  private inRun = false;

  constructor(app: App) {
    this.app = app;
    this.back = uiButton({
      id: 'settings.back',
      label: 'BACK',
      x: 6,
      y: 5,
      w: 60,
      h: BTN_H,
      onActivate: () => this.close(),
    });
    const slider = (key: NumKey, id: string, label: string, col: number, row: number, min: number, max: number, step: number): void => {
      const b = uiButton({ id: `settings.${id}`, x: col, y: ROW_Y[row]!, w: COL_W, h: BTN_H, pad: 2 });
      const def: SliderDef = { key, label, min, max, step };
      b.adjust = (dir) => this.nudge(def, dir);
      const s = { def, b, draft: app.settings.value[key], wasHeld: false };
      // A quick tap presses and lets go between two ticks: take the value where the finger lifted.
      b.onActivate = () => this.tapSlider(s);
      this.sliders.push(s);
    };
    const toggle = (key: BoolKey, id: string, label: string, col: number, row: number, off: string, on: string): void => {
      const def: ToggleDef = { key, label, off, on };
      const b = uiButton({ id: `settings.${id}`, x: col, y: ROW_Y[row]!, w: COL_W, h: BTN_H, pad: 2, onActivate: () => this.flip(def) });
      this.toggles.push({ def, b });
    };
    slider('masterVolume', 'master', 'MASTER', COL_L, 0, 0, 1, VOLUME_STEP);
    slider('musicVolume', 'music', 'MUSIC', COL_L, 1, 0, 1, VOLUME_STEP);
    slider('sfxVolume', 'sfx', 'EFFECTS', COL_L, 2, 0, 1, VOLUME_STEP);
    slider('shake', 'shake', 'SHAKE', COL_L, 3, 0, 1, SHAKE_STEP);
    toggle('showFps', 'fps', 'SHOW FPS', COL_L, 4, 'OFF', 'ON');
    toggle('aim360', 'aim', 'AIM', COL_R, 0, '4-WAY', '360°');
    toggle('leftHanded', 'lefty', 'LEFT-HANDED', COL_R, 1, 'OFF', 'ON');
    slider('buttonScale', 'buttons', 'BUTTON SIZE', COL_R, 2, BUTTON_SCALE_MIN, BUTTON_SCALE_MAX, BUTTON_SCALE_STEP);
    toggle('reduceFlashing', 'flash', 'REDUCE FLASHING', COL_R, 4, 'OFF', 'ON');
    const half = Math.floor((COL_W - 4) / 2);
    this.exportBtn = uiButton({
      id: 'settings.export',
      label: 'EXPORT SAVE',
      textScale: 1,
      x: COL_R,
      y: ROW_Y[3],
      w: half,
      h: BTN_H,
      onActivate: () => {
        app.audio.play('ui_click');
        openExport(app);
      },
    });
    this.importBtn = uiButton({
      id: 'settings.import',
      label: 'IMPORT SAVE',
      textScale: 1,
      x: COL_R + half + 4,
      y: ROW_Y[3],
      w: COL_W - half - 4,
      h: BTN_H,
      onActivate: () => {
        app.audio.play('ui_click');
        openImport(app, () => this.syncDrafts());
      },
    });
    this.buttons = [this.back, ...this.sliders.map((s) => s.b), ...this.toggles.map((t) => t.b), this.exportBtn, this.importBtn];
    this.menu = new MenuNav(() => this.buttons);
    this.menu.onMove = () => app.audio.play('menu_move');
  }

  enter(): void {
    this.time = 0;
    this.inRun = this.app.scenes.find('run') !== undefined;
    // Importing replaces the run save: only from the title (a live run would overwrite it).
    this.importBtn.enabled = !this.inRun;
    this.syncDrafts();
    this.menu.set(this.sliders[0]!.b);
  }

  /** Opens IMPORT SAVE right away (the title's first-launch hint in the home-screen app: nav.importSave). */
  startImport(): void {
    if (!this.importBtn.enabled) return;
    openImport(this.app, () => this.syncDrafts());
  }

  private syncDrafts(): void {
    const v = this.app.settings.value;
    for (const s of this.sliders) s.draft = v[s.def.key];
  }

  private close(): void {
    this.app.audio.play('ui_back');
    this.app.nav.back();
  }

  private commit(patch: Partial<Settings>): void {
    this.app.settings.update(patch);
  }

  private nudge(def: SliderDef, dir: -1 | 1): void {
    const cur = this.app.settings.value[def.key];
    const next = snap(cur + dir * def.step, def);
    if (next === cur) return;
    this.app.audio.play('menu_move');
    this.commit({ [def.key]: next } as Partial<Settings>);
    this.syncDrafts();
  }

  /** The value under x on a slider row's track (snapped), or null when x is on the label. */
  private valueAt(def: SliderDef, b: UiButton, downX: number, x: number): number | null {
    const t0 = b.x + LABEL_W;
    const t1 = b.x + b.w - VALUE_W;
    if (downX < t0 - 6) return null;
    const f = Math.max(0, Math.min(1, (x - t0) / (t1 - t0)));
    return snap(def.min + f * (def.max - def.min), def);
  }

  private tapSlider(s: { def: SliderDef; b: UiButton; draft: number; wasHeld: boolean }): void {
    const v = this.valueAt(s.def, s.b, s.b.downX, s.b.curX);
    s.wasHeld = false;
    if (v === null) return;
    s.draft = v;
    if (v !== this.app.settings.value[s.def.key]) {
      this.commit({ [s.def.key]: v } as Partial<Settings>);
      this.app.audio.play(s.def.key === 'sfxVolume' ? 'ui_click' : 'menu_move');
    }
  }

  private flip(def: ToggleDef): void {
    this.app.audio.play('ui_click');
    this.commit({ [def.key]: !this.app.settings.value[def.key] } as Partial<Settings>);
  }

  onKey(code: string): boolean {
    if (code === 'Escape' || code === 'Backspace') {
      this.close();
      return true;
    }
    return this.menu.onKey(code);
  }

  update(dt: number, _input: InputState): void {
    this.time += dt;
    tickButtons(this.buttons, dt);
    this.app.particles.update(dt);
    for (const s of this.sliders) {
      const b = s.b;
      if (b.held > 0) {
        // Only a press that started on (or near) the track moves the knob; the label is just a label.
        const v = this.valueAt(s.def, b, b.downX, b.curX);
        if (v !== null) {
          if (v !== s.draft) {
            s.draft = v;
            if (s.def.key !== 'buttonScale') this.app.audio.play('menu_move');
            // Hear the volume while sliding (committed on release).
            if (s.def.key === 'masterVolume' || s.def.key === 'musicVolume' || s.def.key === 'sfxVolume') {
              const cur = this.app.settings.value;
              this.app.audio.setVolumes({
                master: s.def.key === 'masterVolume' ? v : cur.masterVolume,
                music: s.def.key === 'musicVolume' ? v : cur.musicVolume,
                sfx: s.def.key === 'sfxVolume' ? v : cur.sfxVolume,
              });
            }
          }
        }
        s.wasHeld = true;
      } else if (s.wasHeld) {
        s.wasHeld = false;
        if (s.draft !== this.app.settings.value[s.def.key]) {
          this.commit({ [s.def.key]: s.draft } as Partial<Settings>);
          if (s.def.key === 'sfxVolume') this.app.audio.play('ui_click');
        }
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.inRun) {
      // Over the paused run: a deep dim (the run shows faintly behind).
      ctx.globalAlpha = Math.min(0.97, 0.5 + this.time * 4);
      ctx.fillStyle = '#05060b';
      ctx.fillRect(0, 0, GAME_W, GAME_H);
      ctx.globalAlpha = 1;
    } else {
      ctx.drawImage(pageBackdrop(), 0, 0);
    }
    drawPageHeader(ctx, 'SETTINGS');
    const { text: status, warn } = saveStatus(this.app.save.meta.persistent, this.app.pwa.platform.safariTab, this.app.pwa.persisted);
    drawText(ctx, status, GAME_W - 6 - measureText(status), 14, warn ? WARN : NOTE);
    for (const s of this.sliders) this.drawSlider(ctx, s.def, s.b, s.b.held > 0 ? s.draft : this.app.settings.value[s.def.key]);
    for (const t of this.toggles) this.drawToggle(ctx, t.def, t.b);
    drawMenuButtons(ctx, [this.back, this.exportBtn, this.importBtn]);
    const note = this.inRun
      ? 'IMPORT FROM THE TITLE SCREEN (IT REPLACES THE SAVED RUN).'
      : 'SAFARI AND THE HOME-SCREEN APP KEEP SEPARATE SAVES: EXPORT IN ONE, IMPORT IN THE OTHER';
    // One line along the bottom edge, under the last row.
    drawText(ctx, note, Math.round((GAME_W - measureText(note)) / 2), ROW_Y[4] + BTN_H + 2, NOTE);
    this.menu.draw(ctx, this.time, this.app.input.lastDevice === 'keyboard');
  }

  private rowPanel(ctx: CanvasRenderingContext2D, b: UiButton): void {
    const pressed = b.held > 0;
    drawPanel(ctx, b.x, b.y, b.w, b.h - 1, pressed ? '#1d2438' : '#141a2a', pressed ? '#8a98c4' : '#46537a', '#1f2740');
    ctx.fillStyle = UI.shadow;
    ctx.fillRect(b.x + 1, b.y + b.h - 1, b.w - 2, 1);
  }

  private drawSlider(ctx: CanvasRenderingContext2D, def: SliderDef, b: UiButton, v: number): void {
    this.rowPanel(ctx, b);
    const cy = b.y + Math.round((b.h - 1) / 2);
    drawText(ctx, def.label, b.x + 6, cy - 2, LABEL);
    const t0 = b.x + LABEL_W;
    const t1 = b.x + b.w - VALUE_W;
    const f = (v - def.min) / (def.max - def.min);
    const kx = Math.round(t0 + f * (t1 - t0));
    ctx.fillStyle = '#0b0f18';
    ctx.fillRect(t0 - 1, cy - 2, t1 - t0 + 3, 5);
    ctx.fillStyle = '#c98a1e';
    ctx.fillRect(t0, cy - 1, kx - t0, 3);
    ctx.fillStyle = UI.accent;
    ctx.fillRect(t0, cy - 1, kx - t0, 1);
    // Tick marks at quarters.
    ctx.fillStyle = '#2a3350';
    for (let i = 1; i < 4; i++) ctx.fillRect(Math.round(t0 + (i * (t1 - t0)) / 4), cy + 3, 1, 2);
    // Knob.
    const pressed = b.held > 0;
    ctx.fillStyle = UI.shadow;
    ctx.fillRect(kx - 2, cy - 5, 6, 12);
    ctx.fillStyle = pressed ? '#ffffff' : '#e9edf7';
    ctx.fillRect(kx - 3, cy - 6, 6, 11);
    ctx.fillStyle = pressed ? UI.accent : '#8e98b5';
    ctx.fillRect(kx - 2, cy - 5, 4, 1);
    ctx.fillRect(kx - 1, cy - 2, 2, 3);
    const text = def.key === 'shake' && v === 0 ? 'OFF' : `${Math.round(v * 100)}%`;
    drawText(ctx, text, b.x + b.w - 5 - measureText(text), cy - 2, VALUE);
  }

  private drawToggle(ctx: CanvasRenderingContext2D, def: ToggleDef, b: UiButton): void {
    this.rowPanel(ctx, b);
    const cy = b.y + Math.round((b.h - 1) / 2);
    drawText(ctx, def.label, b.x + 6, cy - 2, LABEL);
    const on = this.app.settings.value[def.key];
    const sx = b.x + b.w - 5 - 88;
    const sw = 44;
    for (let i = 0; i < 2; i++) {
      const lit = (i === 1) === on;
      const x = sx + i * sw;
      drawPanel(ctx, x, b.y + 4, sw - 2, b.h - 9, lit ? '#2b3553' : '#0b0f18', lit ? UI.borderHot : '#2a3350', lit ? '#44527c' : null);
      const label = i === 0 ? def.off : def.on;
      drawText(ctx, label, Math.round(x + (sw - 2 - measureText(label)) / 2), cy - 2, lit ? SEG_ON : SEG_OFF);
    }
  }

  describe(): Record<string, unknown> {
    const status = saveStatus(this.app.save.meta.persistent, this.app.pwa.platform.safariTab, this.app.pwa.persisted).text;
    return { ...this.app.settings.value, importEnabled: this.importBtn.enabled, status };
  }
}

/**
 * The save status line (top-right of Settings, polish batch 3): nothing kept at all; a Safari tab (WebKit may wipe a
 * site's storage after ~7 days without a visit, unless `navigator.storage.persist()` was granted); else saved here.
 */
export function saveStatus(persistent: boolean, safariTab: boolean, persisted: boolean | null): { text: string; warn: boolean } {
  if (!persistent) return { text: "THIS BROWSER CAN'T KEEP SAVES", warn: true };
  if (safariTab && persisted !== true) return { text: 'SAVED IN SAFARI · MAY BE CLEARED', warn: true };
  if (safariTab) return { text: 'SAVED IN SAFARI · PROTECTED', warn: false };
  return { text: 'SAVED ON THIS DEVICE', warn: false };
}

/** Rounds to the slider's step and clamps (no float drift: 0.8 stays 0.8). */
function snap(v: number, def: { min: number; max: number; step: number }): number {
  const n = Math.round((v - def.min) / def.step);
  const out = def.min + n * def.step;
  return Math.max(def.min, Math.min(def.max, Math.round(out * 1000) / 1000));
}
