/**
 * The ending screens (Phase 4B, overlay scene 'ending'): after a final boss the screen fades to a small
 * painted vignette for the ending reached — 1 CLEAR SKIES (the storm breaks over the rooftops), 2 THE QUIET
 * HIVE (the paper hive asleep in amber light), 3 WHAT THE RAIN KEPT (lost things rising out of the calmed
 * whirlpool) — and a few lines of original epilogue type out underneath. Then what the win unlocked, the run
 * in one line, and NEW RUN / TITLE. A tap shows all the text at once.
 */

import { CHAPTERS } from '../content/registry';
import { UI } from '../content/sprites/palette';
import { MARBLE_SPRITE } from '../content/sprites/props';
import type { InputState } from '../engine/inputState';
import { Rng } from '../engine/rng';
import { GAME_H, GAME_W } from '../engine/screen';
import { formatSeed, numericSeedLabel } from '../meta/seedCode';
import { isPracticeSeed } from '../meta/tracker';
import { ctx2d, makeCanvas } from '../render/canvas';
import { drawText, drawTextCentered, measureText, type TextStyle } from '../render/font';
import { glowSprite } from '../render/pixel';
import { getFrame } from '../render/sprites';
import type { SpriteDef } from '../sim/types';
import type { App, RunEndInfo } from './app';
import type { Scene } from './scene';
import { MenuNav, drawMenuButtons, tickButtons, uiButton, type UiButton } from './widgets';

const TITLE: TextStyle = { color: '#ffe9a8', shadow: '#2a1a08', outline: '#07080d', scale: 2 };
const LINE: TextStyle = { color: UI.text, shadow: UI.shadow };
const SMALL: TextStyle = { color: UI.textDim };
const UNLOCK: TextStyle = { color: '#8fe0a0', shadow: UI.shadow };
const NOTE: TextStyle = { color: '#e0a060', shadow: UI.shadow };
const ENDING_NO: TextStyle = { color: '#e9edf7', outline: '#07080d' };

const ART_H = 90;

/** The endings (DESIGN "Final bosses & endings"): title, lines ('WREN' becomes the character's name). */
export const ENDING_TEXT: Readonly<Record<number, { title: string; lines: readonly string[] }>> = {
  1: {
    title: 'CLEAR SKIES',
    lines: [
      'THE OLD STORM CLOUD SIGHS AND COMES APART LIKE WET PAPER.',
      'FOR THE FIRST TIME IN FORTY DAYS, THE GUTTERS GO QUIET.',
      'WREN CLIMBS OUT INTO A STRANGE, BRIGHT MORNING.',
      'BUT FAR BELOW THE STREETS, SOMETHING IS STILL HUMMING...',
    ],
  },
  2: {
    title: 'THE QUIET HIVE',
    lines: [
      'THE PAPER QUEEN FOLDS HER WINGS, AND THE HUM FALLS SILENT.',
      'THE HIVE WAS NEVER HOARDING. IT WAS KEEPING THINGS DRY.',
      'WREN LEAVES ONE MARBLE BY THE AMBER DOOR, JUST IN CASE.',
      'DEEP IN THE PIPES, THE WATER BEGINS, VERY SLOWLY, TO TURN.',
    ],
  },
  3: {
    title: 'WHAT THE RAIN KEPT',
    lines: [
      'AT THE BOTTOM OF EVERY DRAIN, THE UNDERTOW LETS GO.',
      'LOST BOOTS, KITES, LETTERS AND MARBLES RISE ON THE CURRENT.',
      'EVERYTHING THE STORM TOOK FINDS ITS WAY BACK UP THE PIPES.',
      'WREN WALKS HOME DRY, POCKETS FULL OF GLOWING MARBLES.',
    ],
  },
};

/** What a newly reached ending unlocks, in words. */
const FLAG_LINES: Readonly<Record<string, string>> = {
  ending1: 'NEW: THE HIDDEN ROUTE NOW RUNS ALL THE WAY TO THE HOLLOW NEST',
  ending2: 'NEW: SOMEWHERE BELOW, THE WATER HAS STARTED TO TURN',
  ending3: 'YOU FOUND THE TRUE ENDING. THANK YOU FOR PLAYING!',
};

const CHARS_PER_SEC = 42;
const LINE_PAUSE = 0.7;
const FADE = 0.9;

// ── Vignettes ────────────────────────────────────────────────────────────────

