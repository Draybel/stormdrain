/** Maps sim GameEvents to sound effects (with gentle stereo panning by room x). */

import type { GameEvent } from '../engine/events';
import { ROOM_W } from '../sim/constants';
import { PK } from '../sim/pickupKinds';
import { Tile } from '../sim/tiles';
import type { AudioOut } from './engine';
import type { SfxName } from './sfx';

function panFor(x: number): number {
  return ((x / ROOM_W) * 2 - 1) * 0.45;
}

function pickupSound(kind: number): SfxName {
  switch (kind) {
    case PK.Coin:
      return 'coin';
    case PK.SilverCoin:
    case PK.GoldCoin:
    case PK.LuckyCoin:
      return 'coin_big';
    case PK.Bomb:
    case PK.DoubleBomb:
      return 'bomb_pickup';
    case PK.Key:
    case PK.KeyRing:
      return 'key';
    case PK.TinHeart:
      return 'tin_heart';
    case PK.EmberHeart:
      return 'ember_heart';
    case PK.SparkSmall:
    case PK.SparkFull:
      return 'spark';
    default:
      return 'heart';
  }
}

function breakSound(tile: number): SfxName {
  switch (tile) {
    case Tile.Crate:
      return 'crate_break';
    case Tile.Urn:
      return 'urn_break';
    case Tile.Fire:
      return 'fire_out';
    default:
      return 'rock_break';
  }
}

export function playEventSound(audio: AudioOut, e: GameEvent): void {
  const pan = panFor(e.x);
  switch (e.type) {
    case 'shoot':
      audio.play('shoot', pan);
      break;
    case 'splash':
      if (e.a !== 2) audio.play('splash', pan, e.a === 1 ? 1 : 0.6);
      break;
    case 'hit':
      audio.play('hit', pan);
      break;
    case 'pop':
      audio.play('dummy_pop', pan);
      break;
    case 'spawn':
      audio.play('spawn', pan);
      break;
    case 'hurt':
      audio.play('hurt', pan);
      break;
    case 'death':
      audio.play('death', pan);
      break;
    case 'pickup':
      audio.play(pickupSound(e.a), pan);
      break;
    case 'land':
      if (e.a <= PK.LuckyCoin) audio.play('tink', pan);
      break;
    case 'item':
      audio.play('item_get', pan);
      break;
    case 'chest':
      audio.play('chest_open', pan);
      break;
    case 'denied':
      audio.play(e.id === 'locked' ? 'locked' : 'denied', pan);
      break;
    case 'heal':
      audio.play('heart', pan, 0.7);
      break;
    case 'heartBreak':
      audio.play('tin_break', pan);
      break;
    case 'nova':
      audio.play(e.id === 'ember' ? 'nova' : 'shock', pan);
      break;
    case 'bombPlaced':
      audio.play('bomb_place', pan);
      break;
    case 'explosion':
      audio.play('explosion', pan);
      break;
    case 'tileHit':
      audio.play(e.a === Tile.Fire ? 'fire_hit' : 'crate_hit', pan);
      break;
    case 'tileBreak':
      audio.play(breakSound(e.a), pan);
      break;
    case 'activeUse':
      audio.play(e.a === 1 ? 'tonic' : 'power_up', pan);
      break;
    case 'charged':
      audio.play('charged', pan);
      break;
    case 'sfx':
      if (e.id) audio.play(e.id as SfxName, pan);
      break;
    default:
      break;
  }
}
