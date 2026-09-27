/**
 * Character select (Phase 4B, scene 'chars'): pushed over the title by New Run, Daily Run and Enter Seed.
 * - A strip of character slots along the bottom (every CharacterDef, registry order; paged with arrows when
 *   they don't fit); locked characters are dark silhouettes with a padlock.
 * - The picked one big on the left (portrait with a glow, name), the details on the right: description,
 *   mechanic, stat bars, starting hearts / pickups / items — or, locked, the unlock hint from its achievement.
 * - START (disabled while a locked one is picked); the header shows the seed (random / daily / typed).
 * Keyboard: left / right pick, Enter starts, Esc goes back.
 */

import { CHARACTERS, findAchievement, findItem } from '../content/registry';
import { UI } from '../content/sprites/palette';
import { ICON_LOCK } from '../content/sprites/menuIcons';
import { EMBER_HEART_SPRITE, HUD_BOMB_ICON, HUD_COIN_ICON, HUD_KEY_ICON, TIN_HEART_SPRITE } from '../content/sprites/pickups';
import { HEART_SPRITE } from '../content/sprites/ui';
import { characterUnlocked } from '../meta/unlocks';
import { formatSeed, randomSeedCode } from '../meta/seedCode';
import { drawText, drawTextCentered, measureText, type TextStyle } from '../render/font';
import { drawPanel, glowSprite } from '../render/pixel';
import { drawSprite, getFrame, getSilhouette } from '../render/sprites';
import { itemIcon } from '../render/worldRenderer';
import type { RunSeedInfo } from '../sim/run/types';
import type { CharacterDef } from '../sim/types';
import type { App } from './app';
import { PageScene } from './page';
import { STAT_ROWS, drawStatBar } from './statRows';
import { drawWrapped, uiButton, type UiButton } from './widgets';

const NAME: TextStyle = { color: '#fff3c4', shadow: '#3a2410', scale: 2 };
const NAME_LOCKED: TextStyle = { color: UI.textDim, shadow: UI.shadow, scale: 2 };
const BODY: TextStyle = { color: UI.text, shadow: UI.shadow };
const DIM: TextStyle = { color: UI.textDim };
const MECH: TextStyle = { color: '#b9d6f0', shadow: UI.shadow };
const HINT: TextStyle = { color: '#ffcf57', shadow: UI.shadow };
const SEED: TextStyle = { color: '#c9d3f0', shadow: UI.shadow };
const SEED_SUB: TextStyle = { color: '#8e98b5' };
const WARN: TextStyle = { color: '#e0a060', shadow: UI.shadow };

const SLOT = 26;
const SLOT_GAP = 4;
const STRIP_X = 6;
const STRIP_Y = 158;
const STRIP_W = 250;

/** The last character picked this session (New Run from the debug menu uses it too). */
let lastPicked = 'wren';

export function lastCharacter(): string {
  return CHARACTERS.has(lastPicked) ? lastPicked : 'wren';
}

export class CharacterSelectScene extends PageScene {
  private readonly chars: CharacterDef[];
  private readonly slots: UiButton[];
  private readonly prev: UiButton;
  private readonly next: UiButton;
  private readonly start: UiButton;
  private readonly seed: RunSeedInfo | null;
  private sel = 0;
  private page = 0;
  private perPage = 1;
  private readonly glow = glowSprite(26, '255,207,87', 0.28);

