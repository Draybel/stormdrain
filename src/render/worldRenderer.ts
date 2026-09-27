/**
 * Draws the simulated world in layer order (ARCHITECTURE §8):
 * room background → doors → floor effects (creep, shockwaves, markers, mounds) → shadows → fires →
 * pedestals/items → pickups → bombs → dummies → enemies behind the player → familiars → player (with
 * costume layers and the charge meter) → enemies in front / in the air → swipes → player shots (+ additive
 * glow) → beams (additive) → enemy shots. Positions are interpolated between
 * the last two sim ticks by `alpha` for smooth motion on displays faster than 60 Hz. Nothing here
 * allocates per frame.
 */

import { lerp } from '../engine/math';
import { findItem } from '../content/registry';
import type { World } from '../sim/world';
import type { Player } from '../sim/player';
import { PK } from '../sim/pickupKinds';
import { ROOM_COLS, ROOM_ROWS, TILE } from '../sim/constants';
import { Tile } from '../sim/tiles';
import { PLAYER_TUNING, SHOP_TUNING } from '../sim/tuning';
import type { SpriteDef } from '../sim/types';
import { WREN_FRAME } from '../content/sprites/wren';
import { DUMMY_SPRITE } from '../content/sprites/props';
import { BELL_SPRITE } from '../content/sprites/combat';
import { FIRE_BASE_SPRITE, FLAME_SPRITE } from '../content/sprites/obstacles';
import {
  BOMB_SPRITE,
  COIN_COPPER_SPRITE,
  COIN_GOLD_SPRITE,
  COIN_LUCKY_SPRITE,
  COIN_SILVER_SPRITE,
  EMBER_HEART_SPRITE,
  KEY_SPRITE,
  LOCKBOX_SPRITE,
  PEDESTAL_SPRITE,
  RED_HEART_SPRITE,
  SATCHEL_SPRITE,
  SPARK_FULL_SPRITE,
  SPARK_SMALL_SPRITE,
  TIN_HEART_SPRITE,
} from '../content/sprites/pickups';
import { ICON_CONSUMABLE } from '../content/sprites/ui';
import { BLIND_ITEM_SPRITE, TRAPDOOR_SPRITE } from '../content/sprites/doors';
import { HUD_COIN_ICON, HUD_KEY_ICON } from '../content/sprites/pickups';
import { HEART_SPRITE } from '../content/sprites/ui';
import {
  DONATION_JAR_SPRITE,
  DRAIN_GRATE_SPRITE,
  GUMBALL_GAMBLER_SPRITE,
  MAGPIE_SPRITE,
  MOTH_BROKER_SPRITE,
  OLD_PELL_SPRITE,
  PRESSURE_PLATE_SPRITE,
  WHIRLPOOL_SPRITE,
} from '../content/sprites/specialRooms';
import { TRAPDOOR_OPEN_TIME } from '../sim/doors';
import { containers } from '../sim/health';
import { haggled, type Pedestal } from '../sim/pedestals';
import { Pickup } from '../sim/pickups';
import { NPC_BROKER, NPC_MAGPIE } from '../sim/roomProps';
import { PROP_JAR, PROP_SLOTS, PROP_TRADER } from '../sim/shopProps';
import { ctx2d, makeCanvas } from './canvas';
import { drawText, measureText, type TextStyle } from './font';
import { DarknessLayer } from './lighting';
import { drawDoors, prepareDoors } from './doors';
import { AttackRenderer } from './attackRenderer';
import { EnemyRenderer } from './enemyRenderer';
import { ROOM_OUTER_H, ROOM_OUTER_W, ROOM_OUTER_X, ROOM_OUTER_Y, ROOM_X, ROOM_Y } from './layout';
import { drawShadow, glowSprite } from './pixel';
import { RoomBackground } from './roomBg';
import { drawSpriteAnchored, getFlash, getFrame } from './sprites';

const WALK_DOWN = [WREN_FRAME.downStepL, WREN_FRAME.downStand, WREN_FRAME.downStepR, WREN_FRAME.downStand];
const WALK_UP = [WREN_FRAME.upStepL, WREN_FRAME.upStand, WREN_FRAME.upStepR, WREN_FRAME.upStand];
const WALK_SIDE = [WREN_FRAME.sideSpread, WREN_FRAME.sideTogether, WREN_FRAME.sideSpread, WREN_FRAME.sideTogether];
const DEATH = [WREN_FRAME.hurt, WREN_FRAME.deathSlump, WREN_FRAME.deathHeap];
/** Pixels walked per walk-cycle frame. */
const STRIDE = 5;
/** How high a flying player floats (px). */
const FLY_HEIGHT = 4;

