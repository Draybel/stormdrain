/**
 * Which track plays where. Game code asks for music by these ids (see docs/audio.md):
 *
 *   app.audio.music.play(CHAPTER_MUSIC[chapterId]);
 *   app.audio.music.stinger(MUSIC.bossIntro, { then: bossMusicFor(chapterId) });
 */

/** The 12 chapters of DESIGN.md, main track then alt track per chapter number. */
export const CHAPTER_IDS = [
  'gutterways',
  'drowned_nursery',
  'rootcellar',
  'candlewick_crypt',
  'grinding_works',
  'rust_foundry',
  'mushroom_hollow',
  'glimmer_grotto',
  'bone_orchard',
  'frostbitten_vault',
  'eye_of_storm',
  'hollow_nest',
] as const;
export type ChapterMusicId = (typeof CHAPTER_IDS)[number];

/** chapterId → looping chapter track id. */
export const CHAPTER_MUSIC: Readonly<Record<ChapterMusicId, string>> = {
  gutterways: 'ch_gutterways',
  drowned_nursery: 'ch_drowned_nursery',
  rootcellar: 'ch_rootcellar',
  candlewick_crypt: 'ch_candlewick_crypt',
  grinding_works: 'ch_grinding_works',
  rust_foundry: 'ch_rust_foundry',
  mushroom_hollow: 'ch_mushroom_hollow',
  glimmer_grotto: 'ch_glimmer_grotto',
  bone_orchard: 'ch_bone_orchard',
  frostbitten_vault: 'ch_frostbitten_vault',
  eye_of_storm: 'ch_eye_of_storm',
  hollow_nest: 'ch_hollow_nest',
};

/** Regular boss themes, by depth: chapters 1-2, 3-4, 5-6. */
export const BOSS_TRACKS = ['boss_floodgate', 'boss_pressure', 'boss_undercurrent'] as const;

/** chapterId → regular boss theme. */
export const BOSS_MUSIC: Readonly<Record<ChapterMusicId, string>> = {
  gutterways: 'boss_floodgate',
  drowned_nursery: 'boss_floodgate',
  rootcellar: 'boss_floodgate',
  candlewick_crypt: 'boss_floodgate',
  grinding_works: 'boss_pressure',
  rust_foundry: 'boss_pressure',
  mushroom_hollow: 'boss_pressure',
  glimmer_grotto: 'boss_pressure',
  bone_orchard: 'boss_undercurrent',
  frostbitten_vault: 'boss_undercurrent',
  eye_of_storm: 'boss_undercurrent',
  hollow_nest: 'boss_undercurrent',
};

/** Final boss id → theme. */
export const FINAL_MUSIC = {
  old_thunderhead: 'final_thunderhead',
  nestmother: 'final_nestmother',
  undertow: 'final_undertow',
} as const;

/** Everything else, by role. */
export const MUSIC = {
  title: 'title',
  shop: 'shop',
  secret: 'secret',
  miniboss: 'miniboss',
  /** One-shots (play with `stinger`). */
  victory: 'jingle_victory',
  gameOver: 'jingle_gameover',
  floorSting: 'sting_floor',
  bossIntro: 'sting_boss_intro',
  itemFanfare: 'sting_item',
} as const;

export function chapterMusicFor(chapterId: string): string | undefined {
  return (CHAPTER_MUSIC as Readonly<Record<string, string>>)[chapterId];
}

export function bossMusicFor(chapterId: string): string {
  return (BOSS_MUSIC as Readonly<Record<string, string>>)[chapterId] ?? BOSS_TRACKS[0];
}
