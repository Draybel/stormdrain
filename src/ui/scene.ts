/**
 * Minimal scene stack. The top scene receives updates, keys and owns the active on-screen
 * buttons; overlay scenes (pause, settings) draw on top of the scene(s) below them.
 */

import type { ButtonRegistry, HitButton } from '../engine/buttons';
import type { Input } from '../engine/input';
import type { InputState } from '../engine/inputState';
import { GAME_H, GAME_W } from '../engine/screen';

export interface Scene {
  readonly name: string;
  /** Draws over the scene below instead of replacing it; blocks its updates and input. */
  readonly overlay: boolean;
  /** Buttons hit-tested while this scene is on top (referenced, may be re-laid-out in place). */
  readonly buttons: HitButton[];
  /** Enable the floating twin sticks while on top. */
  readonly wantsSticks: boolean;
  enter?(): void;
  exit?(): void;
  /** Became the top scene again after an overlay closed. */
  focus?(): void;
  /** One fixed tick (only called while on top). */
  update(dt: number, input: InputState): void;
  render(ctx: CanvasRenderingContext2D, alpha: number): void;
  /** A fresh key press; return true if consumed. */
  onKey?(code: string): boolean;
  /** The page went to the background (pause the run, etc.). */
  onBackground?(): void;
  /** Settings affecting layout changed (button size). */
  onLayout?(): void;
}

export class SceneManager {
  private readonly stack: Scene[] = [];
  private readonly input: Input;
  private readonly registry: ButtonRegistry;
  /** Black fade-in after a scene swap (1 → 0). */
  private fade = 0;

  constructor(input: Input, registry: ButtonRegistry) {
    this.input = input;
    this.registry = registry;
    input.keyHandler = (code) => this.top?.onKey?.(code) ?? false;
  }

  get top(): Scene | undefined {
    return this.stack[this.stack.length - 1];
  }

  get name(): string {
    return this.top?.name ?? 'none';
  }

  get depth(): number {
    return this.stack.length;
  }

  /** Scene names bottom → top (diagnostics). */
  get names(): string[] {
    return this.stack.map((s) => s.name);
  }

  /** Clear the stack and start `scene` (with a short fade-in). */
  replace(scene: Scene): void {
    while (this.stack.length) this.stack.pop()!.exit?.();
    this.stack.push(scene);
    scene.enter?.();
    this.fade = 1;
    this.sync();
  }

  push(scene: Scene): void {
    this.stack.push(scene);
    scene.enter?.();
    this.sync();
  }

  pop(): void {
    if (this.stack.length <= 1) return;
    this.stack.pop()!.exit?.();
    this.top?.focus?.();
    this.sync();
  }

  /** Is `scene` somewhere in the stack? */
  has(scene: Scene): boolean {
    return this.stack.includes(scene);
  }

  find(name: string): Scene | undefined {
    return this.stack.find((s) => s.name === name);
  }

  update(dt: number, input: InputState): void {
    if (this.fade > 0) this.fade = Math.max(0, this.fade - dt * 3.5);
    this.top?.update(dt, input);
  }

  render(ctx: CanvasRenderingContext2D, alpha: number): void {
    const topIndex = this.stack.length - 1;
    let base = topIndex;
    while (base > 0 && this.stack[base]!.overlay) base--;
    // Scenes under an overlay are frozen (no ticks), so draw them at their latest tick
    // (alpha 1): interpolating a frozen prev→cur pair would make moving things shimmer
    // on displays faster than 60 Hz.
    for (let i = Math.max(0, base); i <= topIndex; i++) this.stack[i]!.render(ctx, i === topIndex ? alpha : 1);
    if (this.fade > 0) {
      ctx.globalAlpha = this.fade;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, GAME_W, GAME_H);
      ctx.globalAlpha = 1;
    }
  }

  background(): void {
    this.top?.onBackground?.();
  }

  relayout(): void {
    for (const s of this.stack) s.onLayout?.();
  }

  private sync(): void {
    const top = this.top;
    this.registry.use(top ? top.buttons : []);
    this.input.setSticksEnabled(!!top?.wantsSticks);
  }
}
