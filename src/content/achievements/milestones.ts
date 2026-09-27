/**
 * Milestone achievements: going deeper, bosses, clean floors, transformations, synergies, the collection, the
 * daily run, Rain Barrel Arenas, secrets, and the odd corners of the economy. Most of them unlock an item (the
 * item's `unlock` names the achievement — see src/content/items/*), so the item pool grows as you play.
 * Counter ids: src/meta/metaState.ts COUNTER_IDS (+ the tracker's own, e.g. dailyRuns); events: ACHIEVEMENT_EVENTS.
 */

import type { AchievementDef } from '../../sim/types';

const ACHIEVEMENTS: AchievementDef[] = [
  // ── Deeper ──
  {
    id: 'down-the-drain',
    name: 'DOWN THE DRAIN',
    desc: 'Reach chapter 2.',
    condition: { kind: 'event', event: 'chapterReached', atLeast: 2 },
    unlocks: [],
    icon: 'stairs',
  },
  {
    id: 'glow-in-the-dark',
    name: 'GLOW IN THE DARK',
    desc: 'Reach chapter 4.',
    condition: { kind: 'event', event: 'chapterReached', atLeast: 4 },
    unlocks: [],
    icon: 'stairs',
  },
  {
    id: 'bone-deep',
    name: 'BONE DEEP',
    desc: 'Reach chapter 5.',
    condition: { kind: 'event', event: 'chapterReached', atLeast: 5 },
    unlocks: [],
    icon: 'skull',
  },
  {
    id: 'into-the-eye',
    name: 'INTO THE EYE',
    desc: 'Reach chapter 6, where the storm begins.',
    condition: { kind: 'event', event: 'chapterReached', atLeast: 6 },
    unlocks: [],
    icon: 'cloud',
  },
  {
    id: 'off-the-map',
    name: 'OFF THE MAP',
    desc: 'Drop through a cracked grate onto the hidden route.',
    condition: { counter: 'altRoutesTaken', atLeast: 1 },
    unlocks: [],
    icon: 'grate',
  },
  // ── Bosses ──
  {
    id: 'boss-hunter',
    name: 'BOSS HUNTER',
    desc: 'Defeat 25 bosses.',
    condition: { counter: 'bossKills', atLeast: 25 },
    unlocks: [],
    icon: 'boss',
  },
  {
    id: 'big-game',
    name: 'BIG GAME',
    desc: 'Defeat 30 bosses.',
    condition: { counter: 'bossKills', atLeast: 30 },
    unlocks: [],
    icon: 'crown',
  },
  {
    id: 'small-fry',
    name: 'SMALL FRY',
    desc: 'Defeat 6 minibosses.',
    condition: { counter: 'minibossKills', atLeast: 6 },
    unlocks: [],
    icon: 'boss',
  },
  // ── Clean floors ──
  {
    id: 'dry-as-a-bone',
    name: 'DRY AS A BONE',
    desc: 'Finish 10 floors without taking a hit.',
    condition: { counter: 'noDamageFloors', atLeast: 10 },
    unlocks: [],
    icon: 'sock',
  },
  {
    id: 'untouchable',
    name: 'UNTOUCHABLE',
    desc: 'Finish floor 9 or deeper without taking a hit.',
    condition: { kind: 'event', event: 'noDamageFloor', atLeast: 9 },
    unlocks: [],
    icon: 'sock',
  },
  // ── Transformations & synergies ──
  {
    id: 'quick-change',
    name: 'QUICK CHANGE',
    desc: 'Transform 5 times.',
    condition: { counter: 'transformations', atLeast: 5 },
    unlocks: [],
    icon: 'butterfly',
  },
  {
    id: 'it-clicks',
    name: 'IT CLICKS',
    desc: 'Find a special synergy between two items.',
    condition: { counter: 'synergiesFound', atLeast: 1 },
    unlocks: [],
    icon: 'spark',
  },
  {
    id: 'mad-tinkerer',
    name: 'MAD TINKERER',
    desc: 'Find special synergies 15 times.',
    condition: { counter: 'synergiesFound', atLeast: 15 },
    unlocks: [],
    icon: 'spark',
  },
  // ── The collection ──
  {
    id: 'curious',
    name: 'CURIOUS',
    desc: 'Discover 75 different items.',
    condition: { counter: 'discovered', atLeast: 75 },
    unlocks: [],
    icon: 'item:treasure-map-sticker',
  },
  {
    id: 'collector',
    name: 'COLLECTOR',
    desc: 'Discover 120 different items.',
    condition: { counter: 'discovered', atLeast: 120 },
    unlocks: [],
    icon: 'item:treasure-map-sticker',
  },
  // ── The daily run ──
  {
    id: 'rain-check',
    name: 'RAIN CHECK',
    desc: 'Play a daily run.',
    condition: { counter: 'dailyRuns', atLeast: 1 },
    unlocks: [],
    icon: 'calendar',
  },
  {
    id: 'weather-watcher',
    name: 'WEATHER WATCHER',
    desc: 'Play the daily run on 7 different days.',
    condition: { counter: 'dailyRuns', atLeast: 7 },
    unlocks: [],
    icon: 'calendar',
  },
  // ── Rain Barrel Arenas ──
  {
    id: 'barrel-roll',
    name: 'BARREL ROLL',
    desc: 'Clear a Rain Barrel Arena.',
    condition: { counter: 'challengeRoomsCleared', atLeast: 1 },
    unlocks: [],
    icon: 'barrel',
  },
  {
    id: 'barrel-champion',
    name: 'BARREL CHAMPION',
    desc: 'Clear 10 Rain Barrel Arenas.',
    condition: { counter: 'challengeRoomsCleared', atLeast: 10 },
    unlocks: [],
    icon: 'barrel',
  },
  // ── Secrets ──
  {
    id: 'forgotten-pocket',
    name: 'FORGOTTEN POCKET',
    desc: 'Find a Forgotten Pocket, the deepest secret.',
    condition: { counter: 'deepSecretsFound', atLeast: 1 },
    unlocks: [],
    icon: 'eye',
  },
  {
    id: 'secret-keeper',
    name: 'SECRET KEEPER',
    desc: 'Blast your way into 25 secret rooms.',
    condition: { counter: 'secretsFound', atLeast: 25 },
    unlocks: [],
    icon: 'eye',
  },
  // ── Odd corners ──
  {
    id: 'window-shopping',
    name: 'WINDOW SHOPPING',
    desc: "Buy 15 items at Magpie's Stall.",
    condition: { counter: 'itemsBought', atLeast: 15 },
    unlocks: [],
    icon: 'bag',
  },
  {
    id: 'moth-deal',
    name: 'A DEAL WITH A MOTH',
    desc: 'Trade some heart for a deal in the Broker\'s Nook.',
    condition: { counter: 'brokerDeals', atLeast: 1 },
    unlocks: [],
    icon: 'butterfly',
  },
  {
    id: 'gumball-wizard',
    name: 'GUMBALL WIZARD',
    desc: 'Play the Gumball Gambler 60 times.',
    condition: { counter: 'slotPlays', atLeast: 60 },
    unlocks: [],
    icon: 'gumball',
  },
  {
    id: 'taste-tester',
    name: 'TASTE TESTER',
    desc: 'Drink 10 Mystery Tonics.',
    condition: { counter: 'tonicsDrunk', atLeast: 10 },
    unlocks: [],
    icon: 'item:tonic-violet',
  },
  {
    id: 'demolition',
    name: 'DEMOLITION',
    desc: 'Set off 50 bombs.',
    condition: { counter: 'bombsUsed', atLeast: 50 },
    unlocks: [],
    icon: 'item:bomb-sticker',
  },
  {
    id: 'on-a-roll',
    name: 'ON A ROLL',
    desc: 'Win two runs in a row.',
    condition: { counter: 'bestWinStreak', atLeast: 2 },
    unlocks: [],
    icon: 'crown',
    reward: 'A GOLD STAR NEXT TO YOUR NAME',
  },
];

export default ACHIEVEMENTS;
