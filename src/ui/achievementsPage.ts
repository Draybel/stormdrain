/**
 * Achievements (Phase 4B, scene 'achievements'): every achievement as a scrolling list — earned ones with a
 * gold cup, the date and what they unlocked; locked ones grey with how to earn them and their reward; hidden
 * ones stay '???' until earned. The header counts them with a progress bar.
 */

import { allAchievements } from '../content/registry';
import { ICON_LOCK, ICON_TROPHY, ICON_TROPHY_DIM } from '../content/sprites/menuIcons';
import { UI } from '../content/sprites/palette';
import { rewardLines } from '../meta/achievements';
import { utcDateKey } from '../meta/metaState';
import { drawText, measureText, type TextStyle } from '../render/font';
import { drawPanel } from '../render/pixel';
import { drawSprite } from '../render/sprites';
import type { AchievementDef } from '../sim/types';
import type { App } from './app';
import { PageScene } from './page';
import { Scroller, uiButton, type UiButton } from './widgets';

const COUNT: TextStyle = { color: UI.text, shadow: UI.shadow };
const NAME_ON: TextStyle = { color: UI.accent, shadow: '#2a1a08' };
const NAME_OFF: TextStyle = { color: '#b4bdd6', shadow: UI.shadow };
const DESC_ON: TextStyle = { color: UI.text, shadow: UI.shadow };
const DESC_OFF: TextStyle = { color: UI.textDim };
const REWARD_ON: TextStyle = { color: '#8fe0a0' };
const REWARD_OFF: TextStyle = { color: '#6a8a7a' };
const DATE: TextStyle = { color: '#6a7896' };

const TOP = 40;
const VIEW_H = 188 - TOP;
const ROW_H = 30;

interface Row {
  def: AchievementDef;
  earned: boolean;
  date: string;
  reward: string;
}

export class AchievementsScene extends PageScene {
  private rows: Row[] = [];
  private readonly area: UiButton;
  private readonly scroll: Scroller;
  private earned = 0;

  constructor(app: App) {
    super(app, 'achievements', 'ACHIEVEMENTS');
    this.area = uiButton({ id: 'achievements.list', x: 6, y: TOP, w: 372, h: VIEW_H, pad: 0, draggable: true, nav: false });
    this.scroll = new Scroller(this.area);
    this.buttons.push(this.area, this.back);
    const m = app.save.meta.state;
    for (const def of allAchievements()) {
      const t = m.achievements[def.id];
      const earned = t !== undefined;
      if (earned) this.earned++;
      const r = rewardLines(def);
      this.rows.push({ def, earned, date: earned && t > 0 ? utcDateKey(t) : '', reward: r.length ? r.join(' · ') : '' });
    }
    this.scroll.setContent(this.rows.length * ROW_H + 2, VIEW_H);
  }

  override onKey(code: string): boolean {
    if (code === 'ArrowDown' || code === 'ArrowUp') {
      this.scroll.by(code === 'ArrowDown' ? ROW_H : -ROW_H);
      return true;
    }
    if (code === 'PageDown' || code === 'PageUp') {
      this.scroll.by(code === 'PageDown' ? VIEW_H - ROW_H : -(VIEW_H - ROW_H));
      return true;
    }
    return super.onKey(code);
  }

  onWheel(dy: number): void {
    this.scroll.by(dy * 0.35);
  }

  override update(dt: number, input: Parameters<PageScene['update']>[1]): void {
    super.update(dt, input);
    this.scroll.update(dt);
  }

  render(ctx: CanvasRenderingContext2D): void {
    this.drawBase(ctx);
    const total = this.rows.length;
    const a = `${this.earned} OF ${total} EARNED`;
    drawText(ctx, a, 378 - measureText(a), 9, COUNT);
    const bw = 120;
    const bx = 378 - bw;
    ctx.fillStyle = '#0b0f18';
    ctx.fillRect(bx, 19, bw, 5);
    if (total > 0) {
      ctx.fillStyle = '#c98a1e';
      ctx.fillRect(bx, 19, Math.round((bw * this.earned) / total), 5);
      ctx.fillStyle = UI.accent;
      ctx.fillRect(bx, 19, Math.round((bw * this.earned) / total), 1);
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(4, TOP - 1, 372, VIEW_H + 1);
    ctx.clip();
    const s = Math.round(this.scroll.pos);
    const first = Math.max(0, Math.floor(s / ROW_H));
    const last = Math.min(this.rows.length, Math.ceil((s + VIEW_H) / ROW_H) + 1);
    for (let i = first; i < last; i++) this.drawRow(ctx, this.rows[i]!, TOP + 1 + i * ROW_H - s);
    ctx.restore();
    this.scroll.drawBar(ctx, 378, TOP, VIEW_H);
    this.drawButtons(ctx, [this.back]);
  }

  private drawRow(ctx: CanvasRenderingContext2D, r: Row, y: number): void {
    const x = 6;
    const w = 368;
    const d = r.def;
    const secret = d.hidden && !r.earned;
    drawPanel(ctx, x, y, w, ROW_H - 2, r.earned ? '#1a1d24' : '#10141f', r.earned ? '#8a6a2a' : '#262e44', r.earned ? '#2c2a26' : null);
    drawSprite(ctx, r.earned ? ICON_TROPHY : ICON_TROPHY_DIM, 0, x + 5, y + 6);
    if (!r.earned) drawSprite(ctx, ICON_LOCK, 0, x + 14, y + 15);
    const tx = x + 27;
    drawText(ctx, secret ? '???' : d.name, tx, y + 4, r.earned ? NAME_ON : NAME_OFF);
    drawText(ctx, secret ? 'A HIDDEN ACHIEVEMENT. KEEP GOING...' : d.desc.toUpperCase(), tx, y + 12, r.earned ? DESC_ON : DESC_OFF);
    if (!secret && r.reward) drawText(ctx, `${r.earned ? 'UNLOCKED' : 'REWARD'}: ${r.reward}`, tx, y + 20, r.earned ? REWARD_ON : REWARD_OFF);
    if (r.date) drawText(ctx, r.date, x + w - 5 - measureText(r.date), y + 4, DATE);
  }

  override describe(): Record<string, unknown> {
    return { earned: this.earned, total: this.rows.length, rows: this.rows.map((r) => ({ id: r.def.id, earned: r.earned })) };
  }
}
