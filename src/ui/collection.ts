/**
 * Collection (Phase 4B, scene 'collection'): every item as a grid of icons — never seen: '?', seen (on a
 * pedestal, in a shop): a dark silhouette, collected: full colour; locked items show a padlock. Sorted by kind
 * (passives, actives, trinkets, consumables), then quality, then name. Tap one for its details below.
 */

import { allItems, findAchievement } from '../content/registry';
import { ICON_LOCK } from '../content/sprites/menuIcons';
import { UI } from '../content/sprites/palette';
import { itemUnlocked } from '../meta/unlocks';
import { drawText, drawTextCentered, measureText, type TextStyle } from '../render/font';
import { drawPanel } from '../render/pixel';
import { drawSprite, getFrame, getSilhouette } from '../render/sprites';
import { itemIcon } from '../render/worldRenderer';
import type { ItemDef } from '../sim/types';
import type { App } from './app';
import { DETAIL_TOP, GridPage } from './gridPage';
import { drawWrapped } from './widgets';

const COUNT: TextStyle = { color: UI.text, shadow: UI.shadow };
const DIM: TextStyle = { color: UI.textDim };
const Q_MARK: TextStyle = { color: '#3a4460' };
const NAME: TextStyle = { color: UI.accent, shadow: '#2a1a08', scale: 2 };
const NAME_DIM: TextStyle = { color: '#8e98b5', shadow: UI.shadow, scale: 2 };
const BODY: TextStyle = { color: UI.text, shadow: UI.shadow };
const HINT: TextStyle = { color: '#ffcf57', shadow: UI.shadow };
const QUALITY_COLOR = ['#8e98b5', '#c9d3f0', '#8fe0a0', '#8fc8ff', '#ffd76a'] as const;
const QUALITY_STYLE: readonly TextStyle[] = QUALITY_COLOR.map((color) => ({ color }));
const Q_BIG: TextStyle = { color: '#3a4460', scale: 2 };
const KIND_ORDER: Record<string, number> = { passive: 0, active: 1, trinket: 2, consumable: 3 };
const KIND_NAME: Record<string, string> = { passive: 'PASSIVE', active: 'ACTIVE', trinket: 'TRINKET', consumable: 'CONSUMABLE' };

type State = 'collected' | 'seen' | 'unknown' | 'locked';

interface Row {
  def: ItemDef;
  state: State;
  seen: number;
  collected: number;
}

export class CollectionScene extends GridPage<Row> {
  private counts = { collected: 0, seen: 0, total: 0 };

  constructor(app: App) {
    super(app, 'collection', 'COLLECTION');
    this.buttons.push(this.area, this.back);
    this.build();
  }

  private build(): void {
    const m = this.app.save.meta.state;
    const rows: Row[] = [];
    let collected = 0;
    let seen = 0;
    for (const def of allItems()) {
      const e = m.collection[def.id];
      const c = e?.collected ?? 0;
      const s = e?.seen ?? 0;
      const state: State = !itemUnlocked(m, def) ? 'locked' : c > 0 ? 'collected' : s > 0 ? 'seen' : 'unknown';
      if (c > 0) collected++;
      if (s > 0 || c > 0) seen++;
      rows.push({ def, state, seen: s, collected: c });
    }
    rows.sort(
      (a, b) =>
        (KIND_ORDER[a.def.kind] ?? 9) - (KIND_ORDER[b.def.kind] ?? 9) || b.def.quality - a.def.quality || a.def.name.localeCompare(b.def.name),
    );
    this.counts = { collected, seen, total: rows.length };
    this.setEntries(rows, 20);
  }

  render(ctx: CanvasRenderingContext2D): void {
    this.drawBase(ctx);
    const { collected, seen, total } = this.counts;
    const a = `COLLECTED ${collected} · SEEN ${seen} · OF ${total}`;
    drawText(ctx, a, 378 - measureText(a), 9, COUNT);
    // Progress bar: collected (gold) over seen (grey).
    const bw = 150;
    const bx = 378 - bw;
    ctx.fillStyle = '#0b0f18';
    ctx.fillRect(bx, 19, bw, 5);
    if (total > 0) {
      ctx.fillStyle = '#3a4460';
      ctx.fillRect(bx, 19, Math.round((bw * seen) / total), 5);
      ctx.fillStyle = '#c98a1e';
      ctx.fillRect(bx, 19, Math.round((bw * collected) / total), 5);
      ctx.fillStyle = UI.accent;
      ctx.fillRect(bx, 19, Math.round((bw * collected) / total), 1);
    }
    this.drawGrid(ctx);
    this.drawDetail(ctx);
    this.drawButtons(ctx, [this.back]);
  }

