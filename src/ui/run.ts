/**
 * The run scene. Owns the headless Sim, steps it with the InputState each fixed tick, and turns its
 * events into particles, shake, sound, music and HUD feedback.
 *
 * - 'run' (New Run): a real run — floors, rooms, doors (sim/run). Walking through a door slides the
 *   camera to the next room (the sim is frozen for the slide), the trapdoor closes an iris and opens
 *   the next floor with its card, the minimap sits in its HUD slot (tap it / Tab for the big map), the
 *   Curse of Darkness dims the room. Death or the last boss ends the run with a card, then the title.
 * - 'yard' (debug menu): the Phase 2 training yard — F / the bell button call waves, death restarts.
 * Big kills get a 1-2 frame hit-stop (presentation only: the scene skips sim steps).
 */

import type { InputState } from '../engine/inputState';
import { ICON_FIGHT } from '../content/sprites/combat';
import { CURSE_ICONS } from '../content/sprites/mapIcons';
import { CHAPTERS } from '../content/registry';
import { randomSeed } from '../engine/rng';
import { GAME_H, GAME_W } from '../engine/screen';
import { Sim } from '../sim/sim';
import { UI } from '../content/sprites/palette';
import { ICON_ACTIVE, ICON_CONSUMABLE } from '../content/sprites/ui';
import { playEventSound } from '../audio/eventSounds';
import { CHAPTER_MUSIC, MUSIC, bossMusicFor, chapterMusicFor } from '../audio/music/ids';
import { drawText, drawTextCentered, measureText, type TextStyle } from '../render/font';
import { Hud, type HudRect } from '../render/hud';
import { ROOM_OUTER_H, ROOM_OUTER_W, ROOM_OUTER_X, ROOM_OUTER_Y, ROOM_X, ROOM_Y } from '../render/layout';
import { MinimapRenderer } from '../render/minimap';
import { drawPanel } from '../render/pixel';
import { ctx2d, makeCanvas } from '../render/canvas';
import { drawSprite } from '../render/sprites';
import { drawFloorCard, drawIris } from '../render/transitions';
import { WorldFx } from '../render/worldFx';
import { WorldRenderer, itemIcon } from '../render/worldRenderer';
import type { FloorCurse } from '../sim/floor/types';
import type { RunOptions } from '../sim/run/types';
import type { App } from './app';
import type { Scene } from './scene';
import { createRunButtons, drawHudButton, drawMinimapButton, drawSticks, layoutRunButtons, type RunButtons } from './touchControls';
import { tickButtons, uiButton, type UiButton } from './widgets';

const LABEL: TextStyle = { color: UI.textDim, shadow: UI.shadow };
const NOTICE: TextStyle = { color: UI.text, shadow: UI.shadow };
const HINT: TextStyle = { color: '#8e98b5', shadow: UI.shadow };
const END_TITLE: TextStyle = { color: '#ffe9a8', shadow: '#2a1a08', outline: '#07080d', scale: 3 };
const END_SUB: TextStyle = { color: UI.text, shadow: UI.shadow };
const BG = '#07080d';

/** Seconds the stick hints / keyboard hint stay up at the start of a run. */
const HINT_TIME = 7;
const HINT_KEYS_1 = 'WASD MOVE · ARROWS SHOOT · ESC PAUSE';
const HINT_KEYS_2 = 'E BOMB · SPACE ACTIVE · Q CONSUMABLE · F FIGHT';
const HINT_KEYS_RUN = 'E BOMB · SPACE ACTIVE · Q CONSUMABLE · TAB MAP';
/** Hit-stop ticks on the death of a big enemy / a champion. */
const HITSTOP_BIG = 2;
const HITSTOP_CHAMPION = 1;
/** Camera slide between rooms (s), iris close / open for the trapdoor (s), floor card (s). */
const SLIDE_TIME = 0.25;
const IRIS_CLOSE = 0.45;
const IRIS_OPEN = 0.5;
const CARD_TIME = 2.8;
/** Death animation before the game-over card; the card may be dismissed after END_WAIT. */
const DEATH_WAIT = 1.8;
const END_WAIT = 0.8;
const END_AUTO = 8;

/** What to say when the sim refuses an action (GameEvent 'denied' ids). */
const DENIED: Readonly<Record<string, string>> = {
  noBombs: 'NO BOMBS',
  noActive: 'NO ACTIVE ITEM',
  notCharged: 'NOT CHARGED YET',
  noConsumable: 'NOTHING TO USE',
  locked: 'NEEDS A KEY',
  poor: 'NOT ENOUGH COINS',
  noHearts: 'NOT ENOUGH HEARTS',
};