/** Dithered vertical gradient through `stops` (pixel-art bands with a checker blend at each seam). */
function bands(g: CanvasRenderingContext2D, y0: number, y1: number, stops: readonly string[]): void {
  const n = stops.length;
  const h = (y1 - y0) / n;
  for (let i = 0; i < n; i++) {
    const a = Math.round(y0 + i * h);
    const b = Math.round(y0 + (i + 1) * h);
    g.fillStyle = stops[i]!;
    g.fillRect(0, a, GAME_W, b - a);
    if (i + 1 < n) {
      g.fillStyle = stops[i + 1]!;
      for (let x = 0; x < GAME_W; x += 2) {
        g.fillRect(x, b - 2, 1, 1);
        g.fillRect(x + 1, b - 1, 1, 1);
      }
    }
  }
}

function ellipse(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, c: string): void {
  g.fillStyle = c;
  for (let dy = -Math.floor(ry); dy <= ry; dy++) {
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry))));
    g.fillRect(Math.round(cx - half), Math.round(cy + dy), half * 2 + 1, 1);
  }
}

function buildArt(ending: number): HTMLCanvasElement {
  const c = makeCanvas(GAME_W, ART_H);
  const g = ctx2d(c);
  const rng = new Rng(`ending-${ending}`);
  if (ending === 2) {
    bands(g, 0, ART_H, ['#0c0705', '#140b06', '#1e1108', '#28170a', '#33200d', '#3a2410']);
    // Paper strands hanging from the roof.
    for (let i = 0; i < 26; i++) {
      const x = rng.int(0, GAME_W);
      g.fillStyle = rng.chance(0.5) ? '#4a3018' : '#5a3a1c';
      g.fillRect(x, 0, 1, rng.int(6, 22));
    }
    // The hive: stacked paper layers, darker at the edges.
    const cx = 282;
    const layers = ['#6a4a28', '#8a6238', '#a07a48', '#b88f58', '#c9a36b'];
    for (let i = 0; i < 7; i++) {
      const y = 12 + i * 9;
      const rx = 30 + Math.sin((i / 6) * Math.PI) * 26;
      ellipse(g, cx, y, rx, 6, layers[Math.min(4, i % 5)]!);
      ellipse(g, cx, y - 1, rx - 3, 3, layers[Math.min(4, (i + 2) % 5)]!);
    }
    // The amber door.
    ellipse(g, cx, 70, 9, 7, '#2a1606');
    ellipse(g, cx, 70, 7, 5, '#ffb347');
    ellipse(g, cx, 69, 4, 2, '#ffe9a8');
    // Floor.
    g.fillStyle = '#1a1008';
    g.fillRect(0, 80, GAME_W, ART_H - 80);
    g.fillStyle = '#2a1a0c';
    g.fillRect(0, 80, GAME_W, 1);
    return c;
  }
  if (ending === 3) {
    bands(g, 0, 50, ['#e9f4ff', '#cfe6fa', '#b0d2f0', '#9fc3e0', '#7fa8cc']);
    bands(g, 50, ART_H, ['#2c4a6c', '#223c5a', '#1c2c46', '#152238']);
    // The calmed whirlpool: slow rings.
    for (let r = 6; r < 52; r += 7) {
      g.fillStyle = r % 14 === 6 ? '#3b5f7e' : '#2a4666';
      for (let a = 0; a < Math.PI * 2; a += 0.02) g.fillRect(Math.round(250 + Math.cos(a) * r), Math.round(72 + Math.sin(a) * r * 0.3), 1, 1);
    }
    // A shore on the left with a drain pipe.
    g.fillStyle = '#1a2133';
    g.fillRect(0, 58, 96, ART_H - 58);
    g.fillStyle = '#2a3350';
    g.fillRect(0, 58, 96, 1);
    g.fillStyle = '#39435a';
    g.fillRect(10, 40, 22, 18);
    g.fillStyle = '#05060a';
    g.fillRect(14, 44, 14, 14);
    return c;
  }
  // 1: Clear skies over the rooftops.
  bands(g, 0, 72, ['#1c2e52', '#2a4470', '#3d5f94', '#6a7eb0', '#b89aa8', '#e8b070', '#f6d28a']);
  // The last torn clouds drifting off.
  for (let i = 0; i < 9; i++) {
    const left = i % 2 === 0;
    const x = left ? rng.int(-20, 90) : rng.int(290, 400);
    const y = rng.int(6, 32);
    ellipse(g, x, y, rng.int(14, 30), rng.int(4, 8), rng.chance(0.5) ? '#2a3350' : '#39436a');
  }
  // Rooftops.
  let x = -4;
  while (x < GAME_W) {
    const w = rng.int(22, 40);
    const top = rng.int(52, 64);
    g.fillStyle = '#131827';
    g.fillRect(x, top, w, ART_H - top);
    for (let k = 0; k < w / 2; k++) {
      const hy = Math.round(top - k * 0.55);
      g.fillRect(x + k, hy, w - 2 * k, 1);
    }
    if (rng.chance(0.4)) g.fillRect(x + w - 8, top - 12, 4, 10);
    for (let wy = top + 6; wy < 80; wy += 9) {
      for (let wx = x + 4; wx < x + w - 5; wx += 8) {
        if (rng.chance(0.35)) {
          g.fillStyle = rng.chance(0.7) ? '#ffcf57' : '#ffe9a8';
          g.fillRect(wx, wy, 3, 4);
          g.fillStyle = '#131827';
        }
      }
    }
    x += w + rng.int(0, 4);
  }
  // The wet street and the grate she climbed out of.
  g.fillStyle = '#0d111c';
  g.fillRect(0, 82, GAME_W, ART_H - 82);
  g.fillStyle = '#e8b070';
  for (let i = 0; i < 12; i++) g.fillRect(238 + i * 5 + (i % 3), 84 + (i % 4), 3, 1);
  g.fillStyle = '#2a3350';
  g.fillRect(96, 84, 26, 4);
  g.fillStyle = '#05060a';
  for (let i = 0; i < 6; i++) g.fillRect(98 + i * 4, 85, 2, 2);
  return c;
}