  constructor(app: App, seed: RunSeedInfo | null) {
    super(app, 'chars', 'CHARACTERS');
    this.seed = seed;
    this.chars = [...CHARACTERS.values()];
    const i = this.chars.findIndex((c) => c.id === lastCharacter());
    this.sel = Math.max(0, i);
    this.slots = this.chars.map((c, k) =>
      uiButton({ id: `chars.slot.${c.id}`, x: 0, y: STRIP_Y, w: SLOT, h: SLOT + 2, pad: 1, onActivate: () => this.pick(k) }),
    );
    this.prev = uiButton({ id: 'chars.prev', label: '<', x: STRIP_X, y: STRIP_Y, w: 22, h: SLOT + 2, onActivate: () => this.turn(-1) });
    this.next = uiButton({ id: 'chars.next', label: '>', x: STRIP_X + STRIP_W - 22, y: STRIP_Y, w: 22, h: SLOT + 2, onActivate: () => this.turn(1) });
    this.start = uiButton({ id: 'chars.start', label: 'START', kind: 'primary', x: 264, y: 157, w: 114, h: 30, onActivate: () => this.go() });
    this.buttons.push(this.back, ...this.slots, this.prev, this.next, this.start);
    this.layoutStrip();
    this.refresh();
  }

  protected override defaultFocus(): UiButton | null {
    return this.start.enabled ? this.start : this.back;
  }

  private layoutStrip(): void {
    const n = this.chars.length;
    const fits = Math.floor((STRIP_W + SLOT_GAP) / (SLOT + SLOT_GAP));
    const paged = n > fits;
    this.perPage = paged ? Math.max(1, Math.floor((STRIP_W - 2 * (22 + SLOT_GAP) + SLOT_GAP) / (SLOT + SLOT_GAP))) : n;
    this.page = Math.floor(this.sel / this.perPage);
    this.prev.visible = this.next.visible = paged;
    const x0 = paged ? STRIP_X + 22 + SLOT_GAP : STRIP_X;
    for (let k = 0; k < n; k++) {
      const s = this.slots[k]!;
      const onPage = Math.floor(k / this.perPage) === this.page;
      s.visible = onPage;
      s.x = x0 + (k % this.perPage) * (SLOT + SLOT_GAP);
    }
    this.prev.enabled = this.page > 0;
    this.next.enabled = (this.page + 1) * this.perPage < n;
  }

  private turn(dir: number): void {
    const n = this.chars.length;
    const pages = Math.ceil(n / this.perPage);
    const p = Math.max(0, Math.min(pages - 1, this.page + dir));
    this.pick(Math.min(n - 1, p * this.perPage));
  }

  private get picked(): CharacterDef {
    return this.chars[this.sel]!;
  }

  private unlocked(c: CharacterDef): boolean {
    return characterUnlocked(this.app.save.meta.state, c);
  }

  private pick(k: number): void {
    if (k === this.sel) return;
    this.sel = Math.max(0, Math.min(this.chars.length - 1, k));
    this.app.audio.play('menu_move');
    this.layoutStrip();
    this.refresh();
  }

  private refresh(): void {
    const ok = this.unlocked(this.picked);
    this.start.enabled = ok;
    this.start.label = ok ? 'START' : 'LOCKED';
    if (ok) lastPicked = this.picked.id;
  }

  private go(): void {
    const c = this.picked;
    if (!this.unlocked(c)) {
      this.app.audio.play('ui_back');
      return;
    }
    this.app.audio.play('menu_select');
    lastPicked = c.id;
    const seed: RunSeedInfo = this.seed ?? { code: randomSeedCode(), kind: 'random' };
    this.app.nav.startRun({ character: c.id, seed });
  }

  override onKey(code: string): boolean {
    if (code === 'ArrowLeft' || code === 'ArrowRight') {
      this.pick(this.sel + (code === 'ArrowLeft' ? -1 : 1));
      this.menu.set(this.slots[this.sel]!);
      return true;
    }
    if ((code === 'Enter' || code === 'NumpadEnter' || code === 'Space') && this.menu.current() !== this.back) {
      this.start.flash = 0;
      this.go();
      return true;
    }
    return super.onKey(code);
  }

