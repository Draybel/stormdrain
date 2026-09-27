/**
 * The hidden debug menu (Phase 2D): a canvas-drawn overlay over the (frozen) run.
 * Open: Backquote on desktop, or tap the PAUSED title in the pause overlay 5 times on touch.
 *
 * Tabs:
 * - ITEMS  — every item as a scrollable two-column list (drag / flick / wheel / arrows). Tap one to
 *            put it on a pedestal next to Wren, or (mode toggle) to give it straight away.
 * - FOES   — every enemy; tap to spawn one across the room (toggle: force a champion).
 * - CHEATS — god mode, full heal, +10 coins / bombs / keys, clear room, start a wave, endless waves,
 *            perf overlay, +5 random items, drop all items, charge the active; floor runs: skip floor,
 *            reveal map, go to the boss, next curse; the training yard; a new run.
 * Keyboard: 1/2/3 or Tab switch tabs, arrows move the cursor, Enter picks, Esc / ` close.
 * Everything it does goes through DebugActions (also exposed as window.__SD.debug).
 */

import type { InputState } from '../engine/inputState';
import { GAME_H, GAME_W } from '../engine/screen';
import { UI } from '../content/sprites/palette';
import { drawText, drawTextCentered, measureText, type TextStyle } from '../render/font';
import { drawPanel } from '../render/pixel';
import { getFrame } from '../render/sprites';
import type { EnemyDef, ItemDef, SpriteDef } from '../sim/types';
import type { App } from '../ui/app';
import type { Scene } from '../ui/scene';
import { drawMenuButtons, tickButtons, uiButton, type UiButton } from '../ui/widgets';
import type { DebugActions } from './actions';

const TITLE: TextStyle = { color: '#b8f0a8', shadow: UI.shadow };
const NAME: TextStyle = { color: UI.text, shadow: UI.shadow };
const SUB: TextStyle = { color: UI.textDim };
const TOAST: TextStyle = { color: '#fff3c4', shadow: UI.shadow };
const HINT: TextStyle = { color: '#5c6788' };

type Tab = 'items' | 'foes' | 'cheats';
const TABS: readonly Tab[] = ['items', 'foes', 'cheats'];

// Layout (game px).
const PX = 6;
const PY = 4;
const PW = GAME_W - 12;
const PH = GAME_H - 8;
const LIST_X = PX + 6;
const LIST_Y = PY + 34;
const LIST_W = PW - 18;
const LIST_H = PH - 50;
const COLS = 2;
const CHEAT_COLS = 4;
const ROW_H = 24;
const CELL_W = Math.floor((LIST_W - 4) / COLS);
const QUALITY = ['Q0', 'Q1', 'Q2', 'Q3', 'Q4'] as const;
const QUALITY_COLOR = ['#8e98b5', '#c9d3f0', '#8fe0a0', '#8fc8ff', '#ffd76a'] as const;

interface Row {
  id: string;
  name: string;
  sub: string;
  icon: SpriteDef | null;
  frame: number;
  color: string;
}

function itemRow(d: ItemDef): Row {
  const kind = d.tags.includes('starter-attack')
    ? 'ATTACK'
    : d.tags.includes('modifier')
      ? 'MODIFIER'
      : d.tags.includes('weird')
        ? 'WEIRD'
        : d.tags.includes('familiar')
          ? 'FAMILIAR'
          : d.kind.toUpperCase();
  return {
    id: d.id,
    name: d.name.toUpperCase(),
    sub: `${QUALITY[d.quality]} · ${kind}`,
    icon: typeof d.sprite === 'string' ? null : d.sprite,
    frame: 0,
    color: QUALITY_COLOR[d.quality],
  };
}

function enemyRow(d: EnemyDef): Row {
  const sprite = typeof d.sprite === 'string' ? null : d.sprite;
  return {
    id: d.id,
    name: d.name.toUpperCase(),
    sub: `HP ${d.hp}${d.flying ? ' · FLYING' : ''}`,
    icon: sprite,
    frame: sprite?.anims?.idle?.frames[0] ?? 0,
    color: '#e0515a',
  };
}

interface Cheat {
  label: () => string;
  run: () => string;
}