// ── Tiny lost things for ending 3 ────────────────────────────────────────────

const LOST: readonly SpriteDef[] = [
  { id: 'lost.boot', w: 7, h: 8, palette: { o: '#0d0b14', r: '#c0483a', d: '#7a2a24' }, frames: [['.ooo...', '.orro..', '.orro..', '.orro..', '.orrroo', 'orrrrro', 'odddddo', '.......']] },
  { id: 'lost.kite', w: 7, h: 9, palette: { y: '#ffcf57', b: '#6fd0ff', w: '#e9edf7' }, frames: [['...y...', '..yyy..', '.ybyby.', 'yyybyyy', '.ybyby.', '..yyy..', '...y...', '....w..', '.....w.']] },
  { id: 'lost.letter', w: 8, h: 6, palette: { w: '#e9dfc4', s: '#b9ab88', r: '#e0515a' }, frames: [['wwwwwwww', 'wswwwwsw', 'wwswwsww', 'wwwsswww', 'wwwrrwww', 'wwwwwwww']] },
  { id: 'lost.umbrella', w: 9, h: 8, palette: { p: '#b06ad8', l: '#d8a0f0', s: '#8e98b5' }, frames: [['...ppp...', '.plpplpp.', 'pplpplppp', 'p.p.p.p.p', '....s....', '....s....', '....s.s..', '.....s...']] },
];

interface Floater {
  sprite: SpriteDef;
  x: number;
  y: number;
  speed: number;
  phase: number;
}

export class EndingScene implements Scene {
  readonly name = 'ending';
  readonly overlay = true;
  readonly wantsSticks = false;
  readonly toastsAtTop = true;
  readonly buttons: UiButton[];
  private readonly app: App;
  private readonly info: RunEndInfo;
  private readonly ending: number;
  private readonly title: string;
  private readonly lines: string[];
  private readonly notes: string[] = [];
  private readonly summary: string;
  private readonly skip: UiButton;
  private readonly actions: UiButton[];
  private readonly menu: MenuNav;
  private art: HTMLCanvasElement | null = null;
  private time = 0;
  /** Seconds of typing done (text shows up to this point). */
  private typed = 0;
  private done = false;
  private readonly floaters: Floater[] = [];
  private readonly sunGlow = glowSprite(24, '255,214,140', 0.55);
  private readonly doorGlow = glowSprite(22, '255,160,60', 0.5);