/** An item's icon, or a stand-in while its art is a placeholder string. */
export function itemIcon(id: string): SpriteDef {
  const def = findItem(id);
  return def && typeof def.sprite !== 'string' ? def.sprite : ICON_CONSUMABLE;
}

export class WorldRenderer {
  private readonly bg = new RoomBackground();
  private readonly enemies = new EnemyRenderer();
  /** Shots, beams, swipes, familiars, costumes and the charge meter (the attack pipeline). */
  readonly attack = new AttackRenderer();
  private readonly fireGlow = glowSprite(15, '255,120,40', 0.55);
  private readonly itemGlow = glowSprite(11, '255,214,120', 0.45);
  private readonly sparkGlow = glowSprite(6, '120,210,255', 0.6);
  private readonly fuseGlow = glowSprite(4, '255,200,90', 0.9);
  private readonly trapGlow = glowSprite(12, '120,150,255', 0.35);
  private readonly skyGlow = glowSprite(14, '255,236,170', 0.6);
  private readonly whirlGlow = glowSprite(16, '90,150,220', 0.4);
  /** The skylight's shaft of sun (cached). */
  private shaft: HTMLCanvasElement | null = null;
  /** Shop goods are drawn with the pickup art (a scratch pickup, never simulated). */
  private readonly goods = new Pickup();
  /** Curse of Darkness. */
  readonly darkness = new DarknessLayer();

  /** Warm caches (room background, sprite frames) so the first frames don't hitch. */
  prepare(world: World): void {
    this.bg.get(world.room, world.chapter);
    for (let f = 0; f < world.player.character.sprite.frames.length; f++) getFrame(world.player.character.sprite, f);
    getFrame(DUMMY_SPRITE, 0);
    getFrame(DUMMY_SPRITE, 1);
    for (const s of [PEDESTAL_SPRITE, BELL_SPRITE, BOMB_SPRITE, SATCHEL_SPRITE, LOCKBOX_SPRITE, FLAME_SPRITE, FIRE_BASE_SPRITE]) {
      for (let f = 0; f < s.frames.length; f++) getFrame(s, f);
    }
    getFlash(BOMB_SPRITE, 0);
    this.enemies.prepare();
    prepareDoors();
  }