export class DebugMenu implements Scene {
  readonly name = 'debug';
  readonly overlay = true;
  readonly wantsSticks = false;
  readonly buttons: UiButton[];
  private readonly app: App;
  private readonly act: DebugActions;
  private tab: Tab = 'items';
  /** Items tab: true = give directly, false = spawn on a pedestal. */
  private give = false;
  /** Foes tab: force a champion. */
  private champion = false;
  private readonly itemRows: Row[];
  private readonly foeRows: Row[];
  private readonly scroll: Record<'items' | 'foes', number> = { items: 0, foes: 0 };
  private readonly sel: Record<Tab, number> = { items: 0, foes: 0, cheats: 0 };
  private vel = 0;
  private pressing = false;
  private pressScroll = 0;
  private lastScroll = 0;
  private toast = '';
  private toastT = 0;
  private time = 0;
  private readonly list: UiButton;
  private readonly tabButtons: UiButton[];
  private readonly mode: UiButton;
  private readonly close: UiButton;
  private readonly cheatButtons: UiButton[];
  private readonly cheats: Cheat[];

  constructor(app: App, act: DebugActions) {
    this.app = app;
    this.act = act;
    this.itemRows = act.items().map(itemRow);
    this.foeRows = act.enemies().map(enemyRow);

    this.list = uiButton({ id: 'debug.list', x: LIST_X, y: LIST_Y, w: LIST_W, h: LIST_H, pad: 0, draggable: true });
    this.list.onActivate = () => this.tapList(this.list.curX, this.list.curY);
    this.tabButtons = TABS.map((t, i) =>
      uiButton({
        id: `debug.tab.${t}`,
        label: t === 'foes' ? 'FOES' : t.toUpperCase(),
        x: PX + 6 + i * 74,
        y: PY + 5,
        w: 70,
        h: 24,
        onActivate: () => this.setTab(t),
      }),
    );
    this.mode = uiButton({ id: 'debug.mode', x: PX + 6 + 3 * 74, y: PY + 5, w: 104, h: 24, textScale: 1, onActivate: () => this.toggleMode() });
    this.close = uiButton({ id: 'debug.close', label: 'X', x: PX + PW - 30, y: PY + 5, w: 24, h: 24, onActivate: () => this.closeMenu() });

    const a = act;
    const onOff = (b: boolean): string => (b ? 'ON' : 'OFF');
    this.cheats = [
      { label: () => `GOD MODE: ${onOff(a.isGod())}`, run: () => `GOD MODE ${onOff(a.god())}` },
      { label: () => 'FULL HEAL', run: () => (a.fullHeal(), 'HEALED') },
      { label: () => 'CLEAR ROOM', run: () => (a.clearRoom(), 'ROOM CLEARED') },
      { label: () => '+10 COINS', run: () => (a.addCoins(10), '+10 COINS') },
      { label: () => '+10 BOMBS', run: () => (a.addBombs(10), '+10 BOMBS') },
      { label: () => '+10 KEYS', run: () => (a.addKeys(10), '+10 KEYS') },
      { label: () => 'START WAVE', run: () => (a.wave() > 0 ? 'WAVE CALLED' : 'A WAVE IS ALREADY ON') },
      { label: () => `AUTO WAVES: ${onOff(a.isAutoWaves())}`, run: () => `ENDLESS WAVES ${onOff(a.autoWaves())}` },
      { label: () => `PERF: ${onOff(a.isPerf())}`, run: () => `PERF OVERLAY ${onOff(a.perf())}` },
      { label: () => '+5 RANDOM ITEMS', run: () => `GAVE ${a.giveRandom(5).length} ITEMS` },
      { label: () => 'DROP ALL ITEMS', run: () => (a.resetItems(), 'ITEMS DROPPED') },
      { label: () => 'CHARGE ACTIVE', run: () => (a.chargeActive(), 'ROOM CLEAR COUNTED') },
      // Floor runs (Phase 3A).
      {
        label: () => 'SKIP FLOOR',
        run: () => {
          const f = a.skipFloor();
          return f ? `FLOOR ${f}` : 'NOT IN A RUN';
        },
      },
      { label: () => 'REVEAL MAP', run: () => (a.revealMap() ? 'MAP REVEALED' : 'NOT IN A RUN') },
      { label: () => 'GO TO BOSS', run: () => (a.teleport() ? 'BOSS ROOM' : 'NOT IN A RUN') },
      {
        label: () => 'NEXT CURSE',
        run: () => (a.sim?.run ? `CURSE: ${(a.nextCurse() ?? 'none').toUpperCase()}` : 'NOT IN A RUN'),
      },
      { label: () => 'TRAINING YARD', run: () => (a.yard(), 'TO THE YARD') },
      { label: () => 'NEW RUN', run: () => (a.newRun(), 'NEW RUN') },
      // Bosses (Phase 3B): pick one, then fight it right here.
      { label: () => `BOSS: ${a.bossName()}`, run: () => `BOSS: ${a.nextBoss()}` },
      { label: () => 'FIGHT BOSS', run: () => (a.bossFight() ? `${a.bossName()}!` : 'FINISH THIS FIGHT FIRST') },
    ];
    // 4 columns × 5 rows of 24 px buttons fit the list area.
    const cw = Math.floor((LIST_W - 6 * (CHEAT_COLS - 1) - 6) / CHEAT_COLS);
    this.cheatButtons = this.cheats.map((c, i) =>
      uiButton({
        id: `debug.cheat.${i}`,
        label: c.label(),
        x: LIST_X + (i % CHEAT_COLS) * (cw + 6),
        y: LIST_Y + 2 + Math.floor(i / CHEAT_COLS) * 26,
        w: cw,
        h: 24,
        textScale: 1,
        onActivate: () => this.runCheat(i),
      }),
    );
    // The list first: tabs and buttons listed later win the hit test.
    this.buttons = [this.list, ...this.tabButtons, this.mode, this.close, ...this.cheatButtons];
    this.setTab('items');
  }