export type RunMode = 'run' | 'yard';

export class RunScene implements Scene {
  readonly name = 'run';
  readonly overlay = false;
  readonly wantsSticks = true;
  readonly buttons: UiButton[];
  readonly mode: RunMode;
  private readonly ui: RunButtons;
  private readonly app: App;
  private readonly renderer = new WorldRenderer();
  private readonly fx: WorldFx;
  private readonly minimap = new MinimapRenderer();
  readonly hud = new Hud();
  sim: Sim;
  private time = 0;
  private notice = '';
  private noticeTime = 0;
  /** Set once the player has used each stick (hints fade out). */
  private usedSticks = false;
  /** Inventory version the button icons were last updated for. */
  private iconsFor = -1;
  /** Training-yard bell: calls the next wave (hidden while one is running). */
  private readonly fight: UiButton;
  /** Run over: a full-screen tap goes back to the title. */
  private readonly endTap: UiButton;
  /** Remaining hit-stop ticks (presentation freeze after big kills). */
  private hitStop = 0;
  private label = '';
  private labelFor = -1;
  // ── Floor-run presentation ──
  /** The last frame's room area (for the camera slide and the iris). */
  private prevRoom: HTMLCanvasElement | null = null;
  private prevCtx: CanvasRenderingContext2D | null = null;
  private slideT = SLIDE_TIME;
  private slideDX = 0;
  private slideDY = 0;
  /** 0 none, 1 closing on the old floor, 2 opening on the new one. */
  private irisPhase = 0;
  private irisT = 0;
  private irisX = 0;
  private irisY = 0;
  private cardT = CARD_TIME;
  private cardTitle = '';
  private cardSub = '';
  private cardCurse: FloorCurse | null = null;
  /** '' running, 'death', 'win'. */
  private ending = '';
  private endT = 0;
  private endSub = '';

  constructor(app: App, mode: RunMode = 'run') {
    this.app = app;
    this.mode = mode;
    this.ui = createRunButtons();
    this.fight = uiButton({ id: 'run.fight', trigger: 'release', icon: ICON_FIGHT, kind: 'hud', pad: 4 });
    this.fight.onActivate = () => this.startWave();
    this.endTap = uiButton({ id: 'run.end', x: 0, y: 0, w: GAME_W, h: GAME_H, pad: 0, visible: false });
    this.endTap.onActivate = () => this.leave();
    this.buttons = [...this.ui.all, this.fight, this.endTap];
    this.fx = new WorldFx(app.particles, app.shake);
    this.sim = this.makeSim();
  }

  private makeSim(): Sim {
    return this.mode === 'run' ? Sim.newRun(randomSeed()) : new Sim({ seed: randomSeed() });
  }

  enter(): void {
    this.prepareRoom();
    this.onLayout();
    if (this.sim.run) {
      this.showFloorCard();
      this.playRoomMusic(true);
    } else {
      this.app.audio.music.play(CHAPTER_MUSIC.gutterways, { fade: 1.5 });
    }
  }

  /** Debug / tests: replaces the sim with a fresh run (any floor, track, curse, seed). */
  restartRun(opts: RunOptions = {}, seed: number | string = randomSeed()): void {
    this.sim = Sim.newRun(seed, opts);
    this.ending = '';
    this.endTap.visible = false;
    this.prepareRoom();
    this.showFloorCard();
    this.playRoomMusic(true);
  }

  /** Fresh training room (the yard restarts after the death animation). */
  private restartRoom(): void {
    this.sim = this.makeSim();
    this.prepareRoom();
  }

  /** Big kills freeze the picture briefly (for tests / tools). */
  get hitStopTicks(): number {
    return this.hitStop;
  }

  private prepareRoom(): void {
    this.renderer.prepare(this.sim.world);
    this.app.particles.clear();
    this.app.shake.reset();
    this.hud.reset();
    this.iconsFor = -1;
    this.time = 0;
    this.hitStop = 0;
    this.labelFor = -1;
  }

  onLayout(): void {
    layoutRunButtons(this.ui, this.app.settings.value.buttonScale);
    // The bell sits under the consumable button in the left margin.
    const c = this.ui.consumable;
    this.fight.x = c.x;
    this.fight.y = c.y + c.h + 6;
    this.fight.w = c.w;
    this.fight.h = c.h;
  }

