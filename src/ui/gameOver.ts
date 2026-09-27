/**
 * Game over (Phase 4B, overlay scene 'over'): over the frozen run after the death animation — what took her
 * (the enemy / boss with its sprite, or spikes / fire / a bomb), the floor and chapter, the time, the character
 * and seed, the items she carried; RETRY SEED (the same seed again — a practice run), NEW RUN (character
 * select), TITLE. The run save was already cleared when she died.
 */

import { BOSSES, CHAPTERS, ENEMIES } from '../content/registry';
import { UI } from '../content/sprites/palette';
import { FLAME_SPRITE, SPIKES_SPRITE } from '../content/sprites/obstacles';
import { BOMB_SPRITE } from '../content/sprites/pickups';
import type { InputState } from '../engine/inputState';
import { GAME_H, GAME_W } from '../engine/screen';
import { formatSeed, numericSeedLabel } from '../meta/seedCode';
import { drawText, drawTextCentered, measureText, type TextStyle } from '../render/font';
import { drawPanel } from '../render/pixel';
import { getFrame } from '../render/sprites';
import { itemIcon } from '../render/worldRenderer';
import { DMG_EXPLOSION, DMG_FIRE, DMG_SPIKES } from '../sim/combat';
import type { RunSeedInfo } from '../sim/run/types';
import type { SpriteDef } from '../sim/types';
import type { App, RunEndInfo } from './app';
import type { Scene } from './scene';
import { MenuNav, drawMenuButtons, tickButtons, uiButton, type UiButton } from './widgets';

const TITLE: TextStyle = { color: '#b9d6f0', shadow: '#0a1830', outline: '#07080d', scale: 3 };
const SUB: TextStyle = { color: '#8e98b5', shadow: UI.shadow };
const DIM: TextStyle = { color: UI.textDim };
const BY: TextStyle = { color: '#ff9a8a', shadow: '#2a0a08', scale: 2 };
const INFO: TextStyle = { color: UI.text, shadow: UI.shadow };
const TAG: TextStyle = { color: '#8fe0a0' };

const PANEL_X = 42;
const PANEL_W = GAME_W - 84;

/** The seed a retry replays: the same code, as practice (a daily replay stays a daily, unscored). */
export function retrySeed(s: RunSeedInfo | undefined, code: string): RunSeedInfo {
  if (s?.kind === 'daily') return { code: s.code, kind: 'daily', date: s.date, scored: false };
  return { code, kind: 'custom' };
}

export class GameOverScene implements Scene {
  readonly name = 'over';
  readonly overlay = true;
  readonly wantsSticks = false;
  readonly toastsAtTop = true;
  readonly buttons: UiButton[];
  private readonly app: App;
  private readonly info: RunEndInfo;
  private readonly menu: MenuNav;
  private time = 0;
  private killerName = '';
  private killerSprite: SpriteDef | null = null;
  private killerFrames: readonly number[] = [0];
  private killerFps = 4;
  private lines: string[] = [];
  private items: string[] = [];
  private tag = '';

  constructor(app: App, info: RunEndInfo) {
    this.app = app;
    this.info = info;
    const sim = info.sim;
    const d = sim.run?.data;
    const code = d?.seedInfo?.code ?? '';
    const retry = uiButton({
      id: 'over.retry',
      label: 'RETRY SEED',
      kind: 'primary',
      x: 12,
      y: 158,
      w: 116,
      h: 28,
      enabled: !!d,
      onActivate: () => {
        if (!d) return;
        app.audio.play('menu_select');
        app.nav.startRun({ character: d.character, seed: retrySeed(d.seedInfo, code || numericSeedLabel(d.seed)), simSeed: d.seedInfo ? undefined : d.seed });
      },
    });
    const newRun = uiButton({
      id: 'over.newRun',
      label: 'NEW RUN',
      x: 134,
      y: 158,
      w: 116,
      h: 28,
      onActivate: () => {
        app.audio.play('ui_click');
        app.nav.title();
        app.nav.characters(null);
      },
    });
    const title = uiButton({
      id: 'over.title',
      label: 'TITLE',
      x: 256,
      y: 158,
      w: 116,
      h: 28,
      onActivate: () => {
        app.audio.play('ui_back');
        app.nav.title();
      },
    });
    this.buttons = [retry, newRun, title];
    this.menu = new MenuNav(() => this.buttons);
    this.menu.onMove = () => app.audio.play('menu_move');
    for (const b of this.buttons) b.visible = false;
    this.describeRun();
  }

