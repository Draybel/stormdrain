/**
 * Pause overlay (Phase 4B): the frozen run dimmed underneath.
 * - Left: PAUSED, the character, floor + chapter, the seed (daily / practice tag), the curse, the run time;
 *   RESUME / SETTINGS / QUIT TO TITLE (quitting keeps the run for Continue — it was saved on pause).
 * - Right: HEALTH (red hearts now / max, Tin and Ember on top) across the panel, then the six stats in two columns
 *   of three with icons (green above the character's base, red below), every held item as a grid
 *   (duplicates show ×N; scrolls when it overflows), the active item with its charge, trinkets, the consumable
 *   and transformations. Tap anything for its name and description underneath.
 * Secret: tapping the PAUSED title 5 times (each within 1.5 s of the last) opens the debug menu.
 */

import { makeButton, type HitButton } from '../engine/buttons';
import type { InputState } from '../engine/inputState';
import { GAME_H, GAME_W } from '../engine/screen';
import { CHAPTERS, findItem, findSet } from '../content/registry';
import { CURSE_ICONS, CURSE_SHORT } from '../content/sprites/mapIcons';
import { UI } from '../content/sprites/palette';
import { formatSeed, numericSeedLabel } from '../meta/seedCode';
import { FONT_H, drawText, drawTextCentered, measureText, type TextStyle } from '../render/font';
import { drawPanel } from '../render/pixel';
import { drawSprite, getFrame } from '../render/sprites';
import { itemIcon } from '../render/worldRenderer';
import type { Sim } from '../sim/sim';
import { itemDesc, itemName } from '../sim/tonics';
import type { App } from './app';
import type { Scene } from './scene';
import { STAT_ROWS, drawHealthLine, drawStatLine, healthParts, healthText, statText, type HealthPart } from './statRows';
import { BTN_H, MenuNav, Scroller, drawMenuButtons, drawWrapped, tickButtons, uiButton, type UiButton } from './widgets';

const TITLE: TextStyle = { color: UI.accent, shadow: '#243052', outline: '#0d0b14', scale: 3 };
const NAME: TextStyle = { color: '#fff3c4', shadow: '#3a2410' };
const INFO: TextStyle = { color: UI.text, shadow: UI.shadow };
const DIM: TextStyle = { color: UI.textDim };
const SECTION: TextStyle = { color: '#6a7896' };
const CURSE: TextStyle = { color: '#e08ad8', shadow: UI.shadow };
const TAG: TextStyle = { color: '#8fe0a0' };
const DETAIL_NAME: TextStyle = { color: UI.accent, shadow: '#2a1a08' };
const BADGE: TextStyle = { color: '#ffffff', shadow: UI.shadow };
const QUALITY_COLOR = ['#8e98b5', '#c9d3f0', '#8fe0a0', '#8fc8ff', '#ffd76a'] as const;

/** Taps on the title that open the debug menu, and the most time allowed between two of them. */
const SECRET_TAPS = 5;
const SECRET_GAP = 1.5;

// Right panel layout.
const PX = 132;
const PW = GAME_W - PX - 6;
const GRID_X = PX + 6;
/** The HEALTH line (full width) and the stat rows under it (8 px apart). */
const HEALTH_Y = 17;
const STATS_Y = 26;
const STAT_STEP = 8;
const GRID_Y = 63;
const CELL = 18;
const COLS = Math.floor((PW - 12) / CELL);
const GRID_H = CELL * 3;
const SLOTS_Y = 120;
const DETAIL_Y = 150;

type EntryKind = 'passive' | 'active' | 'trinket' | 'consumable' | 'set';

interface Entry {
  id: string;
  kind: EntryKind;
  count: number;
  /** Where it is drawn (slots: fixed; grid cells: before scrolling). */
  x: number;
  y: number;
  w: number;
  h: number;
}

export class PauseScene implements Scene {
  readonly name = 'pause';
  readonly overlay = true;
  readonly wantsSticks = false;
  readonly buttons: HitButton[];
  private readonly menu: UiButton[];
  private readonly nav: MenuNav;
  private readonly app: App;
  private readonly items: UiButton;
  private readonly scroll: Scroller;
  private time = 0;
  private taps = 0;
  private lastTap = -9;
  private sim: Sim | null = null;
  private grid: Entry[] = [];
  private slots: Entry[] = [];
  private selected: Entry | null = null;
  private info: string[] = [];
  private seedLine = '';
  private seedTag = '';
  /** The HEALTH value (health can't change while paused: built when the menu opens). */
  private health: HealthPart[] = [];

