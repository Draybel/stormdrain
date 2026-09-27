/**
 * Stats (Phase 4B, scene 'stats'): lifetime numbers from the meta save in two scrolling columns — runs,
 * combat, routes (left); finds, the daily run, characters (right). Drag / wheel / arrows scroll.
 */

import { allCharacters } from '../content/registry';
import { UI } from '../content/sprites/palette';
import { utcDateKey, type MetaState } from '../meta/metaState';
import { characterUnlocked } from '../meta/unlocks';
import { drawText, measureText, type TextStyle } from '../render/font';
import type { App } from './app';
import { PageScene } from './page';
import { Scroller, uiButton, type UiButton } from './widgets';

const HEAD: TextStyle = { color: UI.accent, shadow: '#2a1a08' };
const LABEL: TextStyle = { color: UI.textDim };
const VALUE: TextStyle = { color: UI.text, shadow: UI.shadow };
const GOOD: TextStyle = { color: '#8fe0a0', shadow: UI.shadow };

type Line = { head: string } | { label: string; value: string; good?: boolean };

const TOP = 40;
const VIEW_H = 188 - TOP;
const ROW = 9;
const COL_W = 176;
const COL_X = [8, 200] as const;

export class StatsScene extends PageScene {
  private cols: Line[][] = [[], []];
  private readonly area: UiButton;
  private readonly scroll: Scroller;

  constructor(app: App) {
    super(app, 'stats', 'STATS');
    this.area = uiButton({ id: 'stats.list', x: 6, y: TOP, w: 372, h: VIEW_H, pad: 0, draggable: true, nav: false });
    this.scroll = new Scroller(this.area);
    this.buttons.push(this.area, this.back);
    this.build(app.save.meta.state);
  }

  private build(m: MetaState): void {
    const s = m.stats;
    const c = s.counters;
    const n = (k: string): string => String(c[k] ?? 0);
    const rate = s.runs > 0 ? `${Math.round((s.wins / s.runs) * 100)}%` : '-';
    let discovered = 0;
    for (const id in m.collection) if (m.collection[id]!.seen > 0) discovered++;
    let met = 0;
    for (const id in m.bestiary) if (m.bestiary[id]!.seen > 0) met++;
    const endings = ['ending1', 'ending2', 'ending3'].filter((e) => m.unlocks.endings.has(e)).length;
    const left: Line[] = [
      { head: 'RUNS' },
      { label: 'RUNS STARTED', value: String(s.runs) },
      { label: 'WINS', value: String(s.wins), good: s.wins > 0 },
      { label: 'DEATHS', value: String(s.deaths) },
      { label: 'WIN RATE', value: rate },
      { label: 'WIN STREAK', value: `${s.winStreak} (BEST ${s.bestWinStreak})` },
      { label: 'DEEPEST FLOOR', value: s.bestFloor ? String(s.bestFloor) : '-' },
      { label: 'FLOORS CLEARED', value: String(s.floorsCleared) },
      { label: 'CLEAN FLOORS', value: n('noDamageFloors') },
      { label: 'TIME PLAYED', value: playTime(s.playTimeSec) },
      { label: 'ENDINGS SEEN', value: `${endings} OF 3`, good: endings > 0 },
      { head: 'COMBAT' },
      { label: 'CREATURES DEFEATED', value: String(s.kills) },
      { label: 'BOSSES DEFEATED', value: String(s.bossKills) },
      { label: 'MINIBOSSES', value: n('minibossKills') },
      { label: 'KINDS MET', value: String(met) },
      { label: 'BOMBS SET', value: n('bombsUsed') },
      { label: 'EMBER NOVAS', value: n('emberNovas') },
      { label: 'ACTIVE ITEMS USED', value: n('activesUsed') },
      { label: 'CONSUMABLES USED', value: n('consumablesUsed') },
      { head: 'ROUTES & ROOMS' },
      { label: 'SECRET ROOMS', value: n('secretsFound') },
      { label: 'FORGOTTEN POCKETS', value: n('deepSecretsFound') },
      { label: 'HIDDEN ROUTES TAKEN', value: n('altRoutesTaken') },
      { label: 'ARENAS CLEARED', value: n('challengeRoomsCleared') },
      { label: 'THORN ROOMS ENTERED', value: n('cursedRoomsEntered') },
    ];
    const right: Line[] = [
      { head: 'FINDS' },
      { label: 'ITEMS COLLECTED', value: String(s.itemsCollected) },
      { label: 'ITEMS DISCOVERED', value: String(discovered) },
      { label: 'MOST ITEMS AT ONCE', value: n('maxItemsHeld') },
      { label: 'TRINKETS FOUND', value: n('trinketsFound') },
      { label: 'CHESTS OPENED', value: n('chestsOpened') },
      { label: 'KEYS USED', value: n('keysUsed') },
      { label: 'COINS COLLECTED', value: n('coinsCollected') },
      { label: 'COINS SPENT', value: n('coinsSpent') },
      { label: 'MOST COINS HELD', value: n('maxCoinsHeld') },
      { label: 'ITEMS BOUGHT', value: n('itemsBought') },
      { label: 'BROKER DEALS', value: n('brokerDeals') },
      { label: 'JAR DONATIONS', value: n('donations') },
      { label: 'GUMBALL SPINS', value: n('slotPlays') },
      { label: 'TRADES WITH OLD PELL', value: n('trades') },
      { label: 'TRANSFORMATIONS', value: n('transformations') },
      { label: 'SYNERGIES FOUND', value: n('synergiesFound') },
      { label: 'MOST FAMILIARS', value: n('maxFamiliars') },
    ];
    // The daily run.
    right.push({ head: 'DAILY RUN' });
    const today = utcDateKey(Date.now());
    const days = Object.keys(s.daily).sort().reverse();
    const t = s.daily[today];
    right.push({ label: 'TODAY', value: t ? `${t.won ? 'WON' : `FLOOR ${t.floor}`} · ${t.score}${t.done === false ? ' (ON)' : ''}` : 'NOT PLAYED YET', good: !!t?.won });
    let best = 0;
    for (const d of days) best = Math.max(best, s.daily[d]!.score);
    right.push({ label: 'BEST SCORE', value: days.length ? String(best) : '-' });
    right.push({ label: 'DAYS PLAYED', value: String(days.length) });
    for (const d of days.slice(0, 5)) {
      const r = s.daily[d]!;
      right.push({ label: d, value: `${r.won ? 'WON' : `F${r.floor}`} · ${r.score}`, good: r.won });
    }
    // Characters.
    right.push({ head: 'CHARACTERS' });
    for (const ch of allCharacters()) {
      const runs = s.charRuns[ch.id] ?? 0;
      const wins = s.charWins[ch.id] ?? 0;
      // A character still locked (and never played) keeps its name a secret, like on the character select.
      const known = runs > 0 || characterUnlocked(m, ch);
      right.push({ label: known ? ch.name.toUpperCase() : '???', value: `${runs} ${runs === 1 ? 'RUN' : 'RUNS'} · ${wins} ${wins === 1 ? 'WIN' : 'WINS'}`, good: wins > 0 });
    }
    this.cols = [left, right];
    const h = Math.max(height(left), height(right));
    this.scroll.setContent(h + 4, VIEW_H);
  }