  protected drawCell(ctx: CanvasRenderingContext2D, r: Row, x: number, y: number, selected: boolean, pressed: boolean): void {
    const s = this.cell - 2;
    drawPanel(ctx, x, y + (pressed ? 1 : 0), s, s, selected ? '#2b3553' : r.state === 'collected' ? '#161c2c' : '#10141f', selected ? UI.borderHot : r.state === 'collected' ? '#3a4460' : '#232b42');
    const icon = itemIcon(r.def.id);
    const ix = x + ((s - 14) >> 1);
    const iy = y + ((s - 14) >> 1) + (pressed ? 1 : 0);
    if (r.state === 'collected') {
      ctx.drawImage(getFrame(icon, 0), ix, iy);
      ctx.fillStyle = QUALITY_COLOR[r.def.quality] ?? '#8e98b5';
      ctx.fillRect(x + 2, y + s - 3, 3, 1);
    } else if (r.state === 'seen') {
      ctx.drawImage(getSilhouette(icon, 0, '#3e4966'), ix, iy);
    } else if (r.state === 'locked') {
      drawSprite(ctx, ICON_LOCK, 0, x + ((s - 7) >> 1), y + ((s - 9) >> 1));
    } else {
      drawTextCentered(ctx, '?', x + s / 2, y + ((s - 5) >> 1), Q_MARK);
    }
  }

  private drawDetail(ctx: CanvasRenderingContext2D): void {
    const r = this.entries[this.sel];
    if (!r) return;
    const y = DETAIL_TOP;
    const d = r.def;
    // A big icon (2x) on the left.
    drawPanel(ctx, 8, y + 2, 34, 34, '#10141f', '#2e3650');
    const icon = itemIcon(d.id);
    if (r.state === 'collected') ctx.drawImage(getFrame(icon, 0), 11, y + 5, 28, 28);
    else if (r.state === 'seen') ctx.drawImage(getSilhouette(icon, 0, '#3e4966'), 11, y + 5, 28, 28);
    else if (r.state === 'locked') drawSprite(ctx, ICON_LOCK, 0, 21, y + 14);
    else drawTextCentered(ctx, '?', 25, y + 12, Q_BIG);
    const x = 48;
    const w = 378 - x;
    if (r.state === 'unknown') {
      drawText(ctx, '???', x, y + 3, NAME_DIM);
      drawText(ctx, 'UNDISCOVERED · IT IS DOWN THERE SOMEWHERE', x, y + 18, DIM);
      return;
    }
    if (r.state === 'locked') {
      drawText(ctx, 'LOCKED', x, y + 3, NAME_DIM);
      const ach = d.unlock ? findAchievement(d.unlock) : undefined;
      const hint = ach ? (ach.hidden ? 'UNLOCKED BY A HIDDEN ACHIEVEMENT' : `UNLOCK: ${ach.desc}`) : 'NOT AVAILABLE YET';
      drawWrapped(ctx, hint, x, y + 18, w, HINT, 8, 2);
      return;
    }
    const name = d.name.toUpperCase();
    drawText(ctx, name, x, y + 3, r.state === 'collected' ? NAME : NAME_DIM);
    const meta = `${KIND_NAME[d.kind] ?? d.kind.toUpperCase()} · QUALITY ${d.quality}`;
    drawText(ctx, meta, 378 - measureText(meta), y + 3, QUALITY_STYLE[d.quality] ?? DIM);
    if (r.state === 'collected') {
      drawWrapped(ctx, d.desc, x, y + 17, w, BODY, 8, 2);
      drawText(ctx, `COLLECTED ${r.collected} ${r.collected === 1 ? 'TIME' : 'TIMES'} · SEEN ${r.seen}`, x, y + 30, DIM);
    } else {
      drawText(ctx, 'SEEN, BUT NEVER TAKEN · GRAB IT NEXT TIME', x, y + 18, DIM);
      drawText(ctx, `SEEN ${r.seen} ${r.seen === 1 ? 'TIME' : 'TIMES'}`, x, y + 28, DIM);
    }
  }

  override describe(): Record<string, unknown> {
    const r = this.entries[this.sel];
    return { ...this.counts, selected: r ? { id: r.def.id, state: r.state } : null, cells: this.entries.length };
  }
}
