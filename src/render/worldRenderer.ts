/**
 * Draws the simulated world in layer order (ARCHITECTURE §8):
 * room background → shadows → enemies (dummies) → player → projectiles (+ additive glow).
 * Positions are interpolated between the last two sim ticks by `alpha` for smooth motion on
 * displays faster than 60 Hz. Nothing here allocates per frame.
 */

import { lerp } from '../engine/math';
import type { World } from '../sim/world';
import type { Player } from '../sim/player';
import { PLAYER_TUNING } from '../sim/tuning';
import { WREN_FRAME } from '../content/sprites/wren';
import { DUMMY_SPRITE, MARBLE_SPRITE } from '../content/sprites/props';
import { ROOM_OUTER_X, ROOM_OUTER_Y, ROOM_X, ROOM_Y } from './layout';
import { MARBLE_GLOW_RGB, drawShadow, glowSprite } from './pixel';
import { RoomBackground } from './roomBg';
import { drawSpriteAnchored, getFrame } from './sprites';

const WALK_DOWN = [WREN_FRAME.downStepL, WREN_FRAME.downStand, WREN_FRAME.downStepR, WREN_FRAME.downStand];
const WALK_UP = [WREN_FRAME.upStepL, WREN_FRAME.upStand, WREN_FRAME.upStepR, WREN_FRAME.upStand];
const WALK_SIDE = [WREN_FRAME.sideSpread, WREN_FRAME.sideTogether, WREN_FRAME.sideSpread, WREN_FRAME.sideTogether];
const DEATH = [WREN_FRAME.hurt, WREN_FRAME.deathSlump, WREN_FRAME.deathHeap];
/** Pixels walked per walk-cycle frame. */
const STRIDE = 5;

export class WorldRenderer {
  private readonly bg = new RoomBackground();
  /** Warm halo drawn additively under each marble (strong enough to read warm on blue stone). */
  private readonly marbleGlow = glowSprite(7, MARBLE_GLOW_RGB, 0.8);

  /** Warm caches (room background, sprite frames) so the first frames don't hitch. */
  prepare(world: World): void {
    this.bg.get(world.room);
    getFrame(MARBLE_SPRITE, 0);
    for (let f = 0; f < world.player.character.sprite.frames.length; f++) getFrame(world.player.character.sprite, f);
    getFrame(DUMMY_SPRITE, 0);
    getFrame(DUMMY_SPRITE, 1);
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

    // Shadows first so every actor stands on the ground.
    const dummies = world.dummies;
    for (let i = 0; i < dummies.count; i++) {
      const d = dummies.items[i]!;
      drawShadow(ctx, d.x + ox, d.y + oy + 1, d.popped ? 6 : 13);
    }
    drawShadow(ctx, px, py + 3, 11);
    const shots = world.projectiles;
    for (let i = 0; i < shots.count; i++) {
      const m = shots.items[i]!;
      drawShadow(ctx, lerp(m.prevX, m.x, alpha) + ox, lerp(m.prevY, m.y, alpha) + oy + 1, 5);
    }

    this.drawDummies(ctx, world, ox, oy);
    this.drawPlayer(ctx, p, px, py, time);
    this.drawMarbles(ctx, world, alpha, ox, oy);
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
    if (p.dead) {
      frame = DEATH[Math.min(DEATH.length - 1, Math.floor(p.deathTime * 6))]!;
    } else if (p.hurtTimer > 0) {
      frame = WREN_FRAME.hurt;
      flash = p.hurtTimer > PLAYER_TUNING.hurtPose - 0.08;
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
    // Recoil: a 1 px kick opposite the shot for a couple of frames.
    let rx = 0;
    let ry = 0;
    if (!p.dead && p.sinceShot < 0.05) {
      rx = -Math.round(p.aimX);
      ry = -Math.round(p.aimY);
    }
    drawSpriteAnchored(ctx, sprite, frame, x + rx, y + 4 + bob + ry, flip, flash);
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