  enter(): void {
    this.time = 0;
    this.app.audio.play('ui_click');
  }

  private closeMenu(): void {
    this.app.audio.play('ui_back');
    this.app.nav.debug();
  }

  private rows(): Row[] {
    return this.tab === 'foes' ? this.foeRows : this.itemRows;
  }

  private setTab(t: Tab): void {
    this.tab = t;
    this.vel = 0;
    const listTab = t !== 'cheats';
    this.list.visible = listTab;
    for (const b of this.cheatButtons) b.visible = !listTab;
    for (let i = 0; i < TABS.length; i++) this.tabButtons[i]!.kind = TABS[i] === t ? 'primary' : 'secondary';
    this.mode.visible = listTab;
    this.refreshLabels();
  }

  private toggleMode(): void {
    if (this.tab === 'items') this.give = !this.give;
    else if (this.tab === 'foes') this.champion = !this.champion;
    this.app.audio.play('ui_click');
    this.refreshLabels();
  }

  private refreshLabels(): void {
    this.mode.label = this.tab === 'foes' ? `CHAMPION: ${this.champion ? 'ON' : 'OFF'}` : this.give ? 'MODE: GIVE NOW' : 'MODE: PEDESTAL';
    for (let i = 0; i < this.cheats.length; i++) this.cheatButtons[i]!.label = this.cheats[i]!.label();
  }

  private say(text: string): void {
    this.toast = text;
    this.toastT = 1.6;
  }

  private runCheat(i: number): void {
    this.sel.cheats = i;
    this.say(this.cheats[i]!.run());
    this.app.audio.play('ui_click');
    this.refreshLabels();
  }

  private maxScroll(): number {
    const rows = Math.ceil(this.rows().length / COLS);
    return Math.max(0, rows * ROW_H - LIST_H + 4);
  }

  /** Row index under a point of the list (game px), or -1. */
  private indexAt(x: number, y: number): number {
    if (this.tab === 'cheats') return -1;
    const lx = x - LIST_X - 2;
    const ly = y - LIST_Y - 2 + this.scroll[this.tab];
    if (lx < 0 || ly < 0 || lx >= CELL_W * COLS) return -1;
    const i = Math.floor(ly / ROW_H) * COLS + Math.floor(lx / CELL_W);
    return i < this.rows().length ? i : -1;
  }

  private tapList(x: number, y: number): void {
    const i = this.indexAt(x, y);
    if (i >= 0) this.pick(i);
  }

