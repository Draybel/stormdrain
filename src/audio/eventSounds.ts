/** Maps sim GameEvents to sound effects (with gentle stereo panning by room x). */

import type { GameEvent } from '../engine/events';
import { ROOM_W } from '../sim/constants';
import { PK } from '../sim/pickupKinds';
import { Tile } from '../sim/tiles';
import type { AudioOut } from './engine';
import type { SfxName } from './sfx';
import { SRC_STATUS } from '../sim/hittable';

const STATUS_SOUND: readonly SfxName[] = ['st_poison', 'st_burn', 'st_freeze', 'st_slow', 'st_charm', 'st_fear'];

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
      audio.play('shoot', pan, e.id === 'mini' ? 0.45 : 1);
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
      audio.play(e.id === 'shot' ? 'shot_boom' : 'explosion', pan);
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
    // ── Enemies & room combat ──
    case 'enemySpawn':
    case 'enemySummon':
      audio.play('foe_spawn', pan, 0.7);
      break;
    case 'enemyHit':
      audio.play('foe_hit', pan, e.b === SRC_STATUS ? 0.35 : 1);
      break;
    case 'enemyKilled':
      audio.play((e.b & 1) !== 0 ? 'st_shatter' : (e.b & 4) !== 0 ? 'foe_die_big' : 'foe_die', pan);
      break;
    case 'enemyWindup':
      audio.play(e.a === 1 ? 'foe_scrape' : 'foe_windup', pan);
      break;
    case 'enemyShoot':
      audio.play('foe_shoot', pan);
      break;
    case 'enemyLob':
      audio.play('foe_lob', pan);
      break;
    case 'enemyHop':
      audio.play('foe_hop', pan, 0.6);
      break;
    case 'enemyLand':
      audio.play('foe_land', pan, e.a >= 7 ? 1 : 0.6);
      break;
    case 'enemyDash':
      audio.play('foe_dash', pan);
      break;
    case 'bonk':
      audio.play('foe_bonk', pan);
      break;
    case 'burrow':
      audio.play(e.a === 0 ? 'foe_burrow' : e.a === 1 ? 'foe_rumble' : 'foe_emerge', pan);
      break;
    case 'blink':
      audio.play('foe_blink', pan, e.a === 1 ? 0.6 : 1);
      break;
    case 'shockwave':
      audio.play('foe_quake', pan);
      break;
    case 'eshotPop':
      if (e.a === 1) audio.play('eshot_pop', pan);
      break;
    case 'lobLand':
      audio.play('eshot_pop', pan, 1);
      break;
    case 'status': {
      const s = STATUS_SOUND[e.a];
      if (s) audio.play(s, pan);
      break;
    }
    case 'doors':
      audio.play(e.a === 1 ? 'gate_shut' : 'gate_open', 0);
      break;
    case 'roomClear':
      audio.play('room_clear', 0);
      break;
    // ── Attack pipeline ──
    case 'lanceCharge':
      audio.play(e.a >= 1 ? 'crackle' : 'lance_charge', pan, e.a >= 1 ? 0.5 : 0.7, e.a);
      break;
    case 'lanceReady':
      audio.play('lance_ready', pan, 1, e.a);
      break;
    case 'lanceFire': {
      const mini = e.id === 'mini';
      audio.play('lance_fire', pan, mini ? 0.35 : 1, mini ? 1 : 0);
      if (!mini) audio.play('crackle', pan, 0.9);
      break;
    }
    case 'lanceFizzle':
      audio.play('lance_fizzle', pan);
      break;
    case 'laserFire':
      audio.play('laser_zap', pan, e.id === 'mini' ? 0.4 : 1, e.id === 'mini' ? 1 : 0);
      break;
    case 'beamHit':
      audio.play('crackle', pan, 0.35);
      break;
    case 'swipe':
      audio.play('swipe', pan, e.id === 'mini' ? 0.4 : 1);
      break;
    case 'swipeHit':
      audio.play('swipe_hit', pan);
      break;
    case 'bladeCatch':
      audio.play('blade_catch', pan);
      break;
    case 'bladeSpawn':
      audio.play('blade_whirr', pan);
      break;
    case 'chainArc':
      audio.play('chain_zap', pan);
      break;
    case 'shotSplit':
      audio.play('split_pop', pan);
      break;
    case 'shotBounce':
      audio.play('bounce_tink', pan);
      break;
    case 'chargeTick':
      audio.play('charge_tick', pan, 0.8, e.a);
      break;
    case 'chargeReady':
      audio.play('lance_ready', pan, 0.5);
      break;
    case 'chargeRelease':
      audio.play('charge_release', pan, 1, e.a);
      break;
    case 'keeper':
      audio.play('keeper_chime', pan);
      break;
    case 'familiar':
      audio.play('familiar_poof', pan);
      break;
    // ── Phase 2D ──
    case 'bell':
      audio.play('yard_bell', pan);
      break;
    case 'pedestalRoll':
      audio.play('pedestal_roll', pan, e.a === 1 ? 1 : 0.35);
      break;
    case 'say':
      audio.play('surge', pan);
      break;
    default:
      break;
  }
}