  constructor(app: App) {
    this.app = app;
    const mk = (id: string, label: string, y: number, kind: 'primary' | 'secondary', fn: () => void): UiButton =>
      uiButton({ id, label, kind, x: 6, y, w: 120, h: BTN_H, onActivate: fn });
    this.menu = [
      mk('pause.resume', 'RESUME', 100, 'primary', () => {
        app.audio.play('ui_click');
        app.nav.resume();
      }),
      mk('pause.settings', 'SETTINGS', 130, 'secondary', () => {
        app.audio.play('ui_click');
        app.nav.settings();
      }),
      mk('pause.quit', 'QUIT TO TITLE', 160, 'secondary', () => {
        app.audio.play('ui_back');
        app.nav.title();
      }),
    ];
    // The item grid + slot row: one area; a tap reads what's under it, a drag scrolls the grid.
    this.items = uiButton({ id: 'pause.items', x: PX, y: GRID_Y - 3, w: PW, h: DETAIL_Y - GRID_Y, pad: 0, draggable: true, nav: false });
    this.items.onActivate = () => this.tapItems(this.items.curX, this.items.curY);
    this.scroll = new Scroller(this.items);
    // Invisible hit area over the PAUSED title (press-triggered so quick taps all count).
    const secret = makeButton({ id: 'pause.title', x: 6, y: 3, w: 110, h: 22, pad: 2, trigger: 'press' });
    secret.onActivate = () => this.titleTap();
    this.buttons = [this.items, ...this.menu, secret];
    this.nav = new MenuNav(() => this.menu);
    this.nav.onMove = () => app.audio.play('menu_move');
  }

  private titleTap(): void {
    this.taps = this.time - this.lastTap <= SECRET_GAP ? this.taps + 1 : 1;
    this.lastTap = this.time;
    if (this.taps >= SECRET_TAPS) {
      this.taps = 0;
      this.app.nav.debug();
    }
  }

  enter(): void {
    this.time = 0;
    this.app.audio.music.muffle(true);
    this.nav.set(this.menu[0]!);
    this.refresh();
  }

  focus(): void {
    // Back from settings / the debug menu (items may have been given).
    this.refresh();
  }

  exit(): void {
    this.app.audio.music.muffle(false);
  }

  /** Reads the (frozen) run: the info lines and every item entry. Allocates, but only when the menu opens. */
  private refresh(): void {
    const run = this.app.scenes.find('run') as { sim?: Sim } | undefined;
    const sim = run?.sim ?? null;
    this.sim = sim;
    this.grid = [];
    this.slots = [];
    this.selected = null;
    this.info = [];
    this.seedLine = '';
    this.seedTag = '';
    this.health = [];
    if (!sim) return;
    const p = sim.world.player;
    this.health = healthParts(p.health);
    const d = sim.run?.data;
    if (d) {
      const ch = CHAPTERS.get(d.chapter);
      const no = ch ? Math.ceil(ch.floors[0] / 2) : Math.ceil(d.floor / 2);
      this.info.push(`FLOOR ${d.floor} · CHAPTER ${no}`);
      this.info.push((ch?.name ?? d.chapter).toUpperCase() + (d.track === 'alt' ? ' (HIDDEN)' : ''));
      const s = d.seedInfo;
      this.seedLine = `SEED ${s ? formatSeed(s.code) : numericSeedLabel(d.seed)}`;
      this.seedTag = !s ? '' : s.kind === 'daily' ? (s.scored ? 'DAILY' : 'DAILY · PRACTICE') : s.kind === 'custom' ? 'PRACTICE' : '';
    } else {
      this.info.push('THE TRAINING YARD');
      this.info.push('NOTHING HERE IS SAVED');
    }
    // Held passives (one cell per item, ×N for copies), in pickup order.
    const inv = p.inv;
    const counts = new Map<string, number>();
    for (const id of inv.passives) counts.set(id, (counts.get(id) ?? 0) + 1);
    let i = 0;
    for (const [id, n] of counts) {
      this.grid.push({ id, kind: 'passive', count: n, x: GRID_X + (i % COLS) * CELL, y: GRID_Y + Math.floor(i / COLS) * CELL, w: CELL, h: CELL });
      i++;
    }
    this.scroll.setContent(Math.ceil(this.grid.length / COLS) * CELL, GRID_H);
    this.scroll.pos = 0;
    // The slot row: active, trinkets, consumables, transformations.
    let x = PX + 6;
    if (inv.active) this.slots.push({ id: inv.active.id, kind: 'active', count: 1, x, y: SLOTS_Y + 8, w: 16, h: 16 });
    x = PX + 44;
    for (const id of inv.trinkets) {
      this.slots.push({ id, kind: 'trinket', count: 1, x, y: SLOTS_Y + 8, w: 16, h: 16 });
      x += 17;
    }
    x = PX + 96;
    for (const id of inv.consumables) {
      this.slots.push({ id, kind: 'consumable', count: 1, x, y: SLOTS_Y + 8, w: 16, h: 16 });
      x += 17;
    }
    let sy = SLOTS_Y + 8;
    for (const id of p.sets) {
      this.slots.push({ id, kind: 'set', count: 1, x: PX + 148, y: sy, w: PW - 154, h: 8 });
      sy += 8;
    }
  }