  private pick(i: number): void {
    const row = this.rows()[i];
    if (!row || this.tab === 'cheats') return;
    this.sel[this.tab] = i;
    let ok: boolean;
    if (this.tab === 'items') {
      ok = this.give ? this.act.giveItem(row.id) : this.act.spawnItem(row.id);
      this.say(ok ? `${this.give ? 'GAVE' : 'SPAWNED'} ${row.name}` : 'NO RUN TO PUT IT IN');
    } else {
      ok = this.act.spawnEnemy(row.id, this.champion);
      this.say(ok ? `${this.champion ? 'CHAMPION ' : ''}${row.name} SPAWNED` : 'TOO MANY ENEMIES');
    }
    this.app.audio.play(ok ? 'ui_click' : 'ui_back');
  }

  /** Keeps the keyboard cursor's row on screen. */
  private reveal(i: number): void {
    if (this.tab === 'cheats') return;
    const top = Math.floor(i / COLS) * ROW_H;
    const s = this.scroll[this.tab];
    if (top < s) this.scroll[this.tab] = top;
    else if (top + ROW_H > s + LIST_H - 4) this.scroll[this.tab] = top + ROW_H - LIST_H + 4;
    this.vel = 0;
  }

  onKey(code: string): boolean {
    switch (code) {
      case 'Escape':
        this.closeMenu();
        return true;
      case 'Digit1':
      case 'Digit2':
      case 'Digit3':
        this.setTab(TABS[Number(code.slice(5)) - 1]!);
        return true;
      case 'Tab':
        this.setTab(TABS[(TABS.indexOf(this.tab) + 1) % TABS.length]!);
        return true;
      case 'KeyM':
        this.toggleMode();
        return true;
      case 'Enter':
      case 'Space':
        if (this.tab === 'cheats') this.runCheat(this.sel.cheats);
        else this.pick(this.sel[this.tab]);
        return true;
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown': {
        const cols = this.tab === 'cheats' ? CHEAT_COLS : COLS;
        const n = this.tab === 'cheats' ? this.cheats.length : this.rows().length;
        const step = code === 'ArrowLeft' ? -1 : code === 'ArrowRight' ? 1 : code === 'ArrowUp' ? -cols : cols;
        const next = Math.max(0, Math.min(n - 1, this.sel[this.tab] + step));
        this.sel[this.tab] = next;
        this.reveal(next);
        return true;
      }
      case 'PageUp':
      case 'PageDown':
        if (this.tab !== 'cheats') this.scrollBy(code === 'PageUp' ? -LIST_H + ROW_H : LIST_H - ROW_H);
        return true;
      default:
        return false;
    }
  }

  onWheel(dy: number): void {
    if (this.tab === 'cheats') return;
    this.scrollBy(dy * 0.35);
  }

  private scrollBy(d: number): void {
    if (this.tab === 'cheats') return;
    this.vel = 0;
    this.scroll[this.tab] = Math.max(0, Math.min(this.maxScroll(), this.scroll[this.tab] + d));
  }

  update(dt: number, _input: InputState): void {
    this.time += dt;
    tickButtons(this.buttons, dt);
    if (this.toastT > 0) this.toastT -= dt;
    if (this.tab === 'cheats') return;
    const l = this.list;
    const tab = this.tab;
    const max = this.maxScroll();
    if (l.held > 0) {
      if (!this.pressing) {
        this.pressing = true;
        this.pressScroll = this.scroll[tab];
        this.lastScroll = this.scroll[tab];
        this.vel = 0;
      }
      if (l.dragged) {
        const s = Math.max(-12, Math.min(max + 12, this.pressScroll - (l.curY - l.downY)));
        this.vel = (s - this.lastScroll) / dt;
        this.lastScroll = s;
        this.scroll[tab] = s;
      }
      return;
    }
    if (this.pressing) {
      this.pressing = false;
      if (!l.dragged) this.vel = 0;
    }
    // Flick momentum with friction, then settle back inside the bounds.
    let s = this.scroll[tab];
    if (Math.abs(this.vel) > 1) {
      s += this.vel * dt;
      this.vel *= Math.exp(-5 * dt);
    } else {
      this.vel = 0;
    }
    if (s < 0) {
      s += (0 - s) * Math.min(1, dt * 14);
      if (s > -0.5) s = 0;
      this.vel = 0;
    } else if (s > max) {
      s += (max - s) * Math.min(1, dt * 14);
      if (s < max + 0.5) s = max;
      this.vel = 0;
    }
    this.scroll[tab] = s;
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.globalAlpha = Math.min(0.8, this.time * 8);
    ctx.fillStyle = '#04050a';
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    ctx.globalAlpha = 1;
    drawPanel(ctx, PX, PY, PW, PH, '#121826', '#4f8a5a', '#1e2a2a');
    drawMenuButtons(ctx, this.tabButtons);
    if (this.mode.visible) drawMenuButtons(ctx, [this.mode]);
    drawMenuButtons(ctx, [this.close]);
    if (this.tab === 'cheats') {
      drawMenuButtons(ctx, this.cheatButtons);
      const b = this.cheatButtons[this.sel.cheats];
      if (b) this.cursor(ctx, b.x - 1, b.y - 1, b.w + 2, b.h + 1);
    } else {
      this.drawList(ctx);
    }
    // Footer: toast, or a hint.
    const fy = PY + PH - 11;
    if (this.toastT > 0) {
      ctx.globalAlpha = Math.min(1, this.toastT * 3);
      drawTextCentered(ctx, this.toast, GAME_W / 2, fy, TOAST);
      ctx.globalAlpha = 1;
    } else {
      drawText(ctx, 'DEBUG', PX + 8, fy, TITLE);
      const hint = this.tab === 'cheats' ? 'TAP A CHEAT' : this.tab === 'items' ? 'DRAG TO SCROLL · TAP AN ITEM' : 'DRAG TO SCROLL · TAP A FOE';
      drawText(ctx, hint, PX + PW - 8 - measureText(hint), fy, HINT);
    }
  }

  private cursor(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    if (Math.floor(this.time * 3) % 2 === 1) return;
    ctx.strokeStyle = '#b8f0a8';
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, w - 1, h - 1);
  }

  private drawList(ctx: CanvasRenderingContext2D): void {
    const rows = this.rows();
    const tab = this.tab as 'items' | 'foes';
    const s = this.scroll[tab];
    ctx.fillStyle = '#0b0f18';
    ctx.fillRect(LIST_X, LIST_Y, LIST_W, LIST_H);
    ctx.save();
    ctx.beginPath();
    ctx.rect(LIST_X, LIST_Y, LIST_W, LIST_H);
    ctx.clip();
    const first = Math.max(0, Math.floor(s / ROW_H) * COLS);
    const last = Math.min(rows.length, Math.ceil((s + LIST_H) / ROW_H) * COLS);
    const l = this.list;
    const pressed = l.held > 0 && !l.dragged ? this.indexAt(l.downX, l.downY) : -1;
    for (let i = first; i < last; i++) {
      const r = rows[i]!;
      const cx = LIST_X + 2 + (i % COLS) * CELL_W;
      const cy = Math.round(LIST_Y + 2 + Math.floor(i / COLS) * ROW_H - s);
      drawPanel(ctx, cx, cy, CELL_W - 3, ROW_H - 2, i === pressed ? '#2a3a4a' : '#182030', i === pressed ? '#b8f0a8' : '#2c3850');
      // Quality / kind stripe.
      ctx.fillStyle = r.color;
      ctx.fillRect(cx + 1, cy + 2, 1, ROW_H - 6);
      if (r.icon) {
        const img = getFrame(r.icon, r.frame);
        const iw = Math.min(img.width, 20);
        const ih = Math.min(img.height, 20);
        ctx.drawImage(img, 0, 0, iw, ih, cx + 4 + ((20 - iw) >> 1), cy + ((ROW_H - 2 - ih) >> 1), iw, ih);
      }
      drawText(ctx, r.name, cx + 27, cy + 4, NAME);
      drawText(ctx, r.sub, cx + 27, cy + 13, SUB);
      if (i === this.sel[tab]) this.cursor(ctx, cx - 1, cy - 1, CELL_W - 1, ROW_H);
    }
    ctx.restore();
    // Scroll bar.
    const max = this.maxScroll();
    if (max > 0) {
      const trackH = LIST_H - 4;
      const barH = Math.max(12, Math.round((trackH * LIST_H) / (LIST_H + max)));
      const t = Math.max(0, Math.min(1, s / max));
      ctx.fillStyle = '#1e2638';
      ctx.fillRect(LIST_X + LIST_W + 2, LIST_Y + 2, 3, trackH);
      ctx.fillStyle = '#6a8a7a';
      ctx.fillRect(LIST_X + LIST_W + 2, Math.round(LIST_Y + 2 + (trackH - barH) * t), 3, barH);
    }
  }
}