  override onKey(code: string): boolean {
    if (code === 'ArrowDown' || code === 'ArrowUp') {
      this.scroll.by(code === 'ArrowDown' ? ROW * 3 : -ROW * 3);
      return true;
    }
    if (code === 'PageDown' || code === 'PageUp') {
      this.scroll.by(code === 'PageDown' ? VIEW_H - ROW * 2 : -(VIEW_H - ROW * 2));
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
    const m = this.app.save.meta.state;
    let achieved = 0;
    for (const _ in m.achievements) achieved++;
    const a = `${achieved} ACHIEVEMENTS · ${playTime(m.stats.playTimeSec)} PLAYED`;
    drawText(ctx, a, 378 - measureText(a), 14, LABEL);
    ctx.save();
    ctx.beginPath();
    ctx.rect(4, TOP - 1, 372, VIEW_H + 1);
    ctx.clip();
    const s = Math.round(this.scroll.pos);
    for (let c = 0; c < 2; c++) {
      let y = TOP + 2 - s;
      const x = COL_X[c]!;
      const col = this.cols[c]!;
      for (let i = 0; i < col.length; i++) {
        const line = col[i]!;
        if ('head' in line) {
          if (i > 0) y += 4;
          if (y > TOP - 12 && y < TOP + VIEW_H) {
            drawText(ctx, line.head, x, y, HEAD);
            ctx.fillStyle = '#2a3350';
            ctx.fillRect(x, y + 7, COL_W, 1);
          }
          y += 11;
          continue;
        }
        if (y > TOP - 8 && y < TOP + VIEW_H) {
          drawText(ctx, line.label, x, y, LABEL);
          drawText(ctx, line.value, x + COL_W - measureText(line.value), y, line.good ? GOOD : VALUE);
        }
        y += ROW;
      }
    }
    ctx.restore();
    this.scroll.drawBar(ctx, 378, TOP, VIEW_H);
    this.drawButtons(ctx, [this.back]);
  }

  override describe(): Record<string, unknown> {
    const rows: Record<string, string> = {};
    for (const col of this.cols) for (const l of col) if ('label' in l) rows[l.label] = l.value;
    return { rows };
  }
}

function height(lines: Line[]): number {
  let h = 2;
  for (let i = 0; i < lines.length; i++) h += 'head' in lines[i]! ? (i > 0 ? 15 : 11) : ROW;
  return h;
}

function playTime(sec: number): string {
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}M`;
  return `${Math.floor(m / 60)}H ${String(m % 60).padStart(2, '0')}M`;
}