  private tapItems(x: number, y: number): void {
    let hit: Entry | null = null;
    if (y < GRID_Y + GRID_H) {
      const sy = y + this.scroll.pos;
      for (const e of this.grid) if (x >= e.x && x < e.x + e.w && sy >= e.y && sy < e.y + e.h) hit = e;
    } else {
      for (const e of this.slots) if (x >= e.x - 1 && x < e.x + e.w + 1 && y >= e.y - 2 && y < e.y + e.h + 2) hit = e;
    }
    if (hit) {
      this.selected = hit;
      this.app.audio.play('menu_move');
    }
  }

  onKey(code: string): boolean {
    if (code === 'Escape' || code === 'KeyP') {
      this.menu[0]!.onActivate?.();
      return true;
    }
    if (code === 'KeyQ') {
      this.menu[2]!.onActivate?.();
      return true;
    }
    if (code === 'KeyS') {
      this.menu[1]!.onActivate?.();
      return true;
    }
    if (code === 'ArrowUp' || code === 'ArrowDown' || code === 'Tab' || code === 'Enter' || code === 'NumpadEnter' || code === 'Space') {
      return this.nav.onKey(code);
    }
    return false;
  }

  onWheel(dy: number): void {
    this.scroll.by(dy * 0.35);
  }

  update(dt: number, _input: InputState): void {
    this.time += dt;
    tickButtons(this.buttons, dt);
    this.scroll.update(dt);
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.globalAlpha = Math.min(0.8, this.time * 6);
    ctx.fillStyle = '#04050a';
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    ctx.globalAlpha = 1;
    this.drawLeft(ctx);
    drawMenuButtons(ctx, this.menu);
    this.nav.draw(ctx, this.time, this.app.input.lastDevice === 'keyboard');
    this.drawRight(ctx);
  }

  private drawLeft(ctx: CanvasRenderingContext2D): void {
    drawText(ctx, 'PAUSED', 8, 6, TITLE);
    const sim = this.sim;
    if (!sim) return;
    const c = sim.world.player.character;
    drawPanel(ctx, 6, 26, 20, 22, '#141a2a', '#2e3650');
    ctx.drawImage(getFrame(c.sprite, 0), 9, 29);
    drawText(ctx, c.name.toUpperCase(), 30, 29, NAME);
    if (this.info[0]) drawText(ctx, this.info[0], 30, 38, DIM);
    let y = 53;
    if (this.info[1]) {
      drawText(ctx, this.info[1], 8, y, INFO);
      y += 9;
    }
    if (this.seedLine) {
      drawText(ctx, this.seedLine, 8, y, INFO);
      y += 9;
    }
    if (this.seedTag) {
      drawText(ctx, this.seedTag, 8, y, TAG);
      y += 9;
    }
    const curse = sim.world.curse;
    if (curse) {
      drawSprite(ctx, CURSE_ICONS[curse], 0, 7, y - 1);
      drawText(ctx, CURSE_SHORT[curse], 17, y, CURSE);
      y += 9;
    }
    const d = sim.run?.data;
    if (d && y < 94) drawText(ctx, `TIME ${formatTime(d.time)}`, 8, y, DIM);
  }

