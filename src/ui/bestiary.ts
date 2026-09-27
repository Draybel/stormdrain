/**
 * Bestiary (Phase 4B, scene 'bestiary'): tabs FOES and BOSSES; a grid of creatures — never met: '?', met:
 * the sprite (dimmed until one has been defeated), with how many were defeated; tap for the details: the
 * sprite animated at a bigger scale, met / defeated counts, where it lives and its bestiary blurb.
 */

import { BOSSES, CHAPTERS, ENEMIES } from '../content/registry';
import { UI } from '../content/sprites/palette';
import { drawText, drawTextCentered, measureText, type TextStyle } from '../render/font';
import { drawPanel } from '../render/pixel';
import { getFrame } from '../render/sprites';
import type { BestiaryEntry } from '../meta/metaState';
import type { SpriteDef } from '../sim/types';
import type { App } from './app';
import { DETAIL_TOP, GridPage } from './gridPage';
import { BTN_H, drawWrapped, uiButton, type UiButton } from './widgets';

const COUNT: TextStyle = { color: UI.text, shadow: UI.shadow };
const DIM: TextStyle = { color: UI.textDim };
const Q_MARK: TextStyle = { color: '#3a4460' };
const Q_BIG: TextStyle = { color: '#3a4460', scale: 2 };
const NAME: TextStyle = { color: '#ff9a8a', shadow: '#2a0a08', scale: 2 };
const NAME_DIM: TextStyle = { color: '#8e98b5', shadow: UI.shadow, scale: 2 };
const BODY: TextStyle = { color: UI.text, shadow: UI.shadow };
const KILLS: TextStyle = { color: '#ffffff', shadow: UI.shadow };
const KIND_STYLE: TextStyle = { color: '#e0a060' };

type Tab = 'foes' | 'bosses';

interface Row {
  id: string;
  name: string;
  sprite: SpriteDef | null;
  blurb: string;
  where: string;
  extra: string;
  entry: BestiaryEntry | undefined;
}

/** Chapter order (registry order of the chapter files = floors 1-12 by id). */
function chapterRank(ids: readonly string[]): number {
  let best = 99;
  for (const id of ids) {
    const c = CHAPTERS.get(id);
    if (c) best = Math.min(best, c.floors[0] + (c.track === 'alt' ? 0.5 : 0));
  }
  return best;
}

function chapterNames(ids: readonly string[]): string {
  const names = ids.map((id) => CHAPTERS.get(id)?.name.toUpperCase()).filter((n): n is string => !!n);
  return names.length ? names.join(', ') : 'THE DEPTHS';
}

export class BestiaryScene extends GridPage<Row> {
  private tab: Tab = 'foes';
  private readonly tabs: UiButton[];
  private counts = { met: 0, defeated: 0, total: 0 };

  constructor(app: App) {
    super(app, 'bestiary', 'BESTIARY');
    this.tabs = (['foes', 'bosses'] as const).map((t, i) =>
      uiButton({
        id: `bestiary.tab.${t}`,
        label: t.toUpperCase(),
        x: 146 + i * 64,
        y: 5,
        w: 60,
        h: BTN_H,
        onActivate: () => this.setTab(t),
      }),
    );
    this.buttons.push(this.area, this.back, ...this.tabs);
    this.setTab('foes', true);
  }

  private setTab(t: Tab, quiet = false): void {
    if (!quiet) this.app.audio.play(t === this.tab ? 'menu_move' : 'ui_click');
    this.tab = t;
    for (const b of this.tabs) b.kind = b.id.endsWith(t) ? 'primary' : 'secondary';
    const m = this.app.save.meta.state;
    const rows: Row[] = [];
    if (t === 'foes') {
      const defs = [...ENEMIES.values()].sort((a, b) => chapterRank(a.chapters) - chapterRank(b.chapters) || a.name.localeCompare(b.name));
      for (const d of defs) {
        rows.push({
          id: d.id,
          name: d.name.toUpperCase(),
          sprite: typeof d.sprite === 'string' ? null : d.sprite,
          blurb: d.bestiary,
          where: chapterNames(d.chapters),
          extra: `${d.hp} HP${d.flying ? ' · FLIES' : ''}`,
          entry: m.bestiary[d.id],
        });
      }
    } else {
      const order = { miniboss: 0, boss: 1, final: 2 } as const;
      const defs = [...BOSSES.values()].sort((a, b) => order[a.kind] - order[b.kind] || chapterRank(a.chapters) - chapterRank(b.chapters) || a.name.localeCompare(b.name));
      for (const d of defs) {
        rows.push({
          id: d.id,
          name: d.name.toUpperCase(),
          sprite: typeof d.sprite === 'string' ? null : d.sprite,
          blurb: d.bestiary ?? d.title ?? '',
          where: d.kind === 'final' ? 'THE BOTTOM OF THE STORM' : chapterNames(d.chapters),
          extra: d.kind === 'final' ? 'FINAL BOSS' : d.kind === 'miniboss' ? 'MINIBOSS' : 'BOSS',
          entry: m.bestiary[d.id],
        });
      }
    }
    let met = 0;
    let defeated = 0;
    for (const r of rows) {
      if ((r.entry?.seen ?? 0) > 0) met++;
      if ((r.entry?.killed ?? 0) > 0) defeated++;
    }
    this.counts = { met, defeated, total: rows.length };
    this.sel = 0;
    this.setEntries(rows, t === 'foes' ? 30 : 36);
  }