  /** Training-yard arena: a wave of chapter 1 enemies (F key / bell button). */
  startWave(): number {
    if (!this.sim.trainingRoom) return 0;
    const n = this.sim.startWave();
    if (n === 0 && this.sim.world.arena.active) this.say('FINISH THIS WAVE FIRST');
    return n;
  }

  onBackground(): void {
    this.app.nav.pause();
  }

  onKey(code: string): boolean {
    if (this.ending && this.endT >= END_WAIT) {
      this.leave();
      return true;
    }
    if (code === 'KeyF' && this.sim.trainingRoom) {
      this.startWave();
      return true;
    }
    return false;
  }

  private leave(): void {
    if (!this.ending || this.endT < END_WAIT) return;
    this.app.nav.title();
  }

  private say(text: string, time = 1.4): void {
    this.notice = text;
    this.noticeTime = time;
  }

  /** Is a transition (slide / iris) holding the sim still? */
  private get frozen(): boolean {
    return this.slideT < SLIDE_TIME || this.irisPhase !== 0;
  }

  update(dt: number, input: InputState): void {
    this.time += dt;
    tickButtons(this.buttons, dt);
    if (this.cardT < CARD_TIME) this.cardT += dt;
    if (this.noticeTime > 0) this.noticeTime -= dt;
    if (this.ending) {
      this.endT += dt;
      this.endTap.visible = this.endT >= END_WAIT;
      if (this.endT >= END_AUTO) this.leave();
      this.tickPresentation(dt, false);
      return;
    }
    if (input.pause) {
      this.app.nav.pause();
      return;
    }
    if (input.map) {
      if (this.sim.run) this.app.nav.map();
      else this.say('NO MAP IN THE YARD');
      return;
    }
    // Room slide / trapdoor iris: the world holds still.
    if (this.slideT < SLIDE_TIME) {
      this.slideT += dt;
      this.tickPresentation(dt, false);
      return;
    }
    if (this.irisPhase !== 0) {
      this.irisT += dt;
      if (this.irisPhase === 1 && this.irisT >= IRIS_CLOSE) {
        this.irisPhase = 2;
        this.irisT = 0;
        const p = this.sim.world.player;
        this.irisX = p.x + ROOM_X;
        this.irisY = p.y + ROOM_Y - 6;
        this.app.particles.clear();
      } else if (this.irisPhase === 2 && this.irisT >= IRIS_OPEN) {
        this.irisPhase = 0;
      }
      this.tickPresentation(dt, false);
      return;
    }
    // Hit-stop: hold the picture for a tick or two after a big kill (only when no button edge is
    // pending, so a press is never swallowed).
    if (this.hitStop > 0 && !input.bomb && !input.active && !input.consumable && !input.firePressed) {
      this.hitStop--;
      return;
    }
    this.hitStop = 0;
    if (this.app.input.moveStick.active || this.app.input.aimStick.active) this.usedSticks = true;

    const sim = this.sim;
    sim.step(input);
    const q = sim.events;
    for (let i = 0; i < q.count; i++) {
      const e = q.at(i);
      this.fx.onEvent(e);
      this.hud.onEvent(e);
      playEventSound(this.app.audio, e);
      switch (e.type) {
        case 'denied':
          this.say(DENIED[e.id] ?? 'NOPE');
          break;
        case 'enemyKilled': {
          const stop = (e.b & 4) !== 0 ? HITSTOP_BIG : (e.b & 2) !== 0 ? HITSTOP_CHAMPION : 0;
          if (stop > this.hitStop) this.hitStop = stop;
          break;
        }
        case 'roomClear':
          this.say('ROOM CLEARED!');
          if (sim.run) this.playRoomMusic(false);
          break;
        case 'say':
          this.say(e.id, 2);
          break;
        case 'bell':
          if (e.a === 0) this.say('FINISH THIS WAVE FIRST');
          break;
        case 'roomEnter':
          this.onRoomEnter(e.b);
          break;
        case 'trapdoor':
          if (e.a === 1) this.startIris();
          else this.say('A TRAPDOOR OPENS...', 2);
          break;
        case 'floorStart':
          this.showFloorCard();
          this.app.audio.music.stinger(MUSIC.floorSting, { then: this.chapterTrack() });
          break;
        case 'secretFound':
          this.say(e.b === 2 ? "THE BROKER'S NOOK HAS OPENED" : 'A SECRET!', 2);
          break;
        case 'runEnd':
          this.endRun('win');
          break;
        default:
          break;
      }
    }
    this.fight.visible = this.sim.trainingRoom && !this.sim.world.arena.active && !this.sim.world.player.dead;
    this.tickPresentation(dt, true);

    const p = sim.world.player;
    if (p.dead) {
      if (!sim.run && p.deathTime > 2.2) this.restartRoom();
      else if (sim.run && p.deathTime > DEATH_WAIT) this.endRun('death');
    }
  }

