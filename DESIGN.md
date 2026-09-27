# STORMDRAIN — Game Design Bible

All names, characters, art and text here are original. Do not reference or imitate any existing game's
characters, items, art or names. When adding content, keep to this bible so parallel work stays consistent.

## Premise & tone
A storm has rained for forty days. Everything the town lost washed down the storm drains — and something down
there is keeping it. **Wren**, a scrappy kid in an oversized yellow raincoat, follows a trail of glowing marbles
into the drains. Tone: **dark but cute** — gloomy palettes (deep blues, mossy greens, rust, candle-gold), big-eyed
chunky silhouettes, soft humor in item text. Violence is cartoony (puffs, splats of ink/goo, no gore).

## Art direction (pixel maps in code)
- Characters ~14×16 px, regular enemies 10–18 px, bosses 32–56 px, items 14×14 icons, tiles 16×16.
- 1 px dark outline (#0d0b14-ish) on actors for readable silhouettes. Limited palettes per chapter.
- Each actor: idle/walk (2–4 frames), hurt (flash + squash), death (pop/splat frames or particle burst).
- Player look changes with major items (costume layers: hats, capes, eyes, auras) and with set transformations.

## Pickups
- **Coins**: Copper (1), Silver (5), Gold (10), Lucky Coin (1 + luck up tiny). **Bombs** (1, double pack), **Keys** (1, key ring = 2).
- **Hearts**: half red, full red, Tin heart (shield), Ember heart (bonus, fire nova when lost).
- **Spark Cells** (charge pickups): small (+1), full (fill active charge).
- **Chests**: Satchel (brown, free), Lockbox (gold, needs key, better loot). Rare: Mimic crate (fights back).
- **Tonics**: mystery potions — 10 effects, colors randomized per run (seeded), unidentified until first drunk.
- **Stickers**: single-use cards (10 kinds), named & described on pickup.
- **Trinkets**: hold 1 (2 with the right item); dropping swaps.

## Rooms (types)
normal · treasure ("Keepsake Room", locked with a key from chapter 2 on) · shop ("Magpie's Stall", keeper: Magpie
the shopkeeper bird) · boss · miniboss · secret ("Hidey-Hole") · deep secret ("Forgotten Pocket", harder to find)
· challenge arena ("Rain Barrel Arena" — waves; reward on clear) · cursed room ("Thorn Room", costs ½ heart to
enter/exit, better rewards) · risk-reward "**Broker's Nook**" (after a boss; the Moth Broker trades powerful items
for max health; more likely with no damage taken that floor) · start room.
Other interactables: **Donation Jar** (feed coins → luck/secret unlocks), **Slot Machine** ("Gumball Gambler"),
**Wandering Trader** ("Old Pell", a snail peddler who appears in random normal rooms and trades items for pickups).

## Chapters — 6 main + 6 alternates, 2 floors each (floors 1–12)
| # | Main track | Alt track (hidden route) |
|---|---|---|
| 1 | **The Gutterways** — rainwater, grates, leaves, slugs | **The Drowned Nursery** — soggy toys, music boxes |
| 2 | **The Rootcellar** — roots, jars, pickles, moles | **The Candlewick Crypt** — wax, candles, moths |
| 3 | **The Grinding Works** — clockwork sewer, gears, steam | **The Rust Foundry** — molten slag, furnaces |
| 4 | **The Mushroom Hollow** — spores, glowcaps, beetles | **The Glimmer Grotto** — crystals, echo bats |
| 5 | **The Bone Orchard** — bone trees, crows, lanterns | **The Frostbitten Vault** — ice, frozen treasure |
| 6 | **The Eye of the Storm** — clouds, lightning, wind | **The Hollow Nest** — wasp paper, amber, larvae |

- **Hidden routes**: a cracked drain grate (bombable, subtle drip hint) that appears in secret rooms or in the boss
  room after the boss — entering it sends you to the ALT track for the next floor. Boss trapdoors keep your track.
- Each chapter has its own tile palette, enemy pool, boss pool and **music loop**.

## Final bosses & endings (unlocked progressively)
1. **Old Thunderhead** — a colossal storm cloud with a grumpy face; end of Eye of the Storm II. Ending 1 "Clear Skies".
   Always available.
2. **The Nestmother** — giant paper-wasp queen; end of The Hollow Nest II. The alt route into chapter 6 only opens
   after Ending 1. Ending 2 "The Quiet Hive".
3. **The Undertow** — the living whirlpool at the bottom of every drain; after Endings 1 and 2, defeating either final
   boss opens a whirlpool to floor 13 "The Undertow". Ending 3 "What the Rain Kept" (true ending).

## Characters (7 + 1 secret) — each with look, stats, start items, ONE unique mechanic
1. **Wren** (start) — yellow oversized raincoat, glowing marbles. Balanced. *Mechanic — Lucky Marble:* the first shot
   fired in each uncleared room is a big "keeper marble" that deals triple damage and pierces.
2. **Pip** — tiny mole with a mining lamp. High HP, slow. *Burrow:* dashing (double-tap move or button) ducks
   underground for 0.4 s (invulnerable, moves fast); cooldown. Unlock: defeat the chapter 2 boss.
3. **Marrow** — little friendly skeleton in a red scarf. No red hearts, starts with Tin hearts; red heart pickups become
   Tin. *Bone Toss:* starts with the boomerang carrier. Unlock: die 10 times.
4. **Juniper** — girl in a moss cloak with a jar of fireflies. Low damage. *Firefly Jar:* starts with 2 firefly familiars;
   each room cleared adds a temporary firefly (max 6). Unlock: have 3 familiars at once.
5. **Bolt** — tin robot kid with a wind-up key. *Wind-Up:* starts with the charge rider; active items recharge over time
   as well as per room. Unlock: use active items 50 times.
6. **Sable** — masked fox thief. Starts with the melee carrier. *Pickpocket:* hitting enemies sometimes knocks coins
   loose; shop prices −25%. Unlock: steal from/destroy a shop or hold 60 coins.
7. **Mosswick** — a small swamp sprite with a lily-pad hat. *Bog Blood:* shots leave puddles (puddle modifier);
   standing in own puddles slowly heals tin hearts. Unlock: defeat Old Thunderhead.
8. **Drizzle** (secret) — a little raincloud that followed the storm home. Floats. *Rainmaker:* every hit Drizzle takes
   bursts a cloud over the room that soaks and slows every foe. Unlock: the hidden true ending (What the Rain Kept).
Details and numbers: docs/characters.md. Pip's burrow has its own DASH button (Shift on a keyboard); Juniper's extra
fireflies leave when she is hit or a new floor begins; "rob a shop" = blast Magpie's donation jar or a Gumball Gambler open.

## Item sets (transformations: collect 3 items of a set → new look + strong bonus)
1. **Stormcaller** (lightning) — cape of static; all shots chain lightning, +damage.
2. **Mothkin** (moth/wing) — dusty wings; flight + shots leave glittering dust that slows.
3. **Clockwork** (gears/springs) — gear halo; +fire rate, shots spin as gears and ricochet once.
4. **Sporeling** (mushrooms) — cap hat; spore clouds on kill, +1 max heart.
5. **Waxen** (candles) — candle crown; burning shots, bright light (ignores darkness curse).
6. **Toybox** (toys) — patchwork look; two toy-soldier familiars.
7. **Ossuary** (bones) — bone mask; orbiting bone blades, Tin heart every floor.
8. **Tidewalker** (water/rain) — wet shimmer; shots bounce and leave puddles, move speed up.
9. **Glimmer** (crystals) — crystal skin; shots split into shards on hit.

## Storm Lance (signature top-tier treasure item, quality 4)
Replaces normal shots. Hold to charge (visible meter over the character; fire-rate items shorten charge).
Release: blinding white-blue flash, crackling blue-white lightning beam as thick as the character, instantly to the
far wall, pierces everything, rapid damage for ~0.5 s, heavy screen shake, deep thunder boom + crackle.
Merges with everything (see ARCHITECTURE §4): spreads, homing bends, bounce reflects, split forks, orbit = spinning
ring of beams, bomb = explosions along the beam, familiars fire smaller beams.

## Floor curses (seeded, chance rises with depth)
Curse of Darkness (light radius), the Lost Map (no minimap), the Maze (doors sometimes shuffle rooms),
the Blind (item pedestals show "?"), the Unknown (can't see your own hearts), the Deluge (slippery floors).

## Economy & unlock philosophy
- Many items start locked; achievements unlock them (and characters, routes, endings). Collection page tracks
  discovered items; bestiary tracks enemies/bosses met and killed.
- Daily run: fixed seed from the date (UTC), one attempt per day recorded in stats.