  render(ctx: CanvasRenderingContext2D): void {
    this.drawBase(ctx);
    const { met, defeated, total } = this.counts;
    const a = `MET ${met} OF ${total}`;
    const b = `DEFEATED ${defeated}`;
    drawText(ctx, a, 378 - measureText(a), 9, COUNT);
    drawText(ctx, b, 378 - measureText(b), 19, DIM);
    this.drawGrid(ctx);
    this.drawDetail(ctx);
    this.drawButtons(ctx, [this.back, ...this.tabs]);
  }

  /** The sprite's idle frame index (animated when `t` >= 0). */
  private frameOf(s: SpriteDef, t: number): number {
    const idle = s.anims?.idle ?? s.anims?.move;
    if (!idle || idle.frames.length === 0) return 0;
    if (t < 0) return idle.frames[0]!;
    return idle.frames[Math.floor(t * Math.max(1, idle.fps)) % idle.frames.length]!;
  }

  protected drawCell(ctx: CanvasRenderingContext2D, r: Row, x: number, y: number, selected: boolean, pressed: boolean): void {
    const s = this.cell - 2;
    const seen = (r.entry?.seen ?? 0) > 0;
    const kills = r.entry?.killed ?? 0;
    drawPanel(ctx, x, y + (pressed ? 1 : 0), s, s, selected ? '#2b3553' : seen ? '#161c2c' : '#10141f', selected ? UI.borderHot : seen ? '#3a4460' : '#232b42');
    if (!seen || !r.sprite) {
      drawTextCentered(ctx, '?', x + s / 2, y + ((s - 5) >> 1), Q_MARK);
      return;
    }
    const img = getFrame(r.sprite, this.frameOf(r.sprite, -1));
    const fit = s - 4;
    const k = img.width > fit || img.height > fit ? Math.min(fit / img.width, fit / img.height) : 1;
    const w = Math.round(img.width * k);
    const h = Math.round(img.height * k);
    ctx.globalAlpha = kills > 0 ? 1 : 0.45;
    ctx.drawImage(img, x + ((s - w) >> 1), y + ((s - h) >> 1) + (pressed ? 1 : 0), w, h);
    ctx.globalAlpha = 1;
    if (kills > 0) {
      const t = kills > 999 ? '999+' : String(kills);
      drawText(ctx, t, x + s - 2 - measureText(t), y + s - 7, KILLS);
    }
  }

  private drawDetail(ctx: CanvasRenderingContext2D): void {
    const r = this.entries[this.sel];
    if (!r) return;
    const y = DETAIL_TOP;
    const seen = (r.entry?.seen ?? 0) > 0;
    drawPanel(ctx, 8, y + 2, 40, 34, '#10141f', '#2e3650');
    if (seen && r.sprite) {
      const img = getFrame(r.sprite, this.frameOf(r.sprite, this.time));
      const k = Math.min(2, Math.max(0.5, Math.min(36 / img.width, 30 / img.height)));
      const scale = k >= 2 ? 2 : k >= 1 ? 1 : 0.5;
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      ctx.drawImage(img, 28 - (w >> 1), y + 34 - h, w, h);
    } else {
      drawTextCentered(ctx, '?', 28, y + 12, Q_BIG);
    }
    const x = 54;
    const w = 378 - x;
    if (!seen) {
      drawText(ctx, '???', x, y + 3, NAME_DIM);
      drawText(ctx, this.tab === 'foes' ? 'NOT MET YET · KEEP DIGGING' : 'NOT MET YET · IT WAITS DEEPER DOWN', x, y + 18, DIM);
      return;
    }
    drawText(ctx, r.name, x, y + 3, NAME);
    drawText(ctx, r.extra, 378 - measureText(r.extra), y + 3, KIND_STYLE);
    const kills = r.entry?.killed ?? 0;
    drawText(ctx, `MET ${r.entry?.seen ?? 0} · DEFEATED ${kills} · ${r.where}`, x, y + 16, DIM);
    drawWrapped(ctx, r.blurb, x, y + 25, w, BODY, 8, 2);
  }

  override describe(): Record<string, unknown> {
    const r = this.entries[this.sel];
    return { tab: this.tab, ...this.counts, selected: r ? r.id : null, cells: this.entries.length };
  }
}
