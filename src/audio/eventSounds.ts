/** Maps sim GameEvents to sound effects (with gentle stereo panning by room x). */

import type { GameEvent } from '../engine/events';
import { ROOM_W } from '../sim/constants';
import type { AudioOut } from './engine';
import type { SfxName } from './sfx';

function panFor(x: number): number {
  return ((x / ROOM_W) * 2 - 1) * 0.45;
}

export function playEventSound(audio: AudioOut, e: GameEvent): void {
  switch (e.type) {
    case 'shoot':
      audio.play('shoot', panFor(e.x));
      break;
    case 'splash':
      if (e.a !== 2) audio.play('splash', panFor(e.x), e.a === 1 ? 1 : 0.6);
      break;
    case 'hit':
      audio.play('hit', panFor(e.x));
      break;
    case 'pop':
      audio.play('dummy_pop', panFor(e.x));
      break;
    case 'spawn':
      audio.play('spawn', panFor(e.x));
      break;
    case 'hurt':
      audio.play('hurt', panFor(e.x));
      break;
    case 'death':
      audio.play('death', panFor(e.x));
      break;
    case 'sfx':
      if (e.id) audio.play(e.id as SfxName, panFor(e.x));
      break;
    default:
      break;
  }
}
