/**
 * The carrier interface (§4.2): a carrier decides HOW damage travels when it is the primary (`emit`,
 * once per volley spec) and how it MERGES into another primary when it is a rider (`rider`, once per
 * volley, after the primary emitted). Every pair of carriers produces a merged behaviour.
 */

import type { Volley } from '../fire';
import type { CarrierDef } from '../state';

export interface Carrier extends CarrierDef {
  /** As the primary: turn spec `i` of the volley into projectiles / beams / swipes. */
  emit?(v: Volley, i: number): void;
  /** As a rider (`stacks` copies held): merge into the volley the primary just emitted. */
  rider?(v: Volley, stacks: number): void;
}

/** Owner tag for events: '' = the player, 'mini' = familiars / orbit blades. */
export function ownerTag(v: Volley): string {
  return v.src.mini ? 'mini' : '';
}

/** The 'shoot' event (muzzle sparkle + sound) once per projectile volley. */
export function shootEvent(v: Volley): void {
  v.w.events.emit('shoot', v.x, v.y - v.z, Math.cos(v.ang), Math.sin(v.ang), ownerTag(v));
}