  private drawRight(ctx: CanvasRenderingContext2D): void {
    drawPanel(ctx, PX, 4, PW, GAME_H - 8, '#0d111c', '#2e3650', '#161c2c');
    const sim = this.sim;
    if (!sim) return;
    const p = sim.world.player;
    // Stats: HEALTH across the panel, then two columns of three.
    drawText(ctx, 'STATS', PX + 6, 8, SECTION);
    const colW = Math.floor((PW - 18) / 2);
    drawHealthLine(ctx, this.health, PX + 6, HEALTH_Y, PW - 12);
    const base = p.character.stats;
    for (let i = 0; i < STAT_ROWS.length; i++) {
      const col = i < 3 ? 0 : 1;
      drawStatLine(ctx, STAT_ROWS[i]!, p.stats, base, PX + 6 + col * (colW + 6), STATS_Y + (i % 3) * STAT_STEP, colW);
    }
    ctx.fillStyle = '#1e2638';
    ctx.fillRect(PX + 4, STATS_Y + 3 * STAT_STEP + 1, PW - 8, 1);
    // Items.
    const n = p.inv.passives.length;
    drawText(ctx, n ? `ITEMS · ${n}` : 'ITEMS', PX + 6, GRID_Y - 9, SECTION);
    if (this.grid.length === 0) drawText(ctx, 'NOTHING YET. FIND SOME TREASURE!', GRID_X + 2, GRID_Y + 6, DIM);
    ctx.save();
    ctx.beginPath();
    ctx.rect(PX + 2, GRID_Y - 1, PW - 4, GRID_H + 1);
    ctx.clip();
    const s = Math.round(this.scroll.pos);
    for (const e of this.grid) {
      const y = e.y - s;
      if (y < GRID_Y - CELL || y > GRID_Y + GRID_H) continue;
      this.drawCell(ctx, e, e.x, y);
    }
    ctx.restore();
    this.scroll.drawBar(ctx, PX + PW - 5, GRID_Y, GRID_H);
    ctx.fillStyle = '#1e2638';
    ctx.fillRect(PX + 4, SLOTS_Y - 3, PW - 8, 1);
    // Slot row.
    drawText(ctx, 'ACTIVE', PX + 6, SLOTS_Y, SECTION);
    drawText(ctx, 'TRINKETS', PX + 44, SLOTS_Y, SECTION);
    drawText(ctx, 'POCKET', PX + 96, SLOTS_Y, SECTION);
    drawText(ctx, 'TRANSFORMED', PX + 148, SLOTS_Y, SECTION);
    let anySet = false;
    for (const e of this.slots) {
      if (e.kind === 'set') {
        anySet = true;
        const on = this.selected === e;
        drawText(ctx, (findSet(e.id)?.name ?? e.id).toUpperCase(), e.x, e.y + 1, on ? DETAIL_NAME : TAG);
        continue;
      }
      this.drawCell(ctx, e, e.x - 1, e.y - 1);
      if (e.kind === 'active') {
        const a = p.inv.active;
        if (a && a.max > 0) {
          const f = Math.min(1, a.charge / a.max);
          ctx.fillStyle = '#0b0f18';
          ctx.fillRect(e.x + 18, e.y, 3, 16);
          ctx.fillStyle = f >= 1 ? '#bfe8ff' : '#4fb0e8';
          const h = Math.round(16 * f);
          ctx.fillRect(e.x + 18, e.y + 16 - h, 3, h);
        }
      }
    }
    if (!p.inv.active) drawText(ctx, '-', PX + 12, SLOTS_Y + 12, DIM);
    if (p.inv.trinkets.length === 0) drawText(ctx, '-', PX + 50, SLOTS_Y + 12, DIM);
    if (p.inv.consumables.length === 0) drawText(ctx, '-', PX + 102, SLOTS_Y + 12, DIM);
    if (!anySet) drawText(ctx, 'NOT YET', PX + 148, SLOTS_Y + 12, DIM);
    ctx.fillStyle = '#1e2638';
    ctx.fillRect(PX + 4, DETAIL_Y - 3, PW - 8, 1);
    this.drawDetail(ctx);
  }

  private drawCell(ctx: CanvasRenderingContext2D, e: Entry, x: number, y: number): void {
    const on = this.selected === e;
    const def = findItem(e.id);
    drawPanel(ctx, x, y, CELL - 1, CELL - 1, on ? '#2b3553' : '#141a2a', on ? UI.borderHot : '#232b42');
    ctx.drawImage(getFrame(itemIcon(e.id), 0), x + 1, y + 1);
    if (def) {
      ctx.fillStyle = QUALITY_COLOR[def.quality] ?? '#8e98b5';
      ctx.fillRect(x + 1, y + CELL - 3, 2, 1);
    }
    if (e.count > 1) {
      const t = `×${e.count}`;
      drawText(ctx, t, x + CELL - 1 - measureText(t), y + CELL - 7, BADGE);
    }
  }

