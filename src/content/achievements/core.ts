/**
 * The first achievements (Phase 4A; icons, rewards and unlocks filled in with the characters). How to add one
 * (any file in src/content/achievements/ works — it is auto-discovered, `export default AchievementDef[]`):
 *
 *   { id: 'kebab-id', name: 'SHOWN NAME', desc: 'One line saying what to do.',
 *     condition: { counter: 'bossKills', atLeast: 5 },                       // a lifetime counter, or
 *     condition: { kind: 'event', event: 'bossKilled', id: 'brimwell' },      // something happening in a run
 *     unlocks: [{ kind: 'item', id: 'some-item' }],
 *     icon: 'boss',                        // a badge (content/sprites/achievementIcons.ts), 'item:<id>', 'char:<id>', 'win:<id>'
 *     reward: 'A LINE OF REWARD TEXT' }    // optional, shown besides what it unlocks
 *
 * Counters and events are listed in src/sim/types.ts (AchievementCounterCondition, ACHIEVEMENT_EVENTS);
 * the meta tracker (src/meta/tracker.ts) reports them. Rewards: `unlocks` entries, plus every item /
 * character whose `unlock` field names the achievement (locked items never roll in runs until then).
 * Endings are unlocked by reaching them whatever the achievements say ('ending1' opens the alt route into
 * chapter 6, 'ending1' + 'ending2' the whirlpool to floor 13).
 *
 * Every achievement rewards something (tests/achievements-content.test.ts): an item, a character, a route, or at
 * least a `reward` line.
 */

import type { AchievementDef } from '../../sim/types';

const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first-splash',
    name: 'FIRST SPLASH',
    desc: 'Defeat your first creature of the drains.',
    condition: { counter: 'kills', atLeast: 1 },
    unlocks: [],
    icon: 'splash',
    reward: 'THE BESTIARY OPENS ITS FIRST PAGE',
  },
  {
    id: 'finders-keepers',
    name: 'FINDERS KEEPERS',
    desc: 'Open a satchel or a lockbox.',
    condition: { counter: 'chestsOpened', atLeast: 1 },
    unlocks: [],
    icon: 'chest',
  },
  {
    id: 'drain-cleaner',
    name: 'DRAIN CLEANER',
    desc: 'Defeat your first boss.',
    condition: { counter: 'bossKills', atLeast: 1 },
    unlocks: [],
    icon: 'boss',
  },
  {
    id: 'pack-rat',
    name: 'PACK RAT',
    desc: 'Carry 25 items at once in a single run.',
    condition: { kind: 'event', event: 'itemsHeld', atLeast: 25 },
    unlocks: [],
    icon: 'bag',
  },
  {
    id: 'magpies-envy',
    name: "MAGPIE'S ENVY",
    desc: 'Hold 50 coins at once.',
    condition: { kind: 'event', event: 'coinsHeld', atLeast: 50 },
    unlocks: [],
    icon: 'coin',
  },
  {
    id: 'little-parade',
    name: 'LITTLE PARADE',
    desc: 'Have 5 familiars following you at once.',
    condition: { kind: 'event', event: 'familiars', atLeast: 5 },
    unlocks: [],
    icon: 'char:juniper',
  },
  {
    id: 'dry-socks',
    name: 'DRY SOCKS',
    desc: 'Finish a floor without taking a single hit.',
    condition: { kind: 'event', event: 'noDamageFloor' },
    unlocks: [],
    icon: 'sock',
  },
  {
    id: 'deeper-still',
    name: 'DEEPER STILL',
    desc: 'Reach chapter 3.',
    condition: { kind: 'event', event: 'chapterReached', atLeast: 3 },
    unlocks: [],
    icon: 'stairs',
  },
  {
    id: 'hidey-ho',
    name: 'HIDEY-HO',
    desc: 'Blast your way into 8 secret rooms.',
    condition: { counter: 'secretsFound', atLeast: 8 },
    unlocks: [],
    icon: 'eye',
  },
  {
    id: 'metamorphosis',
    name: 'METAMORPHOSIS',
    desc: 'Transform by collecting a whole item set.',
    condition: { counter: 'transformations', atLeast: 1 },
    unlocks: [],
    icon: 'butterfly',
  },
  {
    id: 'soaked-through',
    name: 'SOAKED THROUGH',
    desc: 'Let the rain take you 3 times.',
    condition: { counter: 'deaths', atLeast: 3 },
    unlocks: [],
    icon: 'char:marrow',
  },
  {
    id: 'clear-skies',
    name: 'CLEAR SKIES',
    desc: 'Defeat Old Thunderhead and clear the skies.',
    condition: { kind: 'event', event: 'endingReached', value: 1 },
    unlocks: [{ kind: 'ending', id: 'ending1' }],
    icon: 'sun',
  },
  {
    id: 'the-quiet-hive',
    name: 'THE QUIET HIVE',
    desc: 'Defeat The Nestmother deep on the hidden route.',
    condition: { kind: 'event', event: 'endingReached', value: 2 },
    unlocks: [{ kind: 'ending', id: 'ending2' }],
    icon: 'hive',
  },
  {
    id: 'what-the-rain-kept',
    name: 'WHAT THE RAIN KEPT',
    desc: 'Follow the whirlpool down and defeat The Undertow.',
    hidden: true,
    condition: { kind: 'event', event: 'endingReached', value: 3 },
    unlocks: [{ kind: 'ending', id: 'ending3' }],
    icon: 'whirl',
    reward: 'THE STORM IS OVER · THANK YOU FOR PLAYING',
  },
  {
    id: 'homeward-wren',
    name: 'HOMEWARD, WREN',
    desc: 'Win a run as Wren.',
    condition: { kind: 'event', event: 'characterWin', id: 'wren' },
    unlocks: [],
    icon: 'win:wren',
  },
];

export default ACHIEVEMENTS;