  /**
   * @param alpha interpolation factor between the previous and current tick (0..1)
   * @param time  seconds (presentation clock, for idle blinks etc.)
   * @param sx,sy screen-shake offset in px
   */
  draw(ctx: CanvasRenderingContext2D, world: World, alpha: number, time: number, sx: number, sy: number): void {
    ctx.drawImage(this.bg.get(world.room, world.chapter), ROOM_OUTER_X + sx, ROOM_OUTER_Y + sy);
    // Everything stays inside the room's outer rect (big bosses near a wall never spill over the HUD).
    ctx.save();
    ctx.beginPath();
    ctx.rect(ROOM_OUTER_X + sx, ROOM_OUTER_Y + sy, ROOM_OUTER_W, ROOM_OUTER_H);
    ctx.clip();
    drawDoors(ctx, world.doors, world.arena.doors, sx, sy, time);
    const ox = ROOM_X + sx;
    const oy = ROOM_Y + sy;
    const p = world.player;
    const px = lerp(p.prevX, p.x, alpha) + ox;
    const py = lerp(p.prevY, p.y, alpha) + oy;
    this.drawWallNpc(ctx, world, ox, oy, time);
    this.drawTrapdoor(ctx, world, ox, oy, time);
    this.drawFloorProps(ctx, world, ox, oy, time);
    this.enemies.drawFloor(ctx, world, alpha, ox, oy, time);

    // Shadows first so everything stands on the ground.
    const dummies = world.dummies;
    for (let i = 0; i < dummies.count; i++) {
      const d = dummies.items[i]!;
      drawShadow(ctx, d.x + ox, d.y + oy + 1, d.popped ? 6 : 13);
    }
    const peds = world.pedestals;
    for (let i = 0; i < peds.count; i++) drawShadow(ctx, peds.items[i]!.x + ox, peds.items[i]!.y + oy + 5, 14);
    const pks = world.pickups;
    for (let i = 0; i < pks.count; i++) {
      const k = pks.items[i]!;
      const big = k.kind === PK.Satchel || k.kind === PK.Lockbox;
      const zShrink = k.z > 4 ? 2 : 0;
      drawShadow(ctx, lerp(k.prevX, k.x, alpha) + ox, lerp(k.prevY, k.y, alpha) + oy + 1, (big ? 13 : 7) - zShrink);
    }
    const bombs = world.bombs;
    for (let i = 0; i < bombs.count; i++) {
      const b = bombs.items[i]!;
      drawShadow(ctx, lerp(b.prevX, b.x, alpha) + ox, lerp(b.prevY, b.y, alpha) + oy + 1, 9);
    }
    drawShadow(ctx, px, py + 3, p.flags.flying ? 9 : 11);
    this.enemies.drawShadows(ctx, world, alpha, ox, oy);
    this.attack.drawShadows(ctx, world, alpha, ox, oy);

    this.drawFires(ctx, world, ox, oy, time);
    this.drawPedestals(ctx, world, ox, oy, time);
    this.drawPickups(ctx, world, alpha, ox, oy, time);
    this.drawBombs(ctx, world, alpha, ox, oy);
    this.drawDummies(ctx, world, ox, oy);
    const playerY = py - oy;
    this.enemies.drawEnemies(ctx, world, alpha, ox, oy, time, 0, playerY);
    this.attack.begin();
    this.attack.drawFamiliars(ctx, world, alpha, ox, oy, time);
    this.drawPlayer(ctx, p, px, py, time);
    this.enemies.drawEnemies(ctx, world, alpha, ox, oy, time, 1, playerY);
    this.attack.drawSwipes(ctx, world, ox, oy);
    this.attack.drawShots(ctx, world, alpha, ox, oy);
    this.attack.drawBeams(ctx, world, ox, oy, time);
    this.enemies.drawBeams(ctx, world, alpha, ox, oy, time);
    this.enemies.drawShots(ctx, world, alpha, ox, oy, time);
    if (world.props.skylight.active) this.drawSkylight(ctx, world, ox, oy, time);
    this.attack.drawChargeMeter(ctx, p, px, py, time);
    if (world.curse === 'darkness' && !p.flags.darkVision) this.darkness.draw(ctx, world, px, py, sx, sy, time);
    ctx.restore();
  }