  private drawDetail(ctx: CanvasRenderingContext2D): void {
    const e = this.selected;
    const x = PX + 6;
    const w = PW - 12;
    if (!e) {
      drawTextCentered(ctx, 'TAP AN ITEM TO READ ABOUT IT', PX + PW / 2, DETAIL_Y + 12, DIM);
      return;
    }
    if (e.kind === 'set') {
      const set = findSet(e.id);
      drawText(ctx, (set?.name ?? e.id).toUpperCase(), x, DETAIL_Y + 2, DETAIL_NAME);
      drawText(ctx, 'TRANSFORMATION', x + measureText((set?.name ?? e.id).toUpperCase()) + 6, DETAIL_Y + 2, DIM);
      drawWrapped(ctx, set?.desc ?? '', x, DETAIL_Y + 12, w, INFO, 8, 3);
      return;
    }
    const def = findItem(e.id);
    // This run's names: an unidentified Mystery Tonic stays '??? <COLOUR> TONIC' (sim/tonics.ts).
    const world = this.sim?.world ?? null;
    const name = (def ? itemName(world, e.id) : e.id).toUpperCase();
    drawText(ctx, name, x, DETAIL_Y + 2, DETAIL_NAME);
    if (def) {
      const kind = `${def.kind.toUpperCase()} · QUALITY ${def.quality}${e.count > 1 ? ` · ×${e.count}` : ''}`;
      drawText(ctx, kind, x + w - measureText(kind), DETAIL_Y + 2, DIM);
      drawWrapped(ctx, itemDesc(world, e.id), x, DETAIL_Y + 12, w, INFO, 8, 2);
      if (def.set) {
        const set = findSet(def.set);
        if (set) drawText(ctx, `PART OF A SET: ${set.name.toUpperCase()}`, x, DETAIL_Y + 29, TAG);
      }
    }
  }

  describe(): Record<string, unknown> {
    const sim = this.sim;
    const p = sim?.world.player;
    const stats: Record<string, number> = {};
    if (p) for (const r of STAT_ROWS) stats[r.key] = p.stats[r.key];
    return {
      character: p?.character.id ?? null,
      info: [...this.info],
      seed: this.seedLine,
      tag: this.seedTag,
      curse: sim?.world.curse ?? null,
      health: p ? healthText(p.health) : '',
      stats,
      items: this.grid.map((e) => ({ id: e.id, count: e.count })),
      slots: this.slots.map((e) => ({ id: e.id, kind: e.kind })),
      selected: this.selected ? { id: this.selected.id, kind: this.selected.kind } : null,
      itemCells: this.grid.map((e) => ({ id: e.id, x: e.x + e.w / 2, y: e.y + e.h / 2 - this.scroll.pos })),
      panel: { x: PX, y: 4, w: PW, h: GAME_H - 8 },
      statRects: this.statRects(),
      gridTop: GRID_Y - 1,
    };
  }

  /**
   * Tests: where the STATS block's pieces are drawn (game px) — the HEALTH icon / label / value, each stat's icon,
   * label and value, and the ITEMS heading — so a test can check none overlap and all stay inside the panel.
   */
  private statRects(): { id: string; x: number; y: number; w: number; h: number }[] {
    const p = this.sim?.world.player;
    if (!p) return [];
    const out: { id: string; x: number; y: number; w: number; h: number }[] = [];
    const x0 = PX + 6;
    out.push({ id: 'health.icon', x: x0 - 1, y: HEALTH_Y - 2, w: 9, h: 8 });
    out.push({ id: 'health.label', x: x0 + 10, y: HEALTH_Y, w: measureText('HEALTH'), h: FONT_H });
    let rx = x0 + PW - 12;
    for (let i = this.health.length - 1; i >= 0; i--) {
      const w = measureText(this.health[i]!.text);
      rx -= w;
      out.push({ id: `health.value${i}`, x: rx, y: HEALTH_Y, w, h: FONT_H });
      rx -= 5;
    }
    const colW = Math.floor((PW - 18) / 2);
    for (let i = 0; i < STAT_ROWS.length; i++) {
      const r = STAT_ROWS[i]!;
      const x = x0 + (i < 3 ? 0 : 1) * (colW + 6);
      const y = STATS_Y + (i % 3) * STAT_STEP;
      const v = measureText(statText(p.stats[r.key], r.dp));
      out.push({ id: `${r.key}.icon`, x, y: y - 1, w: r.icon.w, h: r.icon.h });
      out.push({ id: `${r.key}.label`, x: x + 10, y, w: measureText(r.label), h: FONT_H });
      out.push({ id: `${r.key}.value`, x: x + colW - v, y, w: v, h: FONT_H });
    }
    out.push({ id: 'items.label', x: x0, y: GRID_Y - 9, w: measureText('ITEMS · 99'), h: FONT_H });
    return out;
  }
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r < 10 ? '0' : ''}${r}`;
}