  render(ctx: CanvasRenderingContext2D): void {
    this.drawBase(ctx);
    this.drawSeedBadge(ctx);
    const c = this.picked;
    const open = this.unlocked(c);
    this.drawPortrait(ctx, c, open);
    this.drawDetails(ctx, c, open);
    this.drawSlots(ctx);
    this.drawButtons(ctx, [this.back, this.prev, this.next, this.start]);
    if (this.app.save.hasRun()) drawText(ctx, 'STARTING ABANDONS YOUR SAVED RUN', 264, 149, WARN);
  }

  /** Header, right side: which seed this run will use. */
  private drawSeedBadge(ctx: CanvasRenderingContext2D): void {
    const s = this.seed;
    let a: string;
    let b: string;
    if (!s) {
      a = 'RANDOM SEED';
      b = 'A FRESH DRAIN EVERY TIME';
    } else if (s.kind === 'daily') {
      a = `DAILY ${s.date ?? ''} · ${formatSeed(s.code)}`;
      b = s.scored ? "TODAY'S ONE SCORED ATTEMPT" : 'ALREADY PLAYED TODAY · PRACTICE';
    } else {
      a = `SEED ${formatSeed(s.code)}`;
      b = 'PRACTICE: NO RUN FEATS OR ENDINGS';
    }
    drawText(ctx, a, 378 - measureText(a), 9, SEED);
    drawText(ctx, b, 378 - measureText(b), 19, SEED_SUB);
  }

  private drawPortrait(ctx: CanvasRenderingContext2D, c: CharacterDef, open: boolean): void {
    const x = 6;
    const y = 41;
    const w = 128;
    const h = 108;
    drawPanel(ctx, x, y, w, h, '#10141f', open ? '#46537a' : '#2e3650', '#1c2336');
    const cx = x + w / 2;
    // A pool of warm light, a ledge, the character at 3x.
    ctx.globalCompositeOperation = 'lighter';
    if (open) ctx.drawImage(this.glow, Math.round(cx - this.glow.width / 2), y + 12);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#1a2031';
    ctx.fillRect(x + 22, y + 74, w - 44, 3);
    ctx.fillStyle = '#2a3350';
    ctx.fillRect(x + 22, y + 74, w - 44, 1);
    const blink = open && c.sprite.frames.length > 3 && this.time % 3.2 > 3.05;
    const img = open ? getFrame(c.sprite, blink ? 3 : 0) : getSilhouette(c.sprite, 0, '#05060a');
    const s = 3;
    const bob = open ? Math.round(Math.sin(this.time * 2.4)) : 0;
    ctx.drawImage(img, Math.round(cx - (img.width * s) / 2), y + 74 - img.height * s + bob, img.width * s, img.height * s);
    if (!open) drawSprite(ctx, ICON_LOCK, 0, Math.round(cx - 3), y + 38);
    drawTextCentered(ctx, open ? c.name.toUpperCase() : '???', cx, y + 84, open ? NAME : NAME_LOCKED);
  }

  private drawDetails(ctx: CanvasRenderingContext2D, c: CharacterDef, open: boolean): void {
    const x = 140;
    const y = 41;
    const w = 238;
    drawPanel(ctx, x, y, w, 108, '#10141f', '#2e3650', '#1c2336');
    const tx = x + 7;
    const tw = w - 14;
    if (!open) {
      drawText(ctx, 'LOCKED', tx, y + 7, HINT);
      const ach = c.unlock ? findAchievement(c.unlock) : undefined;
      const hint = !ach ? 'KEEP EXPLORING THE DRAINS.' : ach.hidden ? '??? A HIDDEN ACHIEVEMENT.' : `UNLOCK: ${ach.desc}`;
      drawWrapped(ctx, hint, tx, y + 18, tw, BODY, 8, 3);
      if (ach && !ach.hidden) drawText(ctx, `ACHIEVEMENT: ${ach.name}`, tx, y + 46, DIM);
      for (let i = 0; i < STAT_ROWS.length; i++) drawStatBar(ctx, STAT_ROWS[i]!, c.stats, tx, y + 58 + i * 8, tw, true);
      return;
    }
    let ly = y + 6;
    ly += drawWrapped(ctx, c.desc, tx, ly, tw, BODY, 8, 2) * 8 + 1;
    if (c.mechanicDesc) ly += drawWrapped(ctx, c.mechanicDesc, tx, ly, tw, MECH, 8, 3) * 8 + 2;
    const statsY = Math.max(ly + 1, y + 44);
    for (let i = 0; i < STAT_ROWS.length; i++) drawStatBar(ctx, STAT_ROWS[i]!, c.stats, tx, statsY + i * 8, tw, false);
    this.drawLoadout(ctx, c, tx, y + 108 - 12);
  }