  private tickPresentation(dt: number, stepped: boolean): void {
    const w = this.sim.world;
    if (stepped) this.fx.tick(w, dt);
    this.hud.update(dt, w);
    this.app.particles.update(dt);
    this.app.shake.update(dt);
    this.syncButtonIcons();
  }

  private onRoomEnter(side: number): void {
    this.app.particles.clear();
    this.labelFor = -1;
    if (side >= 0 && this.irisPhase === 0) {
      // Came in through `side`: the camera moves the other way (entering from the north = going south).
      this.slideT = 0;
      this.slideDX = side === 1 ? -1 : side === 3 ? 1 : 0;
      this.slideDY = side === 0 ? 1 : side === 2 ? -1 : 0;
    }
    // A floor change ('floorStart' right after) plays the floor sting into the new chapter loop.
    if (this.irisPhase === 0) this.playRoomMusic(false);
  }

  private startIris(): void {
    const p = this.sim.world.player;
    this.irisPhase = 1;
    this.irisT = 0;
    // The iris closes on where she fell (the old room's image is what's on screen).
    this.irisX = (this.sim.world.trapdoor.x || p.x) + ROOM_X;
    this.irisY = (this.sim.world.trapdoor.y || p.y) + ROOM_Y;
  }

  private showFloorCard(): void {
    const run = this.sim.run;
    if (!run) return;
    const d = run.data;
    const ch = CHAPTERS.get(d.chapter);
    const num = ch ? Math.ceil(ch.floors[0] / 2) : Math.ceil(d.floor / 2);
    this.cardTitle = `CHAPTER ${num} · ${(ch?.name ?? d.chapter).toUpperCase()}`;
    this.cardSub = `FLOOR ${d.floor}${d.track === 'alt' ? ' · THE HIDDEN ROUTE' : ''}`;
    this.cardCurse = d.layout.curse;
    this.cardT = 0;
  }

  private chapterTrack(): string {
    const id = this.sim.run?.data.chapter ?? 'gutterways';
    return chapterMusicFor(id) ?? CHAPTER_MUSIC.gutterways;
  }

  /** Music for the current room: shop / secret themes, boss intro, else the chapter loop. */
  private playRoomMusic(first: boolean): void {
    const run = this.sim.run;
    if (!run) return;
    const music = this.app.audio.music;
    const type = run.room.type;
    const cleared = run.state.cleared;
    if (type === 'shop') music.play(MUSIC.shop);
    else if (type === 'secret' || type === 'deepSecret') music.play(MUSIC.secret);
    else if (type === 'boss' && !cleared) music.stinger(MUSIC.bossIntro, { then: bossMusicFor(run.data.chapter) });
    else if (type === 'miniboss' && !cleared) music.play(MUSIC.miniboss);
    else music.play(this.chapterTrack(), first ? { fade: 1.5 } : undefined);
  }

  private endRun(kind: 'death' | 'win'): void {
    if (this.ending) return;
    this.ending = kind;
    this.endT = 0;
    const d = this.sim.run?.data;
    const ch = d ? CHAPTERS.get(d.chapter) : undefined;
    this.endSub = d ? `FLOOR ${d.floor} · ${(ch?.name ?? '').toUpperCase()} · ${formatTime(d.time)}` : '';
    this.app.audio.music.stinger(kind === 'win' ? MUSIC.victory : MUSIC.gameOver, { stopMusic: true });
  }

  /** The active / consumable buttons show the held item's icon. */
  private syncButtonIcons(): void {
    const inv = this.sim.world.player.inv;
    if (inv.version === this.iconsFor) return;
    this.iconsFor = inv.version;
    this.ui.active.icon = inv.active ? itemIcon(inv.active.id) : ICON_ACTIVE;
    this.ui.consumable.icon = inv.consumables.length ? itemIcon(inv.consumables[0]!) : ICON_CONSUMABLE;
  }

