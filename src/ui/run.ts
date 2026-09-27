/**
 * The run scene. Owns the headless Sim, steps it with the InputState each fixed tick, and turns its
 * events into particles, shake, sound, music and HUD feedback.
 *
 * - 'run' (New Run): a real run — floors, rooms, doors (sim/run). Walking through a door slides the
 *   camera to the next room (the sim is frozen for the slide), the trapdoor closes an iris and opens
 *   the next floor with its card, the minimap sits in its HUD slot (tap it / Tab for the big map), the
 *   Curse of the Blackout dims the room. Death or the last boss ends the run with a card, then the title.
 * - 'yard' (debug menu): the Phase 2 training yard — F / the bell button call waves, death restarts.
 * Hit-stop (render/hitStop.ts, polish batch 2): the lance release, melee connects, big / champion kills, boss phase
 * changes and hurts hold the picture a few ticks (presentation only: the scene skips sim steps; rate-limited; a press
 * cancels it). A hurt also gets a red edge vignette over the room, a kick away from the source and a mix duck.
 *
 * Saving (Phase 4A, meta/save.ts): a run scene is the save host's run — a new run (or a Continue from a
 * snapshot) is tracked by the meta tracker (collection, bestiary, stats, achievements), saved right away
 * and after every room entry (door, trapdoor, grate: the snapshot is the room-entry checkpoint) and — polish
 * batch 3 — every room clear (the run checkpoints the cleared room); death and victory clear the save. A scene that
 * crashed (main.ts's crash guard) never saves again, so the last good checkpoint stays. Transformations get their
 * fanfare + big banner, first synergies their pill.
 */

import type { InputState } from '../engine/inputState';
import { ICON_FIGHT } from '../content/sprites/combat';
import { CURSE_ICONS } from '../content/sprites/mapIcons';
import { BOSSES, CHAPTERS, CHARACTERS, findItem, findSet, findSynergy } from '../content/registry';
import { BOSS_BAR_W, BOSS_BAR_Y, BossHud } from '../render/bossHud';
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
import { FeatBanner } from '../render/featBanner';
import { drawFloorCard, drawIris } from '../render/transitions';
import { HitStop } from '../render/hitStop';
import { hurtVignette } from '../render/vignette';
import { WARM_BUDGET_MS, warmup } from '../render/warmup';
import { WorldFx } from '../render/worldFx';
import { WorldRenderer, itemIcon } from '../render/worldRenderer';
import type { FloorCurse } from '../sim/floor/types';
import type { RunOptions, RunSeedInfo, RunSnapshot } from '../sim/run/types';
import { randomSeedCode } from '../meta/seedCode';
import type { App, RunEndInfo, RunStart } from './app';
import type { Scene } from './scene';
import { characterDashes } from '../sim/mechanics';
import { CM_NONE } from '../sim/attack/profile';
import { createRunButtons, drawDashCooldown, drawHudButton, drawMinimapButton, drawSticks, layoutRunButtons, minTapSize, type RunButtons } from './touchControls';
import { tickButtons, uiButton, type UiButton } from './widgets';

const LABEL: TextStyle = { color: UI.textDim, shadow: UI.shadow };
const NOTICE: TextStyle = { color: UI.text, shadow: UI.shadow };
const HINT: TextStyle = { color: '#8e98b5', shadow: UI.shadow };
const BG = '#07080d';

/** Seconds the stick hints / keyboard hint stay up at the start of a run. */
const HINT_TIME = 7;
const HINT_KEYS_1 = 'WASD MOVE · ARROWS SHOOT · ESC PAUSE';
const HINT_KEYS_2 = 'E BOMB · SPACE ACTIVE · Q CONSUMABLE · F FIGHT';
const HINT_KEYS_RUN = 'E BOMB · SPACE ACTIVE · Q CONSUMABLE · TAB MAP';
const HINT_KEYS_DASH = 'E BOMB · SPACE ACTIVE · Q ITEM · SHIFT DIG · TAB MAP';
/** Camera slide between rooms (s), iris close / open for the trapdoor (s), floor card (s). */
const SLIDE_TIME = 0.25;
const IRIS_CLOSE = 0.45;
const IRIS_OPEN = 0.5;
const CARD_TIME = 2.8;
/** Death animation before the game-over screen; the beat after a final boss before the ending screen. */
const DEATH_WAIT = 1.8;
const WIN_WAIT = 1.4;