  /** Hearts, pickups and starting items on one line. */
  private drawLoadout(ctx: CanvasRenderingContext2D, c: CharacterDef, x: number, y: number): void {
    let cx = x;
    const hs = c.hearts;
    const red = hs.red ?? hs.redMax;
    for (let i = 0; i < hs.redMax >> 1; i++, cx += 10) {
      const hp = red - i * 2;
      drawSprite(ctx, HEART_SPRITE, hp >= 2 ? 0 : hp === 1 ? 1 : 2, cx, y);
    }
    for (let i = 0; i < Math.ceil((hs.tin ?? 0) / 2); i++, cx += 10) drawSprite(ctx, TIN_HEART_SPRITE, 0, cx, y);
    for (let i = 0; i < Math.ceil((hs.ember ?? 0) / 2); i++, cx += 10) drawSprite(ctx, EMBER_HEART_SPRITE, 0, cx, y);
    cx += 6;
    const p = c.startPickups;
    const counters: [typeof HUD_COIN_ICON, number][] = [
      [HUD_COIN_ICON, p.coins],
      [HUD_BOMB_ICON, p.bombs],
      [HUD_KEY_ICON, p.keys],
    ];
    for (const [icon, n] of counters) {
      if (n <= 0) continue;
      drawSprite(ctx, icon, 0, cx, y + 1);
      drawText(ctx, String(n), cx + icon.w + 2, y + 2, BODY);
      cx += icon.w + 10;
    }
    for (const id of c.startItems) {
      if (!findItem(id)) continue;
      ctx.drawImage(getFrame(itemIcon(id), 0), cx, y - 3);
      cx += 16;
    }
  }

  private drawSlots(ctx: CanvasRenderingContext2D): void {
    for (let k = 0; k < this.chars.length; k++) {
      const b = this.slots[k]!;
      if (!b.visible) continue;
      const c = this.chars[k]!;
      const open = this.unlocked(c);
      const on = k === this.sel;
      const pressed = b.held > 0 && b.armed;
      drawPanel(ctx, b.x, b.y + (pressed ? 1 : 0), b.w, b.h, on ? '#2b3553' : '#141a2a', on ? UI.borderHot : '#46537a', on ? '#44527c' : null);
      const img = open ? getFrame(c.sprite, 0) : getSilhouette(c.sprite, 0, '#05060a');
      ctx.drawImage(img, Math.round(b.x + (b.w - img.width) / 2), Math.round(b.y + (b.h - img.height) / 2) + (pressed ? 1 : 0));
      if (!open) drawSprite(ctx, ICON_LOCK, 0, Math.round(b.x + b.w - 8), b.y + b.h - 10);
    }
    if (this.prev.visible) {
      const pages = Math.ceil(this.chars.length / this.perPage);
      drawTextCentered(ctx, `${this.page + 1}/${pages}`, STRIP_X + STRIP_W / 2, STRIP_Y - 8, DIM);
    }
  }

  override describe(): Record<string, unknown> {
    const c = this.picked;
    return {
      characters: this.chars.map((d) => ({ id: d.id, unlocked: this.unlocked(d) })),
      selected: c.id,
      canStart: this.start.enabled,
      seed: this.seed ? { ...this.seed } : null,
      page: this.page,
    };
  }
}