  constructor(app: App, info: RunEndInfo) {
    this.app = app;
    this.info = info;
    this.ending = Math.max(1, Math.min(3, info.ending || 1));
    const text = ENDING_TEXT[this.ending]!;
    const sim = info.sim;
    const name = sim.world.player.character.name.toUpperCase();
    this.title = text.title;
    this.lines = text.lines.map((l) => l.replace(/WREN/g, name));
    for (const f of info.newFlags) if (FLAG_LINES[f]) this.notes.push(FLAG_LINES[f]!);
    const d = sim.run?.data;
    const meta = app.save.meta;
    if (d && isPracticeSeed(d.seedInfo)) this.notes.push('PRACTICE RUN · ENDINGS AND FEATS ARE NOT RECORDED');
    else if (
      (info.newFlags.includes('ending1') || info.newFlags.includes('ending2')) &&
      meta.isUnlocked('endings', 'ending1') &&
      meta.isUnlocked('endings', 'ending2') &&
      !meta.isUnlocked('endings', 'ending3')
    ) {
      this.notes.push('A WHIRLPOOL WILL WAIT AFTER THE NEXT FINAL BOSS...');
    }
    const p = sim.world.player;
    const items = p.inv.passives.length + (p.inv.active ? 1 : 0) + p.inv.trinkets.length;
    if (d) {
      const ch = CHAPTERS.get(d.chapter);
      const seed = d.seedInfo ? formatSeed(d.seedInfo.code) : numericSeedLabel(d.seed);
      this.summary = `${name} · FLOOR ${d.floor} ${ch ? `(${ch.name.toUpperCase()})` : ''} · ${formatTime(d.time)} · ${items} ${items === 1 ? 'ITEM' : 'ITEMS'} · SEED ${seed}`;
    } else {
      this.summary = '';
    }
    this.skip = uiButton({ id: 'ending.skip', x: 0, y: 0, w: GAME_W, h: GAME_H, pad: 0, nav: false, onActivate: () => this.showAll() });
    this.actions = [
      uiButton({
        id: 'ending.newRun',
        label: 'NEW RUN',
        kind: 'primary',
        x: 76,
        y: 159,
        w: 110,
        h: 28,
        visible: false,
        onActivate: () => {
          app.audio.play('ui_click');
          app.nav.title();
          app.nav.characters(null);
        },
      }),
      uiButton({
        id: 'ending.title',
        label: 'TITLE',
        x: 198,
        y: 159,
        w: 110,
        h: 28,
        visible: false,
        onActivate: () => {
          app.audio.play('ui_back');
          app.nav.title();
        },
      }),
    ];
    this.buttons = [this.skip, ...this.actions];
    this.menu = new MenuNav(() => this.actions);
    this.menu.onMove = () => app.audio.play('menu_move');
    if (this.ending === 3) {
      for (let i = 0; i < 9; i++) {
        this.floaters.push({ sprite: LOST[i % LOST.length]!, x: 150 + ((i * 53) % 190), y: ART_H + i * 14, speed: 9 + (i % 4) * 3, phase: i * 1.7 });
      }
    }
  }

  /** Total seconds the lines take to type. */
  private get typeTime(): number {
    let t = 0;
    for (const l of this.lines) t += l.length / CHARS_PER_SEC + LINE_PAUSE;
    return t;
  }

  private showAll(): void {
    if (this.done) return;
    this.typed = this.typeTime;
    this.finish();
  }

  private finish(): void {
    this.done = true;
    this.skip.visible = false;
    for (const b of this.actions) b.visible = true;
    this.menu.set(this.actions[0]!);
  }

  enter(): void {
    this.time = 0;
  }

  onKey(code: string): boolean {
    if (!this.done) {
      if (code === 'Enter' || code === 'Space' || code === 'Escape' || code === 'NumpadEnter') this.showAll();
      return true;
    }
    if (code === 'Escape') {
      this.actions[1]!.onActivate?.();
      return true;
    }
    return this.menu.onKey(code);
  }

  update(dt: number, _input: InputState): void {
    this.time += dt;
    tickButtons(this.buttons, dt);
    if (this.time > FADE && !this.done) {
      this.typed += dt;
      if (this.typed >= this.typeTime + 0.4) this.finish();
    }
    for (const f of this.floaters) {
      f.y -= f.speed * dt;
      if (f.y < -12) f.y = ART_H + 6;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const fade = Math.min(1, this.time / FADE);
    ctx.globalAlpha = fade;
    ctx.fillStyle = '#04050a';
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    const artA = Math.max(0, Math.min(1, (this.time - FADE * 0.6) / 0.8));
    ctx.globalAlpha = artA;
    this.drawArt(ctx, artA);
    ctx.fillStyle = '#ffcf57';
    ctx.fillRect(0, ART_H, GAME_W, 1);
    ctx.globalAlpha = 1;
    if (this.time < FADE * 0.6) return;
    // Title over the art's bottom edge.
    drawTextCentered(ctx, this.title, GAME_W / 2, 22, TITLE);
    // The epilogue, typed.
    let t = this.typed;
    let y = ART_H + 5;
    for (const l of this.lines) {
      if (t <= 0) break;
      const n = Math.min(l.length, Math.floor(t * CHARS_PER_SEC));
      drawTextCentered(ctx, n >= l.length ? l : l.slice(0, n), GAME_W / 2, y, LINE);
      t -= l.length / CHARS_PER_SEC + LINE_PAUSE;
      y += 9;
    }
    if (!this.done) {
      if (Math.floor(this.time * 2) % 2 === 0) drawText(ctx, 'TAP TO SKIP', GAME_W - 6 - measureText('TAP TO SKIP'), GAME_H - 8, SMALL);
      return;
    }
    // Unlocks, the run, the buttons.
    let ny = ART_H + 5 + this.lines.length * 9 + 2;
    for (const n of this.notes) {
      drawTextCentered(ctx, n, GAME_W / 2, ny, n.startsWith('PRACTICE') ? NOTE : UNLOCK);
      ny += 8;
    }
    if (this.notes.length === 0 && this.summary) drawTextCentered(ctx, this.summary, GAME_W / 2, ny, SMALL);
    else if (this.summary && ny < 152) drawTextCentered(ctx, this.summary, GAME_W / 2, ny, SMALL);
    drawTextCentered(ctx, `ENDING ${this.ending} OF 3`, GAME_W / 2, 38, ENDING_NO);
    drawMenuButtons(ctx, this.actions);
    this.menu.draw(ctx, this.time, this.app.input.lastDevice === 'keyboard');
  }

  private drawArt(ctx: CanvasRenderingContext2D, alpha: number): void {
    this.art ??= buildArt(this.ending);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, GAME_W, ART_H);
    ctx.clip();
    this.drawScene(ctx, alpha);
    ctx.restore();
  }