/** What to say when the sim refuses an action (GameEvent 'denied' ids). */
const DENIED: Readonly<Record<string, string>> = {
  noBombs: 'NO BOMBS',
  noActive: 'NO ACTIVE ITEM',
  notCharged: 'NOT CHARGED YET',
  noConsumable: 'NOTHING TO USE',
  locked: 'NEEDS A KEY',
  poor: 'NOT ENOUGH COINS',
  noHearts: 'NOT ENOUGH HEARTS',
  noKeys: 'NOT ENOUGH KEYS',
  full: "YOU CAN'T USE THAT RIGHT NOW",
};

/** Room label names of the special rooms (DESIGN "Rooms"). */
const ROOM_NAMES: Readonly<Partial<Record<string, string>>> = {
  treasure: 'KEEPSAKE ROOM',
  shop: "MAGPIE'S STALL",
  secret: 'HIDEY-HOLE',
  deepSecret: 'FORGOTTEN POCKET',
  challenge: 'RAIN BARREL ARENA',
  cursed: 'THORN ROOM',
  nook: "THE BROKER'S NOOK",
};

/** Real seconds of slow motion when a boss starts dying (the sim runs at half speed meanwhile). */
const SLOWMO_TIME = 1.5;

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
  /** Sim tick the notice was set on (a room entry clears older ones). */
  private noticeTick = -1;
  /** Set once the player has used each stick (hints fade out). */
  private usedSticks = false;
  /** Inventory version the button icons were last updated for. */
  private iconsFor = -1;
  /** Training-yard bell: calls the next wave (hidden while one is running). */
  private readonly fight: UiButton;
  /** How this run was started (character + seed); null = Continue / the yard / debug. */
  private readonly start: RunStart | null;
  /** Route flags ('ending1'…) already unlocked when the run started (the ending screen's "new" notices). */
  private flagsBefore: string[] = [];
  /** Hit-stop: the picture holds a few ticks on big beats (presentation only). */
  private readonly hitStop = new HitStop();
  /** The lance was recharging (its beam still out) last tick: a soft tick when it is ready again under a held stick. */
  private lanceBusy = false;
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
  /** '' running, 'death', 'win' (the game-over / ending screen is up, or about to be). */
  private ending = '';
  private endT = 0;
  /** The end screen was opened. */
  private endShown = false;
  /** The ending reached (1-3) for the ending screen. */
  private endingId = 0;
  /** Boss HP bar + intro card. */
  private readonly bossHud = new BossHud();
  /** Boss death slow motion: real seconds left, and the step-skipping toggle. */
  private slowT = 0;
  private slowSkip = false;
  /** Transformation banner + synergy pill. */
  private readonly feat = new FeatBanner();
  /** Started from a saved run (Continue). */
  readonly resumed: boolean;
  /** The run save was cleared (the run ended). */
  private saveCleared = false;
  /**
   * An exception escaped this scene (main.ts's crash guard): its state can't be trusted, so it is never saved again —
   * the stored save stays the last good checkpoint.
   */
  crashed = false;

  /**
   * `snapshot`: continue a saved run (Sim.fromSnapshot — throws when the snapshot can't be restored;
   * nav.continueRun catches that). `start`: a new run's character and seed (character select); without it a
   * new run is Wren on a random seed.
   */
  constructor(app: App, mode: RunMode = 'run', snapshot: RunSnapshot | null = null, start: RunStart | null = null) {
    this.app = app;
    this.mode = mode;
    this.start = start;
    this.ui = createRunButtons();
    this.fight = uiButton({ id: 'run.fight', trigger: 'release', icon: ICON_FIGHT, kind: 'hud', pad: 4 });
    this.fight.onActivate = () => this.startWave();
    this.buttons = [...this.ui.all, this.fight];
    this.fx = new WorldFx(app.particles, app.shake);
    // Particles and chain arcs are drawn inside the world pass, under the enemy shots (readable in a busy room).
    this.renderer.particles = app.particles;
    this.renderer.arcs = this.fx.attack;
    this.resumed = snapshot !== null && mode === 'run';
    this.sim = this.resumed ? Sim.fromSnapshot(snapshot!) : this.makeSim();
  }

  private makeSim(): Sim {
    if (this.mode !== 'run') return new Sim({ seed: randomSeed() });
    // A new run carries an unlock snapshot (locked items, the ending-gated routes) and its seed code. Typed codes
    // and dailies take the canonical fresh-save snapshot so the code always recreates the same run; a retry
    // replays its original's (meta/unlocks.ts unlocksForRun).
    const s = this.start;
    const seed: RunSeedInfo = s?.seed ?? { code: randomSeedCode(), kind: 'random' };
    const character = s ? CHARACTERS.get(s.character) : undefined;
    return Sim.newRun(s?.simSeed ?? seed.code, { unlocked: this.app.save.unlockedForRun(seed, s?.unlocked), seedInfo: seed }, character);
  }

  enter(): void {
    this.prepareRoom();
    this.onLayout();
    if (this.sim.run) {
      this.showFloorCard();
      this.playRoomMusic(true);
      this.track(!this.resumed);
    } else {
      this.app.audio.music.play(CHAPTER_MUSIC.gutterways, { fade: 1.5 });
    }
  }

  exit(): void {
    // Leaving without an ending (quit to title, the yard): the save stays for Continue.
    const tracker = this.app.save.tracker;
    if (tracker.tracking === this.sim) tracker.detach();
  }

  /** Meta tracking + the first save of this run (a new run is counted; a continued one is not). */
  private track(fresh: boolean): void {
    if (this.mode !== 'run' || !this.sim.run) return;
    const save = this.app.save;
    if (fresh) save.tracker.startRun(this.sim);
    else save.tracker.resumeRun(this.sim);
    this.flagsBefore = [...save.meta.state.unlocks.endings];
    this.saveCleared = false;
    save.saveRunNow();
  }

  /** The run the save service may write now: a floor run in progress (never the yard, never a finished run). */
  savableSim(): Sim | null {
    const sim = this.sim;
    if (this.mode !== 'run' || this.crashed || this.ending || this.saveCleared || !sim.run || sim.run.data.won || sim.world.player.dead) return null;
    return sim;
  }

  /** The run is over (death / victory): no Continue for it. */
  private clearSave(): void {
    if (this.saveCleared || this.mode !== 'run') return;
    this.saveCleared = true;
    this.app.save.clearRun();
  }

  /**
   * Debug / tests: replaces the sim with a fresh run (any floor, track, curse, seed), with the same character as
   * the run being replaced unless `character` (an id) says otherwise.
   */
  restartRun(opts: RunOptions = {}, seed: number | string = randomSeed(), character?: string): void {
    const tracker = this.app.save.tracker;
    if (tracker.tracking === this.sim) tracker.detach();
    const who = (character ? CHARACTERS.get(character) : undefined) ?? this.sim.world.player.character;
    this.sim = Sim.newRun(seed, { ...opts, unlocked: opts.unlocked ?? this.app.save.unlockedForRun() }, who);
    this.ending = '';
    this.endingId = 0;
    this.endShown = false;
    this.slideT = SLIDE_TIME;
    this.irisPhase = 0;
    this.prepareRoom();
    this.showFloorCard();
    this.playRoomMusic(true);
    this.track(true);
  }

  /** Fresh training room (the yard restarts after the death animation). */
  private restartRoom(): void {
    this.sim = this.makeSim();
    this.prepareRoom();
  }

  /** Hit-stop ticks left (for tests / tools). */
  get hitStopTicks(): number {
    return this.hitStop.ticks;
  }

  private prepareRoom(): void {
    this.renderer.prepare(this.sim.world);
    this.app.particles.clear();
    this.app.shake.reset();
    this.hud.reset();
    this.bossHud.reset();
    this.feat.reset();
    this.slowT = 0;
    this.iconsFor = -1;
    this.time = 0;
    this.hitStop.reset();
    this.fx.flash = 0;
    this.fx.hurtT = 0;
    this.labelFor = -1;
    // The character may have changed (debug restarts): its DASH button shows or hides.
    this.onLayout();
  }

  /**
   * Lays the run buttons out for the current settings AND display (polish batch 3): the 44 pt floor in game px depends
   * on the display scale, so main.ts calls this again (`scenes.relayout()`) whenever the layout changes. The bell sits
   * near the consumable button, clear of the stick zone.
   */
  onLayout(): void {
    const s = this.app.settings.value;
    layoutRunButtons(this.ui, s.buttonScale, s.leftHanded, characterDashes(this.sim.world.player.character), {
      minSize: minTapSize(this.app.display.view.scale),
      bell: this.fight,
    });
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
    if (code === 'KeyF' && this.sim.trainingRoom) {
      this.startWave();
      return true;
    }
    return false;
  }

  /** The game-over screen (over the frozen run) or, after a final boss, the ending screen. */
  private showEnd(): void {
    this.endShown = true;
    const meta = this.app.save.meta;
    const newFlags = ['ending1', 'ending2', 'ending3'].filter((f) => meta.isUnlocked('endings', f) && !this.flagsBefore.includes(f));
    const info: RunEndInfo = { sim: this.sim, ending: this.ending === 'win' ? this.endingId || 1 : 0, newFlags };
    if (this.ending === 'win') this.app.nav.victory(info);
    else this.app.nav.gameOver(info);
  }

  private say(text: string, time = 1.4): void {
    this.notice = text;
    this.noticeTime = time;
    this.noticeTick = this.sim.world.tick;
  }

  /** Is a transition (slide / iris) holding the sim still — or slow motion stepping it unevenly? */
  private get frozen(): boolean {
    return this.slideT < SLIDE_TIME || this.irisPhase !== 0 || this.slowT > 0;
  }

  update(dt: number, input: InputState): void {
    this.time += dt;
    // The flash and the hurt vignette fade in real time (through hit-stops and transitions too).
    this.fx.tickFlash(dt);
    tickButtons(this.buttons, dt);
    if (this.cardT < CARD_TIME) this.cardT += dt;
    if (this.noticeTime > 0) this.noticeTime -= dt;
    if (this.ending) {
      this.endT += dt;
      this.tickPresentation(dt, false);
      if (!this.endShown && (this.ending === 'death' || this.endT >= WIN_WAIT)) this.showEnd();
      return;
    }
    if (input.pause) {
      this.app.nav.pause();
      return;
    }
    if (this.mode === 'run') this.app.save.tracker.playTime(dt);
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
    // Hit-stop: hold the picture for a few ticks on a big beat (only when no button edge is pending, so a press is
    // never swallowed). The shake keeps moving so the held frame reads as an impact.
    if (this.hitStop.hold(input.bomb || input.active || input.consumable || input.dash || input.firePressed)) {
      this.app.shake.update(dt);
      return;
    }
    if (this.app.input.moveStick.active || this.app.input.aimStick.active) this.usedSticks = true;
    // A boss's death plays in slow motion: every other tick is skipped (presentation only).
    if (this.slowT > 0) {
      this.slowT -= dt;
      this.slowSkip = !this.slowSkip;
      if (this.slowSkip && !input.bomb && !input.active && !input.consumable && !input.dash && !input.firePressed) {
        this.tickPresentation(dt, false);
        return;
      }
    }

    const sim = this.sim;
    sim.step(input);
    if (sim.run) this.app.save.tracker.afterStep();
    let entered = false;
    let cleared = false;
    let fanfare = false;
    const q = sim.events;
    for (let i = 0; i < q.count; i++) {
      const e = q.at(i);
      this.fx.onEvent(e);
      this.hitStop.onEvent(e, this.time);
      this.hud.onEvent(e);
      this.bossHud.onEvent(e);
      playEventSound(this.app.audio, e);
      switch (e.type) {
        case 'bossIntro':
          // The yard's debug fights get their theme too (runs start it on room entry).
          if (!sim.run) this.app.audio.music.stinger(MUSIC.bossIntro, { then: this.bossTrack(e.id) });
          // Its phase washes and lettering warm up behind the intro card.
          this.renderer.warmBoss(e.id);
          break;
        case 'enemySpawn':
          if (e.b > 0) this.renderer.warmChampion(e.id, e.b);
          break;
        case 'bossDying':
          this.slowT = SLOWMO_TIME;
          this.slowSkip = false;
          break;
        case 'npcSay':
          this.say(e.id, 2.6);
          break;
        case 'donate':
          if (e.b === 1) this.say('THE JAR JINGLES HAPPILY · LUCK UP!', 2.2);
          break;
        case 'slots':
          if (e.a === 2) this.say('THE GUMBALL GAMBLER BURSTS OPEN!', 2);
          else if (e.a === 1) this.say(e.b === 1 ? 'A PRIZE!' : 'NOTHING... TRY AGAIN?', 1.2);
          break;
        case 'trade':
          this.say('OLD PELL: A FAIR TRADE. SAFE TRAVELS...', 2.4);
          break;
        case 'grate':
          if (e.a === 0) this.say('A CRACKED DRAIN GRATE...', 2.2);
          else if (e.a === 1) this.say('THE GRATE GIVES WAY. A HIDDEN ROUTE!', 2.4);
          break;
        case 'denied':
          this.say(DENIED[e.id] ?? 'NOPE');
          break;
        case 'roomClear':
          this.say('ROOM CLEARED!');
          if (sim.run) this.playRoomMusic(false);
          cleared = true;
          break;
        case 'say':
          this.say(e.id, 2);
          break;
        case 'bell':
          if (e.a === 0) this.say('FINISH THIS WAVE FIRST');
          break;
        case 'roomEnter':
          this.onRoomEnter(e.b);
          entered = true;
          break;
        case 'transform': {
          const set = findSet(e.id);
          this.feat.transform(set?.name ?? e.id, set?.desc ?? '');
          if (!fanfare) this.app.audio.music.stinger(MUSIC.itemFanfare);
          fanfare = true;
          break;
        }
        case 'synergy':
          this.feat.synergy(findSynergy(e.id)?.name ?? e.id);
          break;
        case 'trapdoor':
          if (e.a === 1) this.startIris(e.x, e.y);
          else this.say('A TRAPDOOR OPENS...', 2);
          break;
        case 'floorStart':
          // The new chapter's foes and bosses warm up behind the floor card.
          this.renderer.warmFloor(sim.world);
          this.showFloorCard();
          this.app.audio.music.stinger(MUSIC.floorSting, { then: this.chapterTrack() });
          break;
        case 'secretFound':
          this.say(e.b === 2 ? "THE BROKER'S NOOK HAS OPENED" : 'A SECRET!', 2);
          break;
        case 'runEnd':
          this.endingId = e.b;
          this.clearSave();
          this.endRun('win');
          break;
        case 'item':
          this.renderer.warmItem(e.id);
          // The best finds get a little fanfare over the music.
          if (e.b === 1 && !fanfare && (findItem(e.id)?.quality ?? 0) >= 4) {
            this.app.audio.music.stinger(MUSIC.itemFanfare);
            fanfare = true;
          }
          break;
        default:
          break;
      }
    }
    // The lance is ready again while the stick is held: a soft tick, so the re-press never feels dropped.
    const pl = sim.world.player;
    const busy = pl.atk.busy > 0;
    if (this.lanceBusy && !busy && pl.firing && pl.attack.chargeMode !== CM_NONE) this.app.audio.play('charge_tick', 0, 0.5);
    this.lanceBusy = busy;
    this.fight.visible = this.sim.trainingRoom && !this.sim.world.arena.active && !this.sim.world.player.dead;
    this.tickPresentation(dt, true);

    const p = sim.world.player;
    if (p.dead) {
      // No Continue for a run that ended (cleared at once, so closing the app can't dodge the death).
      if (sim.run) this.clearSave();
      if (!sim.run && p.deathTime > 2.2) this.restartRoom();
      else if (sim.run && p.deathTime > DEATH_WAIT) this.endRun('death');
    } else if ((entered || cleared) && sim.run) {
      // Every room entry is a checkpoint (Continue resumes in this room), and so is every clear (the run took one of
      // the cleared room: its trapdoor, rewards and loot survive the app being closed).
      this.app.save.saveRunNow();
    }
  }

  private tickPresentation(dt: number, stepped: boolean): void {
    const w = this.sim.world;
    if (stepped) this.fx.tick(w, dt);
    this.hud.update(dt, w);
    this.bossHud.update(dt, w.boss);
    this.feat.update(dt);
    this.app.particles.update(dt);
    this.app.shake.update(dt);
    this.syncButtonIcons();
  }

  private onRoomEnter(side: number): void {
    this.app.particles.clear();
    this.labelFor = -1;
    // The last room's notice (Magpie's line, "ROOM CLEARED!") doesn't follow her through the door; one
    // raised by this very transition ("THE PIPES SHIFT...") stays.
    if (this.noticeTick !== this.sim.world.tick) this.noticeTime = 0;
    if (side >= 0 && this.irisPhase === 0) {
      // Came in through `side`: the camera moves the other way (entering from the north = going south).
      this.slideT = 0;
      this.slideDX = side === 1 ? -1 : side === 3 ? 1 : 0;
      this.slideDY = side === 0 ? 1 : side === 2 ? -1 : 0;
    }
    // A floor change ('floorStart' right after) plays the floor sting into the new chapter loop.
    if (this.irisPhase === 0) this.playRoomMusic(false);
  }

  /** Closes the iris on (x, y) (room px): where she fell (trapdoor, grate, whirlpool). */
  private startIris(x: number, y: number): void {
    this.irisPhase = 1;
    this.irisT = 0;
    // The iris closes on where she fell (the old room's image is what's on screen).
    this.irisX = x + ROOM_X;
    this.irisY = y + ROOM_Y;
  }

  /** The theme of a boss (its own, a final's, else the chapter's boss theme). */
  private bossTrack(id: string): string {
    const def = BOSSES.get(id);
    if (def?.music) return def.music;
    if (def?.kind === 'miniboss') return MUSIC.miniboss;
    return bossMusicFor(this.sim.run?.data.chapter ?? 'gutterways');
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

  /**
   * Music for the current room: shop / secret themes, the boss intro sting into the boss / final /
   * miniboss theme (bossTrack), else the chapter loop (crossfading back when she walks out).
   */
  private playRoomMusic(first: boolean): void {
    const run = this.sim.run;
    if (!run) return;
    const music = this.app.audio.music;
    const type = run.room.type;
    const cleared = run.state.cleared;
    if (type === 'shop') music.play(MUSIC.shop);
    else if (type === 'secret' || type === 'deepSecret') music.play(MUSIC.secret);
    else if ((type === 'boss' || type === 'miniboss') && !cleared) music.stinger(MUSIC.bossIntro, { then: this.bossTrack(run.state.boss) });
    else music.play(this.chapterTrack(), first ? { fade: 1.5 } : undefined);
  }

  private endRun(kind: 'death' | 'win'): void {
    if (this.ending) return;
    this.ending = kind;
    this.endT = 0;
    this.endShown = false;
    this.app.audio.music.stinger(kind === 'win' ? MUSIC.victory : MUSIC.gameOver, { stopMusic: true });
  }

  /** The active / consumable buttons show the held item's icon. */
  private syncButtonIcons(): void {
    const inv = this.sim.world.player.inv;
    // Empty slots / no bombs: the placeholder glyph is drawn faint so it never reads as an item.
    this.ui.bomb.dim = inv.bombs <= 0;
    this.ui.active.dim = inv.active === null;
    this.ui.consumable.dim = inv.consumables.length === 0;
    if (inv.version === this.iconsFor) return;
    this.iconsFor = inv.version;
    this.ui.active.icon = inv.active ? itemIcon(inv.active.id) : ICON_ACTIVE;
    this.ui.consumable.icon = inv.consumables.length ? itemIcon(inv.consumables[0]!) : ICON_CONSUMABLE;
  }

  render(ctx: CanvasRenderingContext2D, alpha: number): void {
    // Idle-time warm-up: a couple of milliseconds a frame of sprites this floor will need (render/warmup.ts).
    warmup.step(WARM_BUDGET_MS);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    const shake = this.app.shake;
    const world = this.sim.world;
    if (this.slideT < SLIDE_TIME && this.prevRoom) {
      this.renderSlide(ctx);
    } else if (this.irisPhase === 1 && this.prevRoom) {
      ctx.drawImage(this.prevRoom, ROOM_OUTER_X, ROOM_OUTER_Y);
    } else {
      // Explosion / nova / Storm Lance flash: over the room only, under shots and beams (WorldRenderer.draw); softer
      // with the shake turned down, capped low with REDUCE FLASHING.
      const settings = this.app.settings.value;
      this.renderer.flashAlpha = this.fx.flashAlpha(settings.shake, settings.reduceFlashing);
      this.renderer.flashColor = this.fx.flashColor;
      this.renderer.draw(ctx, world, this.frozen ? 1 : alpha, this.time, shake.x, shake.y);
      this.renderer.flashAlpha = 0;
      const hurt = this.fx.hurtAlpha(settings.reduceFlashing);
      if (hurt > 0) {
        // Got hurt: red edges over the room for a moment.
        ctx.globalAlpha = hurt;
        ctx.drawImage(hurtVignette(ROOM_OUTER_W, ROOM_OUTER_H), ROOM_OUTER_X + shake.x, ROOM_OUTER_Y + shake.y);
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
      const d = this.sim.run?.data;
      drawFloorCard(ctx, this.cardTitle, this.cardSub, this.cardCurse, a, this.cardT, d?.floor ?? 0, d?.track === 'alt');
    } else if (this.slideT >= SLIDE_TIME) {
      this.bossHud.drawCard(ctx, world.boss, this.time);
    }
    if (this.irisPhase === 0) this.feat.drawTransform(ctx, this.time);
    // After a final boss, the screen dims for a beat before the ending screen fades in over it.
    if (this.ending === 'win' && !this.endShown) {
      ctx.globalAlpha = Math.min(0.6, this.endT * 0.5);
      ctx.fillStyle = '#04050a';
      ctx.fillRect(0, 0, GAME_W, GAME_H);
      ctx.globalAlpha = 1;
    }
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

  private drawHud(ctx: CanvasRenderingContext2D): void {
    const banner = this.hud.bannerVisible;
    const boss = this.sim.world.boss;
    // Room label over the top wall; short notices ("NO BOMBS") replace it for a moment. Both stay
    // in the top band so nothing covers the room. During a boss fight its HP bar takes that place
    // (notices then sit above it).
    const pill = this.feat.synergyVisible;
    if (pill) this.feat.drawSynergy(ctx, boss.active);
    if (boss.active) {
      this.bossHud.drawBar(ctx, boss, this.time);
      if (this.noticeTime > 0 && !banner) {
        ctx.globalAlpha = Math.min(1, this.noticeTime * 3);
        drawTextCentered(ctx, this.notice, GAME_W / 2, ROOM_OUTER_Y - 30, NOTICE);
        ctx.globalAlpha = 1;
      }
    } else if (pill) {
      // The synergy pill has the label's place for a moment.
    } else if (this.noticeTime > 0) {
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
      const second = !this.sim.run ? HINT_KEYS_2 : this.ui.dash.visible ? HINT_KEYS_DASH : HINT_KEYS_RUN;
      drawText(ctx, HINT_KEYS_1, (GAME_W - measureText(HINT_KEYS_1)) / 2, ROOM_OUTER_Y - 30, HINT);
      drawText(ctx, second, (GAME_W - measureText(second)) / 2, ROOM_OUTER_Y - 22, HINT);
    }
    const all = this.ui.all;
    for (let i = 0; i < all.length; i++) {
      const b = all[i]!;
      if (b === this.ui.map) this.drawMap(ctx, b);
      else drawHudButton(ctx, b);
    }
    const mech = this.sim.world.player.mech;
    drawDashCooldown(ctx, this.ui.dash, mech.dashCooldown > 0 ? mech.dashCd / mech.dashCooldown : 0);
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
    const key = w.arena.active ? w.arena.wave * 1000 + n : -2 - (run ? run.data.current + run.state.plate * 100 : 0);
    if (key === this.labelFor) return this.label;
    this.labelFor = key;
    if (run) {
      const d = run.data;
      const ch = CHAPTERS.get(d.chapter);
      const type = run.room.type;
      const special = ROOM_NAMES[type];
      let place = special ? `${special} · FLOOR ${d.floor}` : `${(ch?.name ?? '').toUpperCase()} · FLOOR ${d.floor}`;
      if (type === 'challenge' && run.state.plate === 0 && !run.state.cleared) place = 'RAIN BARREL ARENA · STEP ON THE PLATE';
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
    const rects = this.hud.rects(this.sim.world, this.ui);
    if (this.sim.world.boss.active) {
      rects.push({ id: 'bossBar', x: Math.round((GAME_W - BOSS_BAR_W) / 2) - 2, y: BOSS_BAR_Y - 9, w: BOSS_BAR_W + 4, h: 18 });
    }
    return rects;
  }

  /** Test hook: is a room slide / iris / card / ending / boss card / slow motion showing? */
  get presentation(): {
    slide: boolean;
    iris: number;
    card: boolean;
    ending: string;
    bossCard: boolean;
    slowmo: boolean;
    endingId: number;
    notice: string;
  } {
    return {
      slide: this.slideT < SLIDE_TIME,
      iris: this.irisPhase,
      card: this.cardT < CARD_TIME,
      ending: this.ending,
      bossCard: this.bossHud.cardVisible,
      slowmo: this.slowT > 0,
      endingId: this.endingId,
      notice: this.noticeTime > 0 ? this.notice : '',
    };
  }
}