  /** The trapdoor to the next floor (swings open, then a dark hole with a faint blue glow). */
  private drawTrapdoor(ctx: CanvasRenderingContext2D, world: World, ox: number, oy: number, time: number): void {
    const t = world.trapdoor;
    if (!t.active) return;
    const open = t.t / TRAPDOOR_OPEN_TIME;
    const frame = open < 0.35 ? 0 : open < 0.8 ? 1 : 2;
    const x = Math.round(t.x + ox) - 8;
    const y = Math.round(t.y + oy) - 8;
    ctx.drawImage(getFrame(TRAPDOOR_SPRITE, frame), x, y);
    if (frame === 2) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.45 + 0.2 * Math.sin(time * 3);
      ctx.drawImage(this.trapGlow, x + 8 - 12, y + 8 - 12);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  /** Magpie / the Moth Broker perched on the top wall's ledge (they react to sales and empty purses). */
  private drawWallNpc(ctx: CanvasRenderingContext2D, world: World, ox: number, oy: number, time: number): void {
    const pr = world.props;
    if (pr.npc === 0) return;
    const def = pr.npc === NPC_MAGPIE ? MAGPIE_SPRITE : pr.npc === NPC_BROKER ? MOTH_BROKER_SPRITE : null;
    if (!def) return;
    const anims = def.anims!;
    const anim = pr.npcMood === 1 ? anims.happy : pr.npcMood === 2 ? anims.no : anims.idle;
    const frames = (anim ?? anims.idle)!.frames;
    const frame = frames[Math.floor(time * (anim?.fps ?? 2)) % frames.length]!;
    const hop = pr.npcMood === 1 && pr.npcT < 0.3 ? -2 : 0;
    drawSpriteAnchored(ctx, def, frame, pr.npcX + ox, oy - 1 + hop);
  }

  /** Floor objects: the arena's pressure plate, the drain grate, the whirlpool. */
  private drawFloorProps(ctx: CanvasRenderingContext2D, world: World, ox: number, oy: number, time: number): void {
    const pr = world.props;
    const plate = pr.plate;
    if (plate.active) {
      const x = Math.round(plate.x + ox);
      const y = Math.round(plate.y + oy);
      ctx.drawImage(getFrame(PRESSURE_PLATE_SPRITE, plate.state), x - 8, y - 8);
      if (plate.state === 0) {
        // A gentle pulse invites a step.
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.25 + 0.2 * Math.sin(time * 4);
        ctx.drawImage(this.whirlGlow, x - 16, y - 16);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    const g = pr.grate;
    if (g.active) {
      const x = Math.round(g.x + ox);
      const y = Math.round(g.y + oy);
      ctx.drawImage(getFrame(DRAIN_GRATE_SPRITE, g.state), x - 8, y - 8);
    }
    const wp = pr.whirlpool;
    if (wp.active) {
      const x = Math.round(wp.x + ox);
      const y = Math.round(wp.y + oy);
      const grow = Math.min(1, wp.t / 0.8);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5 + 0.2 * Math.sin(time * 3);
      ctx.drawImage(this.whirlGlow, x - 16, y - 16);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      const img = getFrame(WHIRLPOOL_SPRITE, Math.floor(time * 8) & 3);
      const s = Math.max(4, Math.round(24 * grow));
      ctx.drawImage(img, x - (s >> 1), y - (s >> 1), s, s);
    }
    const sk = pr.skylight;
    if (sk.active) {
      // The sunny patch on the floor (the shaft itself is drawn over everything).
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, sk.t / 0.8) * (0.7 + 0.2 * Math.sin(time * 2));
      ctx.drawImage(this.skyGlow, Math.round(sk.x + ox) - 14, Math.round(sk.y + oy) - 14);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  /** The skylight after a final boss: a shaft of sun from the ceiling onto its spot. */
  private drawSkylight(ctx: CanvasRenderingContext2D, world: World, ox: number, oy: number, time: number): void {
    const sk = world.props.skylight;
    if (!this.shaft) {
      const h = 120;
      const c = makeCanvas(18, h);
      const g = ctx2d(c);
      for (let y = 0; y < h; y++) {
        const a = 0.08 + 0.3 * (y / h);
        for (let x = 0; x < 18; x++) {
          const edge = 1 - Math.abs(x - 8.5) / 9;
          g.fillStyle = `rgba(255,240,190,${(a * edge * edge).toFixed(3)})`;
          g.fillRect(x, y, 1, 1);
        }
      }
      this.shaft = c;
    }
    const x = Math.round(sk.x + ox);
    const y = Math.round(sk.y + oy);
    const k = Math.min(1, sk.t / 0.8);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = k * (0.85 + 0.15 * Math.sin(time * 3));
    ctx.drawImage(this.shaft, x - 9, y - 120);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawFires(ctx: CanvasRenderingContext2D, world: World, ox: number, oy: number, time: number): void {
    const room = world.room;
    for (let r = 0; r < ROOM_ROWS; r++) {
      for (let c = 0; c < ROOM_COLS; c++) {
        const i = r * ROOM_COLS + c;
        if (room.tiles[i] !== Tile.Fire) continue;
        const x = c * TILE + ox;
        const y = r * TILE + oy;
        const hp = room.hp[i]!;
        const flicker = 0.75 + 0.25 * Math.sin(time * 13 + c * 1.7 + r);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = (0.5 + 0.5 * (hp / 4)) * flicker;
        ctx.drawImage(this.fireGlow, x + 8 - 15, y + 7 - 15);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(getFrame(FIRE_BASE_SPRITE, 0), x, y + 9);
        // Fewer hits left → a lower flame (top rows cut off).
        const frame = getFrame(FLAME_SPRITE, Math.floor(time * 9 + c * 0.7 + r * 0.3) % 3);
        const rows = Math.max(5, 13 - (4 - hp) * 2);
        const top = 13 - rows;
        ctx.drawImage(frame, 0, top, 12, rows, x + 2, y + 11 - rows, 12, rows);
      }
    }
  }

  private drawPedestals(ctx: CanvasRenderingContext2D, world: World, ox: number, oy: number, time: number): void {
    const peds = world.pedestals;
    for (let i = 0; i < peds.count; i++) {
      const ped = peds.items[i]!;
      const x = ped.x + ox;
      const y = ped.y + oy;
      if (ped.bell) {
        // The yard bell swings for a moment after a ring.
        const t = ped.changedT;
        const swing = t < 0.9 ? Math.sin(t * 24) * (1 - t / 0.9) : 0;
        drawSpriteAnchored(ctx, BELL_SPRITE, swing > 0.3 ? 2 : swing < -0.3 ? 1 : 0, x, y + 5);
        continue;
      }
      if (ped.prop === PROP_JAR) {
        // Fuller with every luck threshold passed; a little jolt when a coin drops in.
        const n = world.counters.donated;
        const frame = n >= SHOP_TUNING.jarThresholds[2]! ? 2 : n >= SHOP_TUNING.jarThresholds[0]! ? 1 : 0;
        const jolt = ped.changedT < 0.12 ? -1 : 0;
        drawSpriteAnchored(ctx, DONATION_JAR_SPRITE, frame, x, y + 6 + jolt);
        continue;
      }
      if (ped.prop === PROP_SLOTS) {
        const frame = ped.broken ? 3 : ped.spinT > 0 ? 1 + (Math.floor(time * 14) & 1) : 0;
        const shake = ped.spinT > 0 ? ((time * 40) | 0) % 2 : 0;
        drawSpriteAnchored(ctx, GUMBALL_GAMBLER_SPRITE, frame, x + shake, y + 7);
        if (!ped.broken && ped.spinT <= 0) drawPrice(ctx, world, 1, PRICE_COINS, x, y + 9);
        continue;
      }
      if (ped.prop === PROP_TRADER) {
        drawSpriteAnchored(ctx, OLD_PELL_SPRITE, Math.floor(time * 1.5) & 1, x, y + 7);
        if (ped.item) {
          this.drawOffer(ctx, world, ped, x, y - 12, time, i);
          drawPrice(ctx, world, haggled(world, ped.keys), PRICE_KEYS, x, y + 9);
        }
        continue;
      }
      if (ped.goods >= 0) {
        // Goods on a little striped cushion, the price tag in front.
        ctx.fillStyle = '#5a2a3a';
        ctx.fillRect(Math.round(x) - 6, Math.round(y) + 1, 12, 4);
        ctx.fillStyle = '#8a3a4a';
        ctx.fillRect(Math.round(x) - 6, Math.round(y) + 1, 12, 1);
        ctx.fillRect(Math.round(x) - 3, Math.round(y) + 2, 2, 3);
        ctx.fillRect(Math.round(x) + 2, Math.round(y) + 2, 2, 3);
        const g = this.goods;
        g.kind = ped.goods as Pickup['kind'];
        g.opened = false;
        g.z = 0;
        g.phase = (i * 0.37) % 1;
        drawPickup(ctx, g, Math.round(x), Math.round(y + 1), time, this.sparkGlow, false);
        drawPrice(ctx, world, haggled(world, ped.price), PRICE_COINS, x, y + 7);
        continue;
      }
      drawSpriteAnchored(ctx, PEDESTAL_SPRITE, 0, x, y + 5);
      if (!ped.item) continue;
      this.drawOffer(ctx, world, ped, x, y, time, i);
      // Price tag (shop: coins, Broker's Nook: heart containers — or Tin hearts — ) on the plinth's front.
      if (ped.price > 0) drawPrice(ctx, world, haggled(world, ped.price), PRICE_COINS, x, y + 7);
      else if (ped.hearts > 0) {
        const tin = containers(world.player.health) === 0;
        drawPrice(ctx, world, tin ? ped.hearts * SHOP_TUNING.tinPerContainer : ped.hearts, tin ? PRICE_TIN : PRICE_HEARTS, x, y + 7);
      } else if (ped.keys > 0) drawPrice(ctx, world, haggled(world, ped.keys), PRICE_KEYS, x, y + 7);
    }
  }

  /** The item floating over a pedestal / trader: glow, bob, flash-in, dimmed while blocked. */
  private drawOffer(ctx: CanvasRenderingContext2D, world: World, ped: Pedestal, x: number, y: number, time: number, i: number): void {
    {
      const bob = Math.round(Math.sin(time * 2.6 + i * 1.3) * 1.5);
      const icon = world.curse === 'blind' ? BLIND_ITEM_SPRITE : itemIcon(ped.item);
      const img = getFrame(icon, 0);
      const ix = Math.round(x - img.width / 2);
      const iy = Math.round(y - 8 - img.height + bob);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.55 + 0.2 * Math.sin(time * 3 + i);
      ctx.drawImage(this.itemGlow, Math.round(x) - 11, iy + (img.height >> 1) - 11);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      // A swapped-back item is slightly dimmed until you step away.
      if (ped.blocked) ctx.globalAlpha = 0.7;
      ctx.drawImage(img, ix, iy);
      ctx.globalAlpha = 1;
      // A fresh item appearing / being swapped in flashes white for a moment.
      if (ped.changedT < 0.12) {
        ctx.globalAlpha = 1 - ped.changedT / 0.12;
        ctx.drawImage(getFlash(icon, 0), ix, iy);
        ctx.globalAlpha = 1;
      }
    }
  }

  private drawPickups(ctx: CanvasRenderingContext2D, world: World, alpha: number, ox: number, oy: number, time: number): void {
    const pks = world.pickups;
    for (let i = 0; i < pks.count; i++) {
      const k = pks.items[i]!;
      const x = Math.round(lerp(k.prevX, k.x, alpha) + ox);
      const y = Math.round(lerp(k.prevY, k.y, alpha) + oy - lerp(k.prevZ, k.z, alpha));
      drawPickup(ctx, k, x, y, time, this.sparkGlow, world.curse === 'blind');
    }
  }

  private drawBombs(ctx: CanvasRenderingContext2D, world: World, alpha: number, ox: number, oy: number): void {
    const bombs = world.bombs;
    for (let i = 0; i < bombs.count; i++) {
      const b = bombs.items[i]!;
      const x = Math.round(lerp(b.prevX, b.x, alpha) + ox);
      const y = Math.round(lerp(b.prevY, b.y, alpha) + oy);
      // Blinks faster and faster as the fuse burns down.
      const left = b.maxFuse > 0 ? b.fuse / b.maxFuse : 0;
      const rate = 3 + (1 - left) * (1 - left) * 16;
      const flash = (Math.floor(b.age * rate * 2) & 1) === 1;
      drawSpriteAnchored(ctx, BOMB_SPRITE, 0, x, y + 1, false, flash);
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(this.fuseGlow, x + 3 - 4, y - 9 - 4);
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  private drawDummies(ctx: CanvasRenderingContext2D, world: World, ox: number, oy: number): void {
    const dummies = world.dummies;
    for (let i = 0; i < dummies.count; i++) {
      const d = dummies.items[i]!;
      const x = d.x + ox;
      const y = d.y + oy;
      if (d.popped) {
        drawSpriteAnchored(ctx, DUMMY_SPRITE, 1, x, y + 1);
        continue;
      }
      // Grow back in: rise out of the stake over the first 0.18 s.
      const rise = d.age < 0.18 ? Math.round((1 - d.age / 0.18) * 8) : 0;
      const nx = Math.round(d.nudgeX);
      const ny = Math.round(d.nudgeY * 0.5);
      if (rise > 0) drawSpriteAnchored(ctx, DUMMY_SPRITE, 1, x, y + 1);
      drawSpriteAnchored(ctx, DUMMY_SPRITE, 0, x + nx, y + 1 + ny + rise, false, d.flash > 0);
      // Tiny health bar once damaged.
      if (d.hp < d.maxHp) {
        const w = 12;
        const bx = Math.round(x) - (w >> 1);
        const by = Math.round(y) - 21 + ny;
        ctx.fillStyle = '#0d0b14';
        ctx.fillRect(bx - 1, by - 1, w + 2, 4);
        ctx.fillStyle = '#3a1d26';
        ctx.fillRect(bx, by, w, 2);
        ctx.fillStyle = '#e0515a';
        ctx.fillRect(bx, by, Math.max(1, Math.round((w * d.hp) / d.maxHp)), 2);
      }
    }
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, p: Player, x: number, y: number, time: number): void {
    const sprite = p.character.sprite;
    // i-frame flicker (not while dead).
    if (!p.dead && p.invuln > 0 && p.hurtTimer <= 0 && Math.floor(p.invuln * 20) % 2 === 0) return;

    let frame: number = WREN_FRAME.downStand;
    let flip = false;
    let bob = 0;
    let flash = false;
    const holding = !p.dead && p.holdItem !== '';
    if (p.dead) {
      frame = DEATH[Math.min(DEATH.length - 1, Math.floor(p.deathTime * 6))]!;
    } else if (p.hurtTimer > 0) {
      frame = WREN_FRAME.hurt;
      flash = p.hurtTimer > PLAYER_TUNING.hurtPose - 0.08;
    } else if (holding) {
      // Face the camera and show off the new item.
      frame = WREN_FRAME.downStand;
    } else {
      const moving = p.vx * p.vx + p.vy * p.vy > 12 * 12;
      const phase = Math.floor(p.walkDist / STRIDE) & 3;
      if (p.faceY < 0) {
        frame = moving ? WALK_UP[phase]! : WREN_FRAME.upStand;
      } else if (p.faceY > 0) {
        frame = moving ? WALK_DOWN[phase]! : WREN_FRAME.downStand;
        if (!moving && time % 3.4 < 0.12) frame = WREN_FRAME.downBlink;
      } else {
        frame = moving ? WALK_SIDE[phase]! : WREN_FRAME.sideTogether;
        flip = p.faceX < 0;
      }
      // Bounce on the passing frames of the walk cycle.
      if (moving && (phase & 1) === 1) bob = -1;
    }
    // Flying: float above the ground with a slow hover.
    if (p.flags.flying && !p.dead) bob = -FLY_HEIGHT + Math.round(Math.sin(time * 5) * 1);
    // Recoil: a 1 px kick opposite the shot for a couple of frames.
    let rx = 0;
    let ry = 0;
    if (!p.dead && p.sinceShot < 0.05) {
      rx = -Math.round(p.aimX);
      ry = -Math.round(p.aimY);
    }
    const cx = x + rx;
    const cy = y + 4 + bob + ry;
    this.attack.drawCostumes(ctx, p, cx, cy, true, flip, time);
    drawSpriteAnchored(ctx, sprite, frame, cx, cy, flip, flash);
    this.attack.drawCostumes(ctx, p, cx, cy, false, flip, time);

    if (holding) {
      const icon = itemIcon(p.holdItem);
      const img = getFrame(icon, 0);
      const ix = Math.round(x - img.width / 2);
      const lift = Math.min(1, (0.8 - p.holdTime) * 10);
      const iy = Math.round(y - 11 - img.height + bob - lift * 3);
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(this.itemGlow, Math.round(x) - 11, iy + (img.height >> 1) - 11);
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(img, ix, iy);
    }
  }
}

/** Sprite + frame for a pickup kind (render side of sim/pickupKinds). */
function drawPickup(ctx: CanvasRenderingContext2D, k: Pickup, x: number, y: number, time: number, sparkGlow: HTMLCanvasElement, blind: boolean): void {
  // Coins spin to their edge now and then; everything else is a static frame.
  const spin = ((time + k.phase * 3) % 2.4) < 0.1 ? 1 : 0;
  switch (k.kind) {
    case PK.Coin:
      drawSpriteAnchored(ctx, COIN_COPPER_SPRITE, spin, x, y);
      break;
    case PK.SilverCoin:
      drawSpriteAnchored(ctx, COIN_SILVER_SPRITE, spin, x, y);
      break;
    case PK.GoldCoin:
      drawSpriteAnchored(ctx, COIN_GOLD_SPRITE, spin, x, y);
      break;
    case PK.LuckyCoin:
      drawSpriteAnchored(ctx, COIN_LUCKY_SPRITE, spin, x, y);
      break;
    case PK.Bomb:
      drawSpriteAnchored(ctx, BOMB_SPRITE, 0, x, y + 1);
      break;
    case PK.DoubleBomb:
      drawSpriteAnchored(ctx, BOMB_SPRITE, 0, x - 3, y);
      drawSpriteAnchored(ctx, BOMB_SPRITE, 0, x + 3, y + 1);
      break;
    case PK.Key:
      drawSpriteAnchored(ctx, KEY_SPRITE, 0, x, y);
      break;
    case PK.KeyRing:
      drawSpriteAnchored(ctx, KEY_SPRITE, 0, x - 1, y - 2);
      drawSpriteAnchored(ctx, KEY_SPRITE, 0, x + 1, y + 1);
      break;
    case PK.HalfHeart:
      drawSpriteAnchored(ctx, RED_HEART_SPRITE, 1, x, y + 1);
      break;
    case PK.Heart:
      drawSpriteAnchored(ctx, RED_HEART_SPRITE, 0, x, y + 1);
      break;
    case PK.TinHeart:
      drawSpriteAnchored(ctx, TIN_HEART_SPRITE, 0, x, y + 1);
      break;
    case PK.EmberHeart:
      drawSpriteAnchored(ctx, EMBER_HEART_SPRITE, 0, x, y + 1);
      break;
    case PK.SparkSmall:
    case PK.SparkFull: {
      const full = k.kind === PK.SparkFull;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(time * 6 + k.phase * 6);
      ctx.drawImage(sparkGlow, x - 6, y - (full ? 6 : 5) - 6);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      drawSpriteAnchored(ctx, full ? SPARK_FULL_SPRITE : SPARK_SMALL_SPRITE, 0, x, y + 1);
      break;
    }
    case PK.Satchel:
      drawSpriteAnchored(ctx, SATCHEL_SPRITE, k.opened ? 1 : 0, x, y + 2);
      break;
    case PK.Lockbox:
      drawSpriteAnchored(ctx, LOCKBOX_SPRITE, k.opened ? 1 : 0, x, y + 2);
      break;
    case PK.Trinket:
    case PK.Consumable: {
      const img = getFrame(blind ? BLIND_ITEM_SPRITE : itemIcon(k.itemId), 0);
      const bob = k.z > 0 ? 0 : Math.round(Math.sin(time * 3 + k.phase * 6) * 1);
      ctx.drawImage(img, x - (img.width >> 1), y - img.height + 1 + bob - 2);
      break;
    }
    default:
      break;
  }
  // A little glint on shiny things.
  if (k.kind <= PK.KeyRing && !k.opened && ((time + k.phase * 5) % 1.9) < 0.12) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 1, y - 6, 1, 3);
    ctx.fillRect(x, y - 5, 3, 1);
  }
}

const PRICE: TextStyle = { color: '#ffe9a8', shadow: '#07080d' };
const PRICE_HEART: TextStyle = { color: '#ffb0b8', shadow: '#07080d' };
const PRICE_TIN_TEXT: TextStyle = { color: '#e4ebf7', shadow: '#07080d' };
const PRICE_POOR: TextStyle = { color: '#ff6a6a', shadow: '#07080d' };
const priceText: string[] = [];

const PRICE_COINS = 0;
const PRICE_HEARTS = 1;
const PRICE_TIN = 2;
const PRICE_KEYS = 3;

/**
 * A small price tag centred under (x, y): an icon (coin, heart container, Tin heart, key) and the
 * number — red when the player can't pay it right now.
 */
function drawPrice(ctx: CanvasRenderingContext2D, world: World, n: number, kind: number, x: number, y: number): void {
  const text = (priceText[n] ??= String(n));
  const inv = world.player.inv;
  const h = world.player.health;
  const poor =
    kind === PRICE_COINS ? inv.coins < n : kind === PRICE_KEYS ? inv.keys < n : kind === PRICE_HEARTS ? containers(h) < n : false;
  const iconW = kind === PRICE_COINS ? HUD_COIN_ICON.w : kind === PRICE_KEYS ? HUD_KEY_ICON.w : 9;
  const w = iconW + 2 + measureText(text);
  const left = Math.round(x - w / 2);
  ctx.fillStyle = 'rgba(7,8,13,0.7)';
  ctx.fillRect(left - 2, y - 1, w + 4, 8);
  if (kind === PRICE_HEARTS) drawSpriteAnchored(ctx, HEART_SPRITE, 0, left + 4, y + 7);
  else if (kind === PRICE_TIN) drawSpriteAnchored(ctx, TIN_HEART_SPRITE, 0, left + 4, y + 7);
  else ctx.drawImage(getFrame(kind === PRICE_KEYS ? HUD_KEY_ICON : HUD_COIN_ICON, 0), left, y + 1);
  const style = poor ? PRICE_POOR : kind === PRICE_HEARTS ? PRICE_HEART : kind === PRICE_TIN ? PRICE_TIN_TEXT : PRICE;
  drawText(ctx, text, left + iconW + 2, y + 1, style);
}