  render(ctx: CanvasRenderingContext2D, alpha: number): void {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    const shake = this.app.shake;
    const world = this.sim.world;
    if (this.slideT < SLIDE_TIME && this.prevRoom) {
      this.renderSlide(ctx);
    } else if (this.irisPhase === 1 && this.prevRoom) {
      ctx.drawImage(this.prevRoom, ROOM_OUTER_X, ROOM_OUTER_Y);
    } else {
      this.renderer.draw(ctx, world, this.frozen ? 1 : alpha, this.time, shake.x, shake.y);
      this.app.particles.draw(ctx, shake.x, shake.y);
      this.fx.attack.drawArcs(ctx, shake.x, shake.y);
      if (this.fx.flash > 0) {
        // Explosion / nova / Storm Lance flash (softer when screen shake is turned down).
        const max = this.fx.flashMax;
        ctx.globalAlpha = Math.min(max, this.fx.flash * max) * (0.4 + 0.6 * Math.min(1, this.app.settings.value.shake));
        ctx.fillStyle = this.fx.flashColor;
        ctx.fillRect(0, 0, GAME_W, GAME_H);
        ctx.globalAlpha = 1;
      }
      if (this.sim.run && this.irisPhase === 0 && !this.ending) this.captureRoom(ctx);
    }
    if (this.irisPhase !== 0) {
      const t = this.irisPhase === 1 ? 1 - Math.min(1, this.irisT / IRIS_CLOSE) : Math.min(1, this.irisT / IRIS_OPEN);
      drawIris(ctx, this.irisX, this.irisY, t * t * 260);
    }
    this.drawHud(ctx);
    if (this.cardT < CARD_TIME && this.irisPhase !== 1) {
      const a = this.cardT < 0.3 ? this.cardT / 0.3 : this.cardT > CARD_TIME - 0.6 ? (CARD_TIME - this.cardT) / 0.6 : 1;
      drawFloorCard(ctx, this.cardTitle, this.cardSub, this.cardCurse, a);
    }
    if (this.ending) this.drawEnding(ctx);
  }

  /** Keeps a copy of the room as drawn (the camera slide / iris start from it). */
  private captureRoom(ctx: CanvasRenderingContext2D): void {
    if (!this.prevRoom) {
      this.prevRoom = makeCanvas(ROOM_OUTER_W, ROOM_OUTER_H);
      this.prevCtx = ctx2d(this.prevRoom);
    }
    this.prevCtx!.drawImage(ctx.canvas, ROOM_OUTER_X, ROOM_OUTER_Y, ROOM_OUTER_W, ROOM_OUTER_H, 0, 0, ROOM_OUTER_W, ROOM_OUTER_H);
  }

  /** Both rooms drawn, the old one sliding out as the new one slides in (clipped to the room). */
  private renderSlide(ctx: CanvasRenderingContext2D): void {
    const t0 = Math.min(1, this.slideT / SLIDE_TIME);
    const t = t0 * t0 * (3 - 2 * t0);
    const dx = this.slideDX * ROOM_OUTER_W;
    const dy = this.slideDY * ROOM_OUTER_H;
    ctx.save();
    ctx.beginPath();
    ctx.rect(ROOM_OUTER_X, ROOM_OUTER_Y, ROOM_OUTER_W, ROOM_OUTER_H);
    ctx.clip();
    ctx.drawImage(this.prevRoom!, Math.round(ROOM_OUTER_X - dx * t), Math.round(ROOM_OUTER_Y - dy * t));
    this.renderer.draw(ctx, this.sim.world, 1, this.time, Math.round(dx * (1 - t)), Math.round(dy * (1 - t)));
    ctx.restore();
  }

  private drawEnding(ctx: CanvasRenderingContext2D): void {
    const a = Math.min(1, this.endT * 2);
    ctx.globalAlpha = a * 0.78;
    ctx.fillStyle = '#04050a';
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    ctx.globalAlpha = a;
    const win = this.ending === 'win';
    drawTextCentered(ctx, win ? 'CLEAR SKIES' : 'THE RAIN TAKES YOU', GAME_W / 2, 62, END_TITLE);
    drawTextCentered(ctx, win ? 'THE STORM IS OVER. FOR NOW.' : 'SOAKED THROUGH...', GAME_W / 2, 92, END_SUB);
    drawTextCentered(ctx, this.endSub, GAME_W / 2, 106, LABEL);
    if (this.endT >= END_WAIT) drawTextCentered(ctx, 'TAP TO CONTINUE', GAME_W / 2, 150, HINT);
    ctx.globalAlpha = 1;
  }

