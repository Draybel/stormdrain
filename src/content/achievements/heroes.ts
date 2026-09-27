/**
 * Character achievements (DESIGN.md "Characters"): the unlocks that aren't in core.ts, and a win with each
 * character (the secret one's is hidden too; Drizzle comes with the hidden WHAT THE RAIN KEPT). Characters name their unlocking achievement in `CharacterDef.unlock` (Pip, Bolt and Sable here;
 * Marrow: 'soaked-through', Juniper: 'little-parade', Mosswick: 'clear-skies' in core.ts); an achievement can
 * also list a character in `unlocks` (Sable's second way in, SMASH AND GRAB).
 */

import type { AchievementDef } from '../../sim/types';

const ACHIEVEMENTS: AchievementDef[] = [
  // ── Unlocks ──
  {
    id: 'under-the-roots',
    name: 'UNDER THE ROOTS',
    desc: 'Defeat the boss of chapter 2.',
    condition: { kind: 'event', event: 'chapterBossKilled', atLeast: 2 },
    unlocks: [],
    icon: 'char:pip',
  },
  {
    id: 'wound-up',
    name: 'WOUND UP',
    desc: 'Use active items 50 times.',
    condition: { counter: 'activesUsed', atLeast: 50 },
    unlocks: [],
    icon: 'char:bolt',
  },
  {
    id: 'deep-pockets',
    name: 'DEEP POCKETS',
    desc: 'Hold 60 coins at once.',
    condition: { kind: 'event', event: 'coinsHeld', atLeast: 60 },
    unlocks: [],
    icon: 'char:sable',
  },
  {
    id: 'smash-and-grab',
    name: 'SMASH AND GRAB',
    desc: "Rob a shop: blast Magpie's jar or a gambler open.",
    condition: { counter: 'shopsDestroyed', atLeast: 1 },
    unlocks: [{ kind: 'character', id: 'sable' }],
    icon: 'gumball',
  },
  // ── A win with each character ──
  {
    id: 'mole-in-one',
    name: 'MOLE IN ONE',
    desc: 'Win a run as Pip.',
    condition: { kind: 'event', event: 'characterWin', id: 'pip' },
    unlocks: [],
    icon: 'win:pip',
  },
  {
    id: 'bare-bones',
    name: 'BARE BONES',
    desc: 'Win a run as Marrow.',
    condition: { kind: 'event', event: 'characterWin', id: 'marrow' },
    unlocks: [],
    icon: 'win:marrow',
  },
  {
    id: 'jar-full-of-light',
    name: 'A JAR FULL OF LIGHT',
    desc: 'Win a run as Juniper.',
    condition: { kind: 'event', event: 'characterWin', id: 'juniper' },
    unlocks: [],
    icon: 'win:juniper',
  },
  {
    id: 'still-ticking',
    name: 'STILL TICKING',
    desc: 'Win a run as Bolt.',
    condition: { kind: 'event', event: 'characterWin', id: 'bolt' },
    unlocks: [],
    icon: 'win:bolt',
  },
  {
    id: 'clean-getaway',
    name: 'CLEAN GETAWAY',
    desc: 'Win a run as Sable.',
    condition: { kind: 'event', event: 'characterWin', id: 'sable' },
    unlocks: [],
    icon: 'win:sable',
  },
  {
    id: 'bog-standard',
    name: 'BOG STANDARD',
    desc: 'Win a run as Mosswick.',
    condition: { kind: 'event', event: 'characterWin', id: 'mosswick' },
    unlocks: [],
    icon: 'win:mosswick',
  },
  {
    id: 'silver-lining',
    name: 'SILVER LINING',
    desc: 'Win a run as Drizzle.',
    hidden: true,
    condition: { kind: 'event', event: 'characterWin', id: 'drizzle' },
    unlocks: [],
    icon: 'win:drizzle',
    reward: 'A RAINBOW OVER THE DRAINS',
  },
];

export default ACHIEVEMENTS;
