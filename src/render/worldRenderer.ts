/**
 * Draws the simulated world in layer order (ARCHITECTURE §8):
 * room background → shadows → fires → pedestals/items → pickups → bombs → dummies → player →
 * projectiles (+ additive glow). Positions are interpolated between the last two sim ticks by
 * `alpha` for smooth motion on displays faster than 60 Hz. Nothing here allocates per frame.
 */

import { lerp } from '../engine/math';
import { findItem } from '../content/registry';
import type { World } from '../sim/world';
import type { Player } from '../sim/player';
import { PK } from '../sim/pickupKinds';
import type { Pickup } from '../sim/pickups';
import { ROOM_COLS, ROOM_ROWS, TILE } from '../sim/constants';
import { Tile } from '../sim/tiles';
import { PLAYER_TUNING } from '../sim/tuning';
import type { SpriteDef } from '../sim/types';
import { WREN_FRAME } from '../content/sprites/wren';
import { DUMMY_SPRITE, MARBLE_SPRITE } from '../content/sprites/props';
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
import { ROOM_OUTER_X, ROOM_OUTER_Y, ROOM_X, ROOM_Y } from './layout';
import { MARBLE_GLOW_RGB, drawShadow, glowSprite } from './pixel';
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
  /** Warm halo drawn additively under each marble (strong enough to read warm on blue stone). */
  private readonly marbleGlow = glowSprite(7, MARBLE_GLOW_RGB, 0.8);
  private readonly fireGlow = glowSprite(15, '255,120,40', 0.55);
  private readonly itemGlow = glowSprite(11, '255,214,120', 0.45);
  private readonly sparkGlow = glowSprite(6, '120,210,255', 0.6);
  private readonly fuseGlow = glowSprite(4, '255,200,90', 0.9);

  /** Warm caches (room background, sprite frames) so the first frames don't hitch. */
  prepare(world: World): void {
    this.bg.get(world.room);
    getFrame(MARBLE_SPRITE, 0);
    for (let f = 0; f < world.player.character.sprite.frames.length; f++) getFrame(world.player.character.sprite, f);
    getFrame(DUMMY_SPRITE, 0);
    getFrame(DUMMY_SPRITE, 1);
    for (const s of [PEDESTAL_SPRITE, BOMB_SPRITE, SATCHEL_SPRITE, LOCKBOX_SPRITE, FLAME_SPRITE, FIRE_BASE_SPRITE]) {
      for (let f = 0; f < s.frames.length; f++) getFrame(s, f);
    }
    getFlash(BOMB_SPRITE, 0);
  }

  /**
   * @param alpha interpolation factor between the previous and current tick (0..1)
   * @param time  seconds (presentation clock, for idle blinks etc.)
   * @param sx,sy screen-shake offset in px
   */
  draw(ctx: CanvasRenderingContext2D, world: World, alpha: number, time: number, sx: number, sy: number): void {
    ctx.drawImage(this.bg.get(world.room), ROOM_OUTER_X + sx, ROOM_OUTER_Y + sy);
    const ox = ROOM_X + sx;
    const oy = ROOM_Y + sy;
    const p = world.player;
    const px = lerp(p.prevX, p.x, alpha) + ox;
    const py = lerp(p.prevY, p.y, alpha) + oy;

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
    const shots = world.projectiles;
    for (let i = 0; i < shots.count; i++) {
      const m = shots.items[i]!;
      drawShadow(ctx, lerp(m.prevX, m.x, alpha) + ox, lerp(m.prevY, m.y, alpha) + oy + 1, 5);
    }

    this.drawFires(ctx, world, ox, oy, time);
    this.drawPedestals(ctx, world, ox, oy, time);
    this.drawPickups(ctx, world, alpha, ox, oy, time);
    this.drawBombs(ctx, world, alpha, ox, oy);
    this.drawDummies(ctx, world, ox, oy);
    this.drawPlayer(ctx, p, px, py, time);
    this.drawMarbles(ctx, world, alpha, ox, oy);
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
      drawSpriteAnchored(ctx, PEDESTAL_SPRITE, 0, x, y + 5);
      if (!ped.item) continue;
      const bob = Math.round(Math.sin(time * 2.6 + i * 1.3) * 1.5);
      const icon = itemIcon(ped.item);
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
      drawPickup(ctx, k, x, y, time, this.sparkGlow);
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
    drawSpriteAnchored(ctx, sprite, frame, x + rx, y + 4 + bob + ry, flip, flash);

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

  private drawMarbles(ctx: CanvasRenderingContext2D, world: World, alpha: number, ox: number, oy: number): void {
    const shots = world.projectiles;
    if (shots.count === 0) return;
    const glow = this.marbleGlow;
    const gh = glow.width >> 1;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < shots.count; i++) {
      const m = shots.items[i]!;
      const x = Math.round(lerp(m.prevX, m.x, alpha) + ox);
      const y = Math.round(lerp(m.prevY, m.y, alpha) + oy - lerp(m.prevZ, m.z, alpha));
      ctx.drawImage(glow, x - gh, y - gh);
    }
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < shots.count; i++) {
      const m = shots.items[i]!;
      const z = lerp(m.prevZ, m.z, alpha);
      if (m.falling) ctx.globalAlpha = Math.max(0.45, Math.min(1, z / PLAYER_TUNING.shotHeight));
      drawSpriteAnchored(ctx, MARBLE_SPRITE, 0, lerp(m.prevX, m.x, alpha) + ox, lerp(m.prevY, m.y, alpha) + oy - z);
      if (m.falling) ctx.globalAlpha = 1;
    }
  }
}

/** Sprite + frame for a pickup kind (render side of sim/pickupKinds). */
function drawPickup(ctx: CanvasRenderingContext2D, k: Pickup, x: number, y: number, time: number, sparkGlow: HTMLCanvasElement): void {
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
      const img = getFrame(itemIcon(k.itemId), 0);
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
