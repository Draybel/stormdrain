# STORMDRAIN — Audio (music + SFX)

Everything is synthesised live with the Web Audio API: no audio files, no dependencies.

```
AudioContext.destination
 └─ master (Settings master volume)
     ├─ sfx bus (Settings sfx volume) ◄── SfxPlayer (sfx.ts core recipes + sfxLibrary.ts)
     └─ music bus (Settings music volume)
          └─ trim ◄── compressor ◄── muffle low-pass ◄── duck ◄── musicIn ◄── TrackPlayers (music)
                          ▲                                        ▲
                          └── stingerIn ◄── stinger TrackPlayers    └── room: feedback delay ◄── sends
```

| File | What |
|---|---|
| `src/audio/engine.ts` | `AudioOut` (`app.audio`): unlock, buses, `play(sfx)`, `music`, lifecycle |
| `src/audio/sfx.ts` | `SfxPlayer`, voice cap + per-sound voice limits, `registerSfx()` hook, the built-in recipes (core here + `sfxGameplay.ts`, `sfxEnemies.ts`, `sfxAttack.ts`; shared helpers and `Recipe` / `Voice` in `synth.ts`) |
| `src/audio/sfxLibrary.ts` | the ~60-recipe library (sounds the built-in files don't have), self-registers when engine.ts imports it |
| `src/audio/music/director.ts` | `MusicDirector` = `app.audio.music`: lookahead scheduler, crossfades, stingers, duck, pause |
| `src/audio/music/player.ts` | one playing track: channel strips (reused), step clock, note scheduling |
| `src/audio/music/synth.ts` | note + drum voices (per-note nodes, whole envelope pre-scheduled, stopped after release) |
| `src/audio/music/bus.ts` | compressor, duck, muffle, feedback-delay 'room'; `MUSIC_TRIM` |
| `src/audio/music/clock.ts` | step timing math (pure, unit-tested with a fake clock) |
| `src/audio/music/parse.ts` | pattern mini-language + compiler to flat typed arrays |
| `src/audio/music/types.ts` | `MusicTrack` data format |
| `src/audio/music/ids.ts` | chapter / boss / role → track id maps |
| `src/audio/music/instruments.ts` | instrument presets; `compose.ts` small writing helpers |
| `src/audio/music/validate.ts` | track validation used by the tests |
| `src/audio/music/fakeAudioContext.ts` | strict fake AudioContext for node tests (never imported by the game) |
| `src/content/music/*.ts` | the tracks (auto-discovered, `export default MusicTrack[]`) |

## Sound effects

```ts
app.audio.play('coin');                 // name, optional pan (-1..1), volume (0..1), param (recipe level)
app.audio.play('explosion_big', 0.3);
sim.events.emit('sfx', x, y, 0, 0, 'door_open'); // from the sim: eventSounds.ts pans by room x
```

Names are typed (`SoundName` = built-in `SfxName` + `LibrarySfxName`). Every library recipe has a minimum
retrigger gap, a per-sound voice limit (`maxVoices`, optional on built-in recipes) and slight random pitch; the
player also enforces a global cap of 20 voices. Built-in recipes win on a name clash (`SHADOWED_SFX` lists
clashes and a test keeps it empty).

The table lists every name the design asks for. When the side tracks were merged, the main track's Phase 2
files already had `coin`, `key`, `bomb_pickup`, `heart`, `chest_open`, `bomb_place`, `tin_break`,
`rock_break`, `crate_break`, `urn_break`, `lance_charge`, `lance_ready`, `lance_fire`, `crackle`, `laser_zap`,
`chain_zap` and `split_pop` (wired in `eventSounds.ts`), so the library's copies of those were removed: the names
still play, using the built-in recipe. The built-in files also hold the Phase 2 names (`foe_*`, `eshot_pop`,
`gate_*`, `room_clear`, `st_*`, `swipe`, `blade_*`, `charge_*`, `keeper_chime`, `coin_big`, `spark`, `nova`…).

| Group | Names |
|---|---|
| Pickups | `coin` `coin_silver` `coin_gold` `coin_lucky` `key` `bomb_pickup` `heart` `heart_tin` `heart_ember` `spark_cell` `spark_cell_full` `pickup` (generic) `trinket` `tonic_drink` `sticker_use` |
| Chests & doors | `chest_open` `chest_unlock` `door_open` `door_close` `door_lock` `door_unlock` |
| Bombs | `bomb_place` `bomb_fuse` `explosion_big` `explosion_small` |
| Enemies & bosses | `enemy_hurt` `enemy_hurt_squish` `enemy_die_squish` `enemy_die_crunch` `enemy_die_pop` `enemy_shoot` `enemy_spawn` `boss_roar` `boss_hurt` `boss_death` |
| Storm Lance & carriers | `lance_charge` (`param` = charge level) `lance_ready` `lance_fire` `crackle` `laser_zap` `boomerang_whoosh` `melee_swipe` `chain_zap` |
| Status & shot mods | `freeze` `burn` `poison` `split_pop` `bounce_ping` `fire_nova` (ember heart) `tin_break` (tin heart) |
| Fanfares & rooms | `item_pickup` `transformation` `secret_found` `trapdoor` `stairs` `achievement` `thunder` |
| Economy | `shop_buy` `cant_afford` `slot_spin` `slot_win` `slot_lose` `donation` |
| Menus | `menu_move` `menu_select` `menu_back` (core: `ui_click` `ui_back`) |
| Player | `player_hurt` `player_die` `heal` `curse` `teleport` `active_use` `active_ready` |
| World | `rock_break` `crate_break` `urn_break` `puddle_splash` `spikes` |

Adding a sound: add an entry to `SFX_LIBRARY` in `sfxLibrary.ts` using the helpers there (`tone`, `noise`,
`noiseArc`, `bell`, `notes`, `ticks`, `wobble`). Keep `length` honest (the test checks nothing rings past it) and
give it `maxVoices`. Other modules can call `registerSfx({ name: recipe })`.

## Music

`app.audio.music` is a `MusicControl`. It works before audio is unlocked (and with no Web Audio at all): calls
record the wanted state and the track starts the moment the AudioContext exists (first tap on iOS).

```ts
import { CHAPTER_MUSIC, MUSIC, bossMusicFor, FINAL_MUSIC } from '../audio/music';

const music = app.audio.music;
music.play(MUSIC.title);                          // crossfade (1.2 s default); no-op if already playing
music.play(CHAPTER_MUSIC[chapterId], { fade: 2 });
music.stinger(MUSIC.floorSting, { then: CHAPTER_MUSIC[nextChapterId] }); // next track starts on the sting's last sample
music.stinger(MUSIC.bossIntro, { then: bossMusicFor(chapterId) });        // or FINAL_MUSIC.old_thunderhead ...
music.stinger(MUSIC.itemFanfare);                 // plays over the music, which ducks to 30 % for its length
music.stinger(MUSIC.gameOver, { stopMusic: true });
music.stinger(MUSIC.victory, { stopMusic: true });
music.duck(0.35, 0.4, 0.8);                       // dip for a roar / big explosion: level, hold s, release s
music.muffle(true);                               // low-pass (pause menu), muffle(false) to restore
music.pause(); music.resume();                    // fade out; resume from the start of the same bar
music.stop(1);
music.current;                                    // wanted track id (null when stopped)
```

Suggested wiring (main track): title scene → `MUSIC.title`; floor start → `CHAPTER_MUSIC[chapter]`;
trapdoor → `floorSting` with `then`; boss room entered → `bossIntro` with `then` the boss / final theme (the
miniboss uses `MUSIC.miniboss`); boss killed → back to the chapter loop; shop / secret rooms → `MUSIC.shop` /
`MUSIC.secret`, and the chapter loop again on exit; quality-4 item pickups → `itemFanfare` stinger (other items:
the `item_pickup` sfx); death → `gameOver`; endings → `victory`; pause menu → `muffle(true)`. Backgrounding is
already handled by the engine (the scheduler stops while the page is hidden).

### Chapter → track ids (`CHAPTER_MUSIC` in `src/audio/music/ids.ts`)

| Chapter id | Track id | Title | Key / feel |
|---|---|---|---|
| `gutterways` | `ch_gutterways` | Gutter Groove | E minor, 98 bpm swung groove, plucked bass, drips |
| `drowned_nursery` | `ch_drowned_nursery` | Waterlogged Lullaby | F major waltz, warped music box |
| `rootcellar` | `ch_rootcellar` | Pickle-Jar Waltz | A harmonic minor folk waltz, 150 bpm, fiddle + accordion |
| `candlewick_crypt` | `ch_candlewick_crypt` | Wax and Wingdust | C harmonic minor 6/8, harpsichord, organ, tolling bell |
| `grinding_works` | `ch_grinding_works` | Cogs in Swing | G dorian shuffle, walking bass, marimba gears, clank |
| `rust_foundry` | `ch_rust_foundry` | Slag and Anvil | E phrygian half-time, fuzz riff, anvils |
| `mushroom_hollow` | `ch_mushroom_hollow` | Spore Drift | F lydian, glass 16th arps through a dotted-8th echo |
| `glimmer_grotto` | `ch_glimmer_grotto` | Echo Crystals | C# minor, crystal arps, theremin-ish whistle |
| `bone_orchard` | `ch_bone_orchard` | Lantern Lullaby | G harmonic minor 3/4, bone xylophone, eerie whistle |
| `frostbitten_vault` | `ch_frostbitten_vault` | Frost Chimes | A major 7ths, 66 bpm, icicle arps, celesta |
| `eye_of_storm` | `ch_eye_of_storm` | Eye of the Storm | D minor 140 bpm drive; quotes the title motif |
| `hollow_nest` | `ch_hollow_nest` | Paper Hive | A phrygian dominant, hive drone, wing trills |

Boss themes (`BOSS_MUSIC`, by chapter): `boss_floodgate` (chapters 1-2, C minor 150 bpm), `boss_pressure`
(chapters 3-4, B minor in 7/8 with key-shifting sections), `boss_undercurrent` (chapters 5-6, F minor, heavy).
Miniboss: `miniboss` ("Skirmish"). Finals (`FINAL_MUSIC`): `final_thunderhead`, `final_nestmother`,
`final_undertow`. Rooms: `shop` ("Magpie's Stall", bossa), `secret` ("Hidey-Hole"). One-shots: `jingle_victory`
(8 s), `jingle_gameover` (9.5 s), `sting_floor` (2 s), `sting_boss_intro` (5.3 s), `sting_item` (1.6 s).
Chapter loops are 30-52 s long.

The **STORMDRAIN motif** (A–D–C–Bb–A over Dm) from the title returns in Eye of the Storm, Old Thunderhead,
The Undertow (in F# minor, 12/8) and — finally in major — the victory jingle.

## Track format

```ts
const track: MusicTrack = {
  id: 'ch_example', name: 'Example', kind: 'chapter', chapter: 'gutterways',
  bpm: 100, beatsPerBar: 4, stepsPerBeat: 4,   // 16 steps per bar; 3 = triplet/shuffle grid, 6 = compound 6/8
  swing: 0.1,                                  // optional: odd steps late by 10 % of a step (even stepsPerBeat)
  key: 'E', scale: 'minor',                    // major minor dorian phrygian lydian mixolydian locrian
                                               // harmonicMinor melodicMinor phrygianDominant hungarianMinor
  loop: true, gain: 1,                         // gain: loudness trim 0..2.5
  instruments: { bass, lead, arp, pad, drums: { kick, snare, hat, perc, gain, delay } },
  sections: [{ name: 'A', bars: 8, transpose: 0, bass: '...', lead: [...bars], drums: { kick: 'x...' } }],
  song: ['A', 'B', 'A'],
  room: { time: 0.3, feedback: 0.4, wet: 0.3, damp: 2500 },
};
```

**Melodic patterns** (bass, lead, arp, pad) are whitespace-separated tokens, one step each unless `:n`:
`5` scale degree · `5'` / `5,` octave up/down · `3b` `4#` accidentals · `C4` `F#3` absolute notes · `1+3+5`
chord · `5:4` four steps long · `5!` accent / `5?` ghost · `~5` glide from the previous note · `-` / `-:3` hold ·
`.` / `.:8` rest · `|` bar line (optional, but then every bar must be exactly one bar long). Degree 1 sits in
the instrument's `octave` (defaults bass 2, lead 4, arp 4, pad 3). A pattern can also be an array of bars.

**Drum lanes** are one character per step: `x` hit, `X` accent, `o` ghost, `+` long (open hat / ringing), `.`
rest, `|` bar line. Any drum kind can go in any lane: `kick snare hat clap rim tom shaker block bell drip clank
thump cymbal`, with optional `pitch`, `decay`, `tone` (brightness), `gain`, `pan`.

A pattern shorter than its section repeats (its length must divide the section). Instruments are synth
parameter sets — oscillator layers (`sine square sawtooth triangle noise`, detuned `voices`, `octave`, `semi`),
ADSR `env`, optional `filter` (type, cutoff, q, `env` amount + `decay` makes it per-note, `keyTrack`), `vibrato`,
`gain`, `pan`, `delay` (room send), `glide`, `gate`. Presets live in `instruments.ts`; tweak with
`inst(PRESET, { gain, pan, octave, ... })`. `compose.ts` has `bars()`, `rep()` and `arp()`.

## Adding a track

1. Create `src/content/music/<id>.ts` exporting `export default [track]` (it is auto-discovered; ids must be unique).
2. Run `npm test` — `tests/music.test.ts` validates every track: patterns parse, bars match the time signature,
   instruments are in range, notes stay in each channel's range, the loop length fits its kind (chapter 28-64 s,
   boss 20-80 s, jingle ≤ 12 s, sting ≤ 6 s...), and `tests/musicScheduler.test.ts` plays it against a fake
   AudioContext.
3. If it fills a role, point `ids.ts` at it (`CHAPTER_MUSIC`, `BOSS_MUSIC`, `FINAL_MUSIC`, `MUSIC`).
4. Match loudness: the tracks were levelled by rendering them offline (Chromium OfflineAudioContext) to about
   -22 dBFS over the loudest 400 ms window at default volumes, peaks -6 to -14 dBFS, no clipping. Use the
   track `gain` trim; `MUSIC_TRIM` in `bus.ts` moves all music against the SFX.

## How the scheduler works

A 25 ms `setInterval` pumps every live `TrackPlayer`; each schedules the steps due in the next 120 ms at their
exact AudioContext times. Step times come from the absolute step index (`t0 + step × stepDur` + swing), so
loops are seamless and nothing drifts. If the timer stalls, late steps are skipped rather than played in a burst.
Crossfades, pause/resume and stingers all start or fade players; a player is disposed after its fade and cuts its
still-ringing long notes. Channel strips (gain, filter, pan, send) are built once per player; per-note nodes are
scheduled with their full envelope and stopped right after their release. The interval runs only while
something plays, and stops while the page is hidden.

## Tests

- `tests/music.test.ts` — parser, theory, compiler, every track validates, chapter map covers all 12 chapters.
- `tests/musicScheduler.test.ts` — step-clock timing math with a fake clock, director behaviour (unlock, crossfade,
  pause on a bar, stinger hand-off on the exact sample, idle timer), every real track played against the fake context.
- `tests/sfx.test.ts` — every recipe unique, snake_case, plays against the fake context with extreme jitter, honest
  lengths, voice limits and gaps, global voice cap.
