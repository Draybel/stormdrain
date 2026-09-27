/**
 * Player / world state ↔ JSON for run snapshots (taken at room entries, see sim/run/run.ts).
 * Only what can't be derived is stored: health, inventory, temporary effects, trigger cooldowns, the
 * few per-player timers that carry across rooms, the rng streams and counters. Stats, flags, the
 * loadout and the attack profile are rebuilt by recomputePlayer.
 */

import { Rng } from '../../engine/rng';
import { recomputePlayer } from '../effects';
import { initHealth } from '../health';
import { captureMechanic, restoreMechanic } from '../mechanics';
import { restoreTonics, snapshotTonics } from '../tonics';
import type { TempEffect } from '../loadout';
import { TRIGGER_EVENTS, type Effect, type TriggerOn } from '../types';
import type { World } from '../world';
import type { PlayerSnap, WorldSnap } from './types';

/** Round-trips a value through JSON (a deep copy that is guaranteed to be plain data). */
export function jsonClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export function capturePlayer(w: World): PlayerSnap {
  const p = w.player;
  const h = p.health;
  const inv = p.inv;
  const bonus: number[] = [];
  for (let i = 0; i < h.bonusCount; i++) bonus.push(h.bonusKind[i]!, h.bonusHalves[i]!);
  const triggerReady: [string, number, number][] = [];
  for (const [eff, t] of p.triggerReady) {
    // Stored by position in the (rebuilt) trigger lists: effect objects don't survive JSON.
    let found = false;
    for (let k = 0; k < TRIGGER_EVENTS.length && !found; k++) {
      const on = TRIGGER_EVENTS[k]!;
      const list = p.triggers[on];
      for (let i = 0; i < list.length; i++) {
        if (list[i]!.eff === eff) {
          triggerReady.push([on, i, t]);
          found = true;
          break;
        }
      }
    }
  }
  return {
    redMax: h.redMax,
    red: h.red,
    bonus,
    coins: inv.coins,
    bombs: inv.bombs,
    keys: inv.keys,
    passives: [...inv.passives],
    active: inv.active ? { id: inv.active.id, charge: inv.active.charge, max: inv.active.max, timed: inv.active.timed } : null,
    trinkets: [...inv.trinkets],
    consumables: [...inv.consumables],
    luckBonus: p.luckBonus,
    temps: p.temps.map((t) => ({ effect: jsonClone(t.effect), time: t.time === Infinity ? -1 : t.time, source: t.source })),
    triggerReady,
    x: p.x,
    y: p.y,
    faceX: p.faceX,
    faceY: p.faceY,
    aimX: p.aimX,
    aimY: p.aimY,
    eyeSide: p.eyeSide,
    walkDist: p.walkDist,
    sinceShot: p.sinceShot,
    shotsFired: p.shotsFired,
    fireCooldown: p.fireCooldown,
    hurtTimer: p.hurtTimer,
    invuln: p.invuln,
    holdItem: p.holdItem,
    holdTime: p.holdTime,
    atkDirX: p.atk.dirX,
    atkDirY: p.atk.dirY,
    keeper: p.atk.keeper,
    dead: p.dead,
    sets: [...p.sets],
    synergiesSeen: [...p.synergiesSeen],
    mech: captureMechanic(p),
  };
}

export function restorePlayer(w: World, s: PlayerSnap): void {
  const p = w.player;
  const h = p.health;
  initHealth(h, s.redMax, s.red, 0, 0);
  h.bonusCount = 0;
  for (let i = 0; i + 1 < s.bonus.length && h.bonusCount < h.bonusKind.length; i += 2) {
    h.bonusKind[h.bonusCount] = s.bonus[i]!;
    h.bonusHalves[h.bonusCount] = s.bonus[i + 1]!;
    h.bonusCount++;
  }
  const inv = p.inv;
  inv.coins = s.coins;
  inv.bombs = s.bombs;
  inv.keys = s.keys;
  inv.passives.length = 0;
  inv.passives.push(...s.passives);
  inv.active = s.active ? { ...s.active } : null;
  inv.trinkets.length = 0;
  inv.trinkets.push(...s.trinkets);
  inv.consumables.length = 0;
  inv.consumables.push(...s.consumables);
  inv.version++;
  p.luckBonus = s.luckBonus;
  p.temps.length = 0;
  for (const t of s.temps) {
    const temp: TempEffect = { effect: t.effect as Effect, time: t.time < 0 ? Infinity : t.time, source: t.source };
    p.temps.push(temp);
  }
  // Earned before the snapshot: restored as they were (no second fanfare, no second one-time effects).
  p.sets.length = 0;
  p.sets.push(...(s.sets ?? []));
  p.synergiesSeen.length = 0;
  p.synergiesSeen.push(...(s.synergiesSeen ?? []));
  // The character mechanic's run state (Juniper's temporary fireflies…) before the recompute counts them.
  restoreMechanic(p, s.mech);
  recomputePlayer(w);
  p.triggerReady.clear();
  for (const [on, i, t] of s.triggerReady) {
    const inst = p.triggers[on as TriggerOn]?.[i];
    if (inst) p.triggerReady.set(inst.eff, t);
  }
  p.placeAt(s.x, s.y);
  p.faceX = s.faceX;
  p.faceY = s.faceY;
  p.aimX = s.aimX;
  p.aimY = s.aimY;
  p.eyeSide = s.eyeSide;
  p.walkDist = s.walkDist;
  p.sinceShot = s.sinceShot;
  p.shotsFired = s.shotsFired;
  p.fireCooldown = s.fireCooldown;
  p.hurtTimer = s.hurtTimer;
  p.invuln = s.invuln;
  p.holdItem = s.holdItem;
  p.holdTime = s.holdTime;
  p.atk.reset();
  p.atk.dirX = s.atkDirX;
  p.atk.dirY = s.atkDirY;
  p.atk.keeper = s.keeper;
  p.dead = s.dead;
}

export function captureWorld(w: World): WorldSnap {
  return {
    tick: w.tick,
    time: w.time,
    counters: { ...w.counters },
    seen: [...w.seenEnemies],
    enemySerial: w.enemySerial,
    combat: w.combatRng.getState(),
    loot: w.lootRng.getState(),
    god: w.godMode,
    tonics: snapshotTonics(w),
  };
}

export function restoreWorld(w: World, s: WorldSnap): void {
  w.tick = s.tick;
  w.time = s.time;
  Object.assign(w.counters, s.counters);
  w.seenEnemies.clear();
  for (const id of s.seen) w.seenEnemies.add(id);
  w.enemySerial = s.enemySerial;
  w.combatRng.setState(s.combat);
  w.lootRng.setState(s.loot);
  w.godMode = s.god;
  // Mystery Tonics (identification included); an older snapshot has none — Run.restore deals them.
  w.tonics = undefined;
  if (s.tonics) restoreTonics(w, s.tonics);
}

/** A fresh Rng in a given state (tests / tools). */
export function rngFrom(state: [number, number, number, number]): Rng {
  return Rng.fromState(state);
}