  private drawHud(ctx: CanvasRenderingContext2D): void {
    const banner = this.hud.bannerVisible;
    // Room label over the top wall; short notices ("NO BOMBS") replace it for a moment. Both stay
    // in the top band so nothing covers the room.
    if (this.noticeTime > 0) {
      ctx.globalAlpha = Math.min(1, this.noticeTime * 3);
      drawTextCentered(ctx, this.notice, GAME_W / 2, ROOM_OUTER_Y - 12, NOTICE);
      ctx.globalAlpha = 1;
    } else if (!banner) {
      drawTextCentered(ctx, this.roomLabel(), GAME_W / 2, ROOM_OUTER_Y - 12, LABEL);
    }

    const input = this.app.input;
    const early = this.time < HINT_TIME;
    const hint = !input.touchUsed || this.usedSticks ? 0 : early ? 0.9 : 0.35;
    drawSticks(ctx, input, hint);
    if (!input.touchUsed && early && !banner) {
      const second = this.sim.run ? HINT_KEYS_RUN : HINT_KEYS_2;
      drawText(ctx, HINT_KEYS_1, (GAME_W - measureText(HINT_KEYS_1)) / 2, ROOM_OUTER_Y - 30, HINT);
      drawText(ctx, second, (GAME_W - measureText(second)) / 2, ROOM_OUTER_Y - 22, HINT);
    }
    const all = this.ui.all;
    for (let i = 0; i < all.length; i++) {
      const b = all[i]!;
      if (b === this.ui.map) this.drawMap(ctx, b);
      else drawHudButton(ctx, b);
    }
    drawHudButton(ctx, this.fight);
    this.hud.draw(ctx, this.sim.world, this.ui, this.time);
    // The floor's curse: a small icon left of the minimap.
    const curse = this.sim.world.curse;
    if (curse) drawSprite(ctx, CURSE_ICONS[curse], 0, this.ui.map.x - 10, this.ui.map.y + 2);
  }

  /** The minimap slot: the floor map in a run, the old sketch in the yard. */
  private drawMap(ctx: CanvasRenderingContext2D, b: UiButton): void {
    const run = this.sim.run;
    if (!run) {
      drawMinimapButton(ctx, b);
      return;
    }
    const pressed = b.held > 0;
    ctx.globalAlpha = pressed ? 0.9 : 0.7;
    drawPanel(ctx, b.x, b.y, b.w, b.h, pressed ? '#2a3350' : '#0a0d16', pressed ? '#c9d3f0' : '#56648a');
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.beginPath();
    ctx.rect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    ctx.clip();
    this.minimap.drawCompact(ctx, run.data.layout, run.data.map, b.x, b.y, b.w, b.h, this.time);
    ctx.restore();
  }

  /** Room label: the yard's name / the floor, or the wave in progress (cached per wave / enemy count). */
  private roomLabel(): string {
    const w = this.sim.world;
    const run = this.sim.run;
    let n = 0;
    if (w.arena.active) for (let i = 0; i < w.enemies.count; i++) if (!w.enemies.items[i]!.dead) n++;
    const key = w.arena.active ? w.arena.wave * 1000 + n : -2 - (run ? run.data.current : 0);
    if (key === this.labelFor) return this.label;
    this.labelFor = key;
    if (run) {
      const d = run.data;
      const ch = CHAPTERS.get(d.chapter);
      const place = `${(ch?.name ?? '').toUpperCase()} · FLOOR ${d.floor}`;
      this.label = w.arena.active ? `${n} LEFT` : place;
    } else if (!w.arena.active) {
      this.label = this.sim.autoWaves
        ? 'TRAINING YARD · NEXT WAVE SOON...'
        : this.app.input.touchUsed
          ? 'TRAINING YARD · RING THE BELL TO FIGHT'
          : 'TRAINING YARD · RING THE BELL (OR F) TO FIGHT';
      // Touch / auto-wave changes must refresh the label.
      this.labelFor = -1;
    } else {
      this.label = `WAVE ${w.arena.wave} · ${n} LEFT`;
    }
    return this.label;
  }

  /** HUD element rects in game px (window.__SD.hud()). */
  hudRects(): HudRect[] {
    return this.hud.rects(this.sim.world, this.ui);
  }

  /** Test hook: is a room slide / iris / card / ending showing? */
  get presentation(): { slide: boolean; iris: number; card: boolean; ending: string } {
    return { slide: this.slideT < SLIDE_TIME, iris: this.irisPhase, card: this.cardT < CARD_TIME, ending: this.ending };
  }
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r < 10 ? '0' : ''}${r}`;
}