  private describeRun(): void {
    const sim = this.info.sim;
    const w = sim.world;
    const id = w.killer;
    const enemy = id ? ENEMIES.get(id) : undefined;
    const boss = id ? BOSSES.get(id) : undefined;
    const sprite = boss?.sprite ?? enemy?.sprite;
    if (boss || enemy) {
      this.killerName = (boss?.name ?? enemy?.name ?? id).toUpperCase();
      this.killerSprite = sprite && typeof sprite !== 'string' ? sprite : null;
      const idle = this.killerSprite?.anims?.idle;
      if (idle && idle.frames.length) {
        this.killerFrames = idle.frames;
        this.killerFps = Math.max(1, idle.fps);
      }
    } else if (w.killedBy === DMG_SPIKES) {
      this.killerName = 'SHARP SPIKES';
      this.killerSprite = SPIKES_SPRITE;
    } else if (w.killedBy === DMG_FIRE) {
      this.killerName = 'A BRAZIER';
      this.killerSprite = FLAME_SPRITE;
    } else if (w.killedBy === DMG_EXPLOSION) {
      this.killerName = 'HER OWN BOMB';
      this.killerSprite = BOMB_SPRITE;
    } else {
      this.killerName = 'THE STORM ITSELF';
    }
    const d = sim.run?.data;
    const p = w.player;
    if (d) {
      const ch = CHAPTERS.get(d.chapter);
      this.lines.push(`FLOOR ${d.floor} · ${(ch?.name ?? d.chapter).toUpperCase()} · ${formatTime(d.time)}`);
      const s = d.seedInfo;
      this.lines.push(`${p.character.name.toUpperCase()} · SEED ${s ? formatSeed(s.code) : numericSeedLabel(d.seed)}`);
      this.tag = !s ? '' : s.kind === 'daily' ? (s.scored ? "TODAY'S DAILY · SCORE RECORDED" : 'DAILY PRACTICE') : s.kind === 'custom' ? 'PRACTICE RUN' : '';
    }
    const inv = p.inv;
    this.items = [...inv.passives];
    if (inv.active) this.items.unshift(inv.active.id);
    this.items.push(...inv.trinkets);
  }

  enter(): void {
    this.time = 0;
    this.menu.set(this.buttons[0]!.enabled ? this.buttons[0]! : this.buttons[1]!);
  }

  onKey(code: string): boolean {
    if (code === 'Escape') {
      this.buttons[2]!.onActivate?.();
      return true;
    }
    if (code === 'KeyR' && this.buttons[0]!.enabled) {
      this.buttons[0]!.onActivate?.();
      return true;
    }
    if (code === 'KeyN') {
      this.buttons[1]!.onActivate?.();
      return true;
    }
    return this.menu.onKey(code);
  }

  update(dt: number, _input: InputState): void {
    this.time += dt;
    // The buttons appear (and only then take taps) once the card has faded in.
    if (this.time > 0.35 && !this.buttons[1]!.visible) for (const b of this.buttons) b.visible = true;
    tickButtons(this.buttons, dt);
    this.app.particles.update(dt);
  }

  render(ctx: CanvasRenderingContext2D): void {
    const a = Math.min(1, this.time * 2.5);
    ctx.globalAlpha = a * 0.92;
    ctx.fillStyle = '#04050a';
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    ctx.globalAlpha = a;
    const drop = Math.round((1 - Math.min(1, this.time * 3)) * -10);
    drawTextCentered(ctx, 'THE RAIN TAKES YOU', GAME_W / 2, 18 + drop, TITLE);
    drawTextCentered(ctx, 'SOAKED THROUGH... BUT THE DRAINS WILL STILL BE THERE.', GAME_W / 2, 38, SUB);

    // The killer.
    const y = 48;
    drawPanel(ctx, PANEL_X, y, PANEL_W, 58, '#10141f', '#2e3650', '#1a2031');
    drawPanel(ctx, PANEL_X + 6, y + 6, 46, 46, '#0b0f18', '#3a2430');
    const ks = this.killerSprite;
    if (ks) {
      const f = this.killerFrames[Math.floor(this.time * this.killerFps) % this.killerFrames.length] ?? 0;
      const img = getFrame(ks, f);
      const k = img.width > 40 || img.height > 40 ? Math.min(40 / img.width, 40 / img.height) : img.width <= 20 && img.height <= 20 ? 2 : 1;
      const w = Math.round(img.width * k);
      const h = Math.round(img.height * k);
      ctx.drawImage(img, PANEL_X + 29 - (w >> 1), y + 29 - (h >> 1), w, h);
    } else {
      drawTextCentered(ctx, '?', PANEL_X + 29, y + 23, BY);
    }
    const tx = PANEL_X + 60;
    drawText(ctx, 'TAKEN BY', tx, y + 7, DIM);
    drawText(ctx, this.killerName, tx, y + 16, BY);
    if (this.lines[0]) drawText(ctx, this.lines[0], tx, y + 32, INFO);
    if (this.lines[1]) drawText(ctx, this.lines[1], tx, y + 41, INFO);
    if (this.tag) drawText(ctx, this.tag, PANEL_X + PANEL_W - 6 - measureText(this.tag), y + 7, TAG);

    // What she carried.
    const iy = 111;
    const n = this.items.length;
    drawText(ctx, n ? `ITEMS CARRIED · ${n}` : 'SHE CARRIED NOTHING BUT HOPE', PANEL_X, iy, DIM);
    const per = Math.floor(PANEL_W / 16);
    for (let i = 0; i < Math.min(n, per * 2); i++) {
      ctx.drawImage(getFrame(itemIcon(this.items[i]!), 0), PANEL_X + (i % per) * 16, iy + 9 + Math.floor(i / per) * 16);
    }
    if (n > per * 2) drawText(ctx, `+${n - per * 2}`, PANEL_X + PANEL_W - 14, iy + 30, DIM);
    ctx.globalAlpha = 1;
    drawMenuButtons(ctx, this.buttons);
    this.menu.draw(ctx, this.time, this.app.input.lastDevice === 'keyboard');
  }

  describe(): Record<string, unknown> {
    return { killer: this.info.sim.world.killer, killerName: this.killerName, lines: [...this.lines], items: this.items.length, tag: this.tag };
  }
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r < 10 ? '0' : ''}${r}`;
}
