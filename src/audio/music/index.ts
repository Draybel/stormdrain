/**
 * Public surface of the music system. Game code normally only needs `app.audio.music` (a
 * MusicControl) plus the ids below; see docs/audio.md.
 */

export type { MusicControl, PlayOptions, StingerOptions } from './director';
export { MusicDirector } from './director';
export {
  BOSS_MUSIC,
  BOSS_TRACKS,
  CHAPTER_IDS,
  CHAPTER_MUSIC,
  FINAL_MUSIC,
  MUSIC,
  bossMusicFor,
  chapterMusicFor,
  type ChapterMusicId,
} from './ids';
export { allTracks, getTrack, hasTrack } from './registry';
export type { MusicTrack, Instrument, DrumKit, DrumVoice, Section, Pattern } from './types';