  private drawScene(ctx: CanvasRenderingContext2D, alpha: number): void {
    ctx.drawImage(this.art!, 0, 0);
    const t = this.time;
    const hero = this.info.sim.world.player.character.sprite;
    if (this.ending === 1) {
      // The sun breaking through, with slowly turning rays.
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(this.sunGlow, 270 - 24, 46 - 24);
      ctx.fillStyle = 'rgba(255,230,160,0.12)';
      for (let i = 0; i < 10; i++) {
        const a = t * 0.1 + (i * Math.PI) / 5;
        for (let r = 18; r < 80; r += 3) ctx.fillRect(Math.round(270 + Math.cos(a) * r), Math.round(46 + Math.sin(a) * r * 0.8), 2, 2);
      }
      ctx.globalCompositeOperation = 'source-over';
      ellipse(ctx, 270, 46, 9, 9, '#ffe9a8');
      ellipse(ctx, 270, 46, 7, 7, '#fff3c4');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(266, 42, 4, 3);
      this.drawHero(ctx, hero, 118, 84, t);
    } else if (this.ending === 2) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha * (0.75 + Math.sin(t * 1.4) * 0.25);
      ctx.drawImage(this.doorGlow, 282 - 22, 70 - 22);
      ctx.globalCompositeOperation = 'source-over';
      // Sleepy "z"s drifting up from the hive.
      for (let i = 0; i < 3; i++) {
        const k = (t * 0.3 + i / 3) % 1;
        ctx.globalAlpha = alpha * (1 - k);
        drawText(ctx, 'Z', Math.round(302 + i * 7 + Math.sin(t + i) * 3), Math.round(34 - k * 26), SMALL);
      }
      ctx.globalAlpha = alpha;
      ctx.drawImage(getFrame(MARBLE_SPRITE, 0), 262, 73);
      this.drawHero(ctx, hero, 234, 81, t);
    } else {
      for (const f of this.floaters) {
        const img = getFrame(f.sprite, 0);
        ctx.drawImage(img, Math.round(f.x + Math.sin(t * 1.3 + f.phase) * 5), Math.round(f.y));
      }
      // Marbles glinting on the water.
      for (let i = 0; i < 4; i++) if (Math.sin(t * 3 + i * 2) > 0.6) ctx.drawImage(getFrame(MARBLE_SPRITE, 0), 200 + i * 28, 64 + (i % 2) * 8);
      this.drawHero(ctx, hero, 60, 58, t);
    }
  }

  /** The character, facing us, breathing (frame 0; a blink now and then if the sprite has one). */
  private drawHero(ctx: CanvasRenderingContext2D, s: SpriteDef, x: number, feetY: number, t: number): void {
    const blink = s.frames.length > 3 && t % 3.4 > 3.25;
    const img = getFrame(s, blink ? 3 : 0);
    ctx.fillStyle = 'rgba(4,5,10,0.35)';
    ctx.fillRect(x - 5, feetY, 11, 1);
    ctx.drawImage(img, Math.round(x - img.width / 2), feetY - img.height + (Math.sin(t * 2) > 0.95 ? -1 : 0));
  }

  describe(): Record<string, unknown> {
    return { ending: this.ending, title: this.title, done: this.done, notes: [...this.notes], lines: [...this.lines] };
  }
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r < 10 ? '0' : ''}${r}`;
}
