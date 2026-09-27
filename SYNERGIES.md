# STORMDRAIN — Special Synergies

Every attack item already stacks and merges automatically (ARCHITECTURE §4: carriers, riders, modifiers — any
combination works). **Special synergies** are hand-made extras on top of that: when the right items meet, a
synergy switches on, adds its own effects and gives your shots a look of their own.

- **When:** a synergy is on while *every* requirement holds — a specific item held (passives, the active in
  its slot, trinkets), or "N DISTINCT items with a tag" (duplicates count once). Losing an item switches it off
  again; getting it back switches it on silently.
- **The first time in a run:** the `SYNERGY: NAME` pill in the top band and a ring of sparks in the new shot
  colour around Wren (the `syn.debut` hook). Remembered in the run save, so it never repeats that run.
- **While on:** its persistent effects join the loadout (source = the synergy id), its style override tints the
  shots and beams (a colour of its own, often a shape / trail / glow / tether), and its triggers run its hooks.
- Content: `src/content/synergies/*.ts` (data), `src/content/hooks/synergies.ts` (the `syn.*` hooks),
  `src/content/hooks/synergiesKit.ts` (data builders). Tests: `tests/content-synergies*.test.ts`.

"× damage" below means a multiple of your damage stat, so every synergy keeps up with a growing build.

## The Storm Lance

| Synergy | Requires | What it does |
|---|---|---|
| **Crown of Storms** | Storm Lance + Tin Pinwheel | +2 tiny-planet stacks: the lance still fires straight down your aim at full strength, and a crown of two more beams (0.6 × damage each) turns a full circle and a half around you while it lasts; every release cracks a ring of static that shoves close foes back (0.5 × damage). Ice-blue star shots with sparks. |
| **Thunder Furrow** | Storm Lance + Firecracker Pouch | +1 explode. Each release calls bolts from the sky down the lance's furrow every ~38 px to the wall (up to 6): 0.6 × damage and burn around each strike, and each leaves a smouldering crater (a burning allied puddle for 3.5 s). Thunder-gold beams trailing embers. |
| **Storm Choir** | Storm Lance + 2 Familiar items | A Blinkbug joins the choir; every release, each familiar sings a bolt into the foe nearest to it (1 × damage). Pale hymn-gold star shots. |
| **Ball Lightning** | Storm Lance + Static Cling | +1 chain. Each release leaves up to 7 crackling orbs hanging along the beam's path; they drift for 2.4 s and burst on the first foe they touch (1 × damage). White-blue, glowing. |
| **Burning Glass** | Storm Lance + Magnifying Glass | +2 burn, ×1.15 shot size: a white-hot beam. A burning foe that falls flares up, scorching and igniting everything within 26 px (0.8 × damage). |
| **Cyclone Sweep** | Storm Lance + Dizzy Top | +1 knockback. The beam already whirls a lap before it settles; now every release also blasts a gust around you (80 px: shoves foes away, 0.4 × damage, pops hostile shots). Aquamarine wisps. |
| **Lightning Rod** | Storm Lance + Rooftop Rod | +1 chain with an extra jump. Every release calls three bolts from the sky onto the nearest foes (1.2 × damage each, splashing, a moment's slow). Yellow spiky sparks. |

## Lasers, blades, swings, charge and orbits

| Synergy | Requires | What it does |
|---|---|---|
| **Mirror Ball** | Neon Tube + Kaleidoscope | Lasers spin a full turn before settling (+1 circle-first) out of a star of side and back beams; about once a second the ball throws off a ring of 8 glitter shots (friendly pink, 0.3 × damage each). Pink star sparks. |
| **Lasso Laser** | Neon Tube + Rusty Boomerang | +1 boomerang: the bent lasers loop back like a lasso, and foes caught near your aim line (120 px) are yanked toward you — never closer than a standoff 36 px from you (the pull fades to nothing there) — nicked and slowed. Hot pink wisps. |
| **Neon Sign** | Neon Tube + Glowworm Vial | +1 pierce, +1 luck, and a big neon-green glow. Foes pop in a neon flash that hurts their neighbours (0.5 × damage). |
| **Refraction** | Neon Tube + 3 Glimmer items | +1 split, +1 spread: lasers fork into a prism. Every fallen foe bursts into 5 crystal shards (ice shots, 0.4 × damage each). Violet shards. |
| **Kite Line** | Rusty Boomerang + Kite String | +25 range. Every blade in flight stays tied to its thrower by a crackling kite string (drawn as a tether line); each throw, the strings zap whatever crosses them (0.6 × damage). Coral kite-coloured blades. |
| **Walk the Dog** | Rusty Boomerang + Yo-Yo String | +1 spiral, +0.5 damage: blades corkscrew out and loop home like a yo-yo trick. Toffee-gold blades trailing dust. |
| **Funny Bone** | Rusty Boomerang + 2 Ossuary items | +1 knockback, +1 fear: BONK. Now and then (30 %) a fallen foe sends everyone within 44 px running. Bone-white blades. |
| **Batter Up** | Broken Oar + Rubber Ball | +1 knockback. Every swing bats hostile shots in front of you (36 px, ±70°) straight back along your aim as your own (at least 1 × damage). Cream crescents. |
| **Merry-Go-Round** | Broken Oar + Carousel Horse | +1 side shots, +1 back shot: you swing all the way round, and the spin throws off a little gust (0.3 × damage, a shove). Lilac crescents. |
| **Rowing Stroke** | Broken Oar + 2 Water items | +1 puddle, +8 speed. Each stroke sends a knee-high wave out around you (a 52 px ring, 0.5 × damage) with a splash. Water-blue crescents. |
| **Full Steam Ahead** | Coiled Spring + Shrieking Kettle (active) | +15 shot speed. Every charged release vents a cone of scalding steam ahead of you (64 px, 0.9 × damage, burn, a hard shove along your aim) — the longer the wind-up, the bigger the blast; a tap only lets out a wisp. Steam-white bubbles trailing wisps. |
| **Orrery** | Tin Pinwheel + Tiny Moon | One more orbiting blade (an extra orbit carrier), +1 tiny-planet, +20 range: shots and blades share one little sky. Periwinkle glow. |
| **Bell Tower** | Grave Bell (active) + Bone Jacks | +0.5 damage. DONG: using the bell also flings a ring of 12 bone shards (0.8 × damage each) and sends every foe within 90 px running. Bronze spikes. |

## Lightning, frost, fire, blasts and helpers

| Synergy | Requires | What it does |
|---|---|---|
| **Frost Nova** | Ice Cube Tray + Party Popper | +1 freeze. A frozen foe that falls bursts in a frost nova: a ring of 10 ice shards (0.7 × damage each) and everything within 34 px frozen for a moment — the shards can set off the next frozen foe (one nova every 0.1 s at most). Ice shards. |
| **Fork in the Road** | Lantern Moth + Brass Kite Key | +1 homing (reaching further). Lightning that seeks and forks: about twice a second a bolt leaps from you to the nearest foe (150 px), then forks to the two nearest foes it hasn't struck, and forks again — up to 7 strikes (0.6 × damage, a little less each fork). Acid-lime spiky sparks. |
| **Swamp Gas** | Toadstool Cap + Trick Candle | A poisoned foe that falls goes up like swamp gas: three little blasts (0.6 × damage each) and everything within 32 px catches fire, in a sulphur-yellow flash. Sulphur bubbles trailing embers. |
| **Oil Slick** | Leaky Bucket + Drippy Candle | +1 puddle. As you keep firing, your puddles turn into burning oil slicks (orange with a friendly pink rim, smouldering) that grow a little and set every foe standing in them alight. Burnt-orange bubbles. |
| **Cluster Crackers** | Firecracker Pouch + Geode | +1 split. Every fallen foe pops a ring of four little crackers (0.5 × damage each). Red bombs with sparks. |
| **Surprise Party** | Party Popper + Jack-in-the-Box (active) | +1 luck. SURPRISE: using the Jack also pops a party blast on every foe in the room (1.2 × damage). Pink stars. |
| **Fireworks Night** | Leather Apron + Sparkler Stub | Every bomb you place spits a ring of 10 sparks that fly off and pop on foes (1.5 × damage each). Magenta spiky sparks. |
| **Butterfingers** | Greasy Gloves + Earplugs | +1 explode, ×1.25 range (they slip out a bit later). Getting hit makes you fumble six blasts all around you (never hurt you, 1 × damage). Amber bombs. |
| **Moth to a Flame** | 2 Mothkin items + 2 Waxen items | +1 homing, +1 burn. A burning foe that falls carries the flame on to the two nearest foes, moth-like, along ember arcs (every 0.1 s at most). Salmon wisps. |
| **Lantern Parade** | Lamplet + Tallow Tot + Wick Wisp | +1 burn. The three candle buddies drip wax as they march: burning puddles under every familiar that ignite foes nearby. Warm lantern gold. |
| **Nightlight** | Gloamwing + Porch Bulb | +1 slow, +1 homing. The moths shed slowing dust where they flutter: dusty puddles under your familiars that slow what walks in. Dusty lilac wisps. |

## Sets meeting halfway

| Synergy | Requires | What it does |
|---|---|---|
| **Thunderstorm** | 2 Stormcaller items + 2 Tidewalker items | +1 puddle, and your puddles conduct: while you fire (at most twice a second) foes standing in them are zapped from the water (0.4 × damage) and nearby puddles crackle together. Storm-blue drops. |
| **Bog Bloom** | Earthstar + 2 Sporeling items | +1 poison. As you keep firing, your puddles become spore bogs that grow a little and poison every foe in them. Moss-green bubbles. |
| **Wind-Up Army** | 2 Clockwork items + 2 Toybox items | A Tin Sentry marches with you, +0.25 fire rate, and each cleared room winds you up: +1 fire rate for 8 s ("WOUND UP TIGHT!"). Bronze gears. |
| **King of the Toybox** | Paper Crown + 3 Toybox items | The Threadbare Bear guards the king; +0.5 damage, +1 luck, and cleared rooms may bring a tribute (a room-clear drop roll, 20 % + luck). Royal gold stars. |

## Pocket things (trinkets)

| Synergy | Requires | What it does |
|---|---|---|
| **Static Shock** | Static Sock + Wool Mitten | +1 chain. Static builds up as you scoop things up: every pickup zaps the nearest foe with a bolt (2 × damage). Electric-lime spikes. |
| **Make a Wish** | Birthday Candles (active) + Matchbook | +1 burn. Blowing out the candles also sends a burning ring out 100 px (1 × damage, burn) and leaves you a Lucky Coin. Peach stars trailing embers. |
| **Frozen Moment** | Frozen Pocketwatch (active) + Frost Bead | Using the watch — and getting hit — makes every frozen foe shed four ice shards at its neighbours (0.6 × damage each). Periwinkle gears. |
| **Ember Harvest** | Hot Coal + Candle Snuffer | +1 burn. A burning foe that falls may leave an Ember heart (5 % + luck, at most 15 %). Ember orange. |
| **Bath Time** | Rubber Duck + Rain Stick (active) | Squeak: using the Rain Stick also rains 8 stinging puddles all over the room. Rubber-duck yellow bubbles. |
| **True North** | Cracked Compass + Feathery Antennae | Homing turns much sharper and reaches farther; every new floor shows its layout on the map. Compass-red needles. |
| **Crow Call** | Crow Feather + Crow's Jawbone | +20 shot speed. Getting hit bursts four crows out of your coat that dive at the nearest foes (1 × damage each). Dusky violet spikes. |
| **Tooth Fairy** | Baby Tooth + Weighted Die | +1 luck; fallen foes may leave a Silver Coin (3 % + luck). Fairy-lilac stars. |
| **Overcharge** | Jar of Lightning (active) + Spare Battery | Opening the jar also calls five bolts from the sky onto the nearest foes (1.5 × damage each). Electric-blue spikes. |
| **Sugar Rush** | Candy Wrapper + Cold Brew Can | Grabbing a pickup gives a sugar rush: +0.8 fire rate for 3 s and a little sparkle (once a second at most). Blue-raspberry sparks. |

## Actives

| Synergy | Requires | What it does |
|---|---|---|
| **Kite and Key** | Storm Kite (active) + Brass Kite Key | +1 chain. Flying the kite in a storm with a key on the string: when you use it, lightning strikes the kite above you and the key passes it on — a bolt that forks through the room (up to 16 strikes, 1.5 × damage, a little less each fork), on top of borrowing the Storm Lance. Pale lightning stars with a big glow. |
| **Mirror Lid** | Pot Lid (active) + Rearview Mirror | CLANG: using the lid turns every hostile shot in the room around — they fly back the way they came, as yours (at least 1 × damage). Chrome shards. |
| **Whirlpool** | Drain Plunger (active) + Snail Shell | The plunger's yank becomes a whirlpool: foes within 120 px are dragged in and around, hurt (1 × damage) and slowed, and six water puddles ring you. Deep-water bubbles. |
| **Slow Dance** | Crank Radio (active) + Pocket Metronome | ×1.05 fire rate. The slow song slows the room's hostile shots too (to 35 % speed, no more speeding up). Dusk-grey dust. |
| **Mushroom Circle** | Puffball (active) + Fairy Ring | The puffball also bursts a Fairy Ring spore cloud on every foe in the room (area damage + poison). Pale-green stars with bubbles. |
| **Drum Solo** | Rumble Drum (active) + Chattering Teeth | BA-DUM-TSS: the drum also sends three expanding shockwave rings out from you (1 × damage as each passes). Drum-red spikes. |
| **Marching Band** | Tin Sentry + Tin Soldier Tin (active) + Tin Soldier's Medal | Another Tin Sentry falls in, +0.3 fire rate; opening the tin makes every familiar salute with a bolt at its nearest foe (1.5 × damage). Brass gears. |

## Odd ones, lucky ones, cosy ones

| Synergy | Requires | What it does |
|---|---|---|
| **Continental Drift** | Snail Mail Stamp + Paperweight | +2 pierce, +1 grow, ×1.1 damage: shots so slow and heavy they grind through a whole row of foes. Earth-brown dust. |
| **Heart Mail** | Paper Valentine + Snail Mail Stamp | +1 charm. While you fire (every 1.2 s at most), every charmed friend mails four pink hearts at the foes around it (0.6 × damage each). Rose stars. |
| **Moonwalk** | Backwards Cap + Rearview Mirror | +1 homing, +1 back shot, +0.5 damage: the shots you fire backwards turn around and find their way to foes. Moon-blue wisps. |
| **Biscuit Dunk** | Crumbly Biscuit + Thermos of Soup | +1 puddle, +1 split: crumbs fall into the soup. Cleared rooms may heal half a heart (30 %). Biscuit-brown shards. |
| **Tea Party** | Teacup Tempest + Shrieking Kettle (active) | Now and then (5 % + luck, every 6 s at most) the kettle sings: 4 s of two extra shots, burn, homing and +1 fire rate ("THE KETTLE SINGS!"). Mint-steam wisps. |
| **Paper Snowflake** | Tracing Paper + Kaleidoscope | ×1.1 damage (making up for the Kaleidoscope's). Now and then (12 % + luck, at most every 0.8 s) a volley unfolds into a paper snowflake: six shards burst out all around you (0.5 × damage each). Paper-white stars trailing dust. |
| **Under the Weather** | Grudge Pebble + Falling Barometer | +0.3 damage. Hurting you makes the weather turn ("THE WEATHER TURNS!"): bolts from the sky onto the three nearest foes (1.5 × damage, a moment's slow) and a burst of stinging rain puddles all over the room. Slate-grey spikes trailing raindrops. |
| **Loaded Dice** | Weighted Die + Bent Horseshoe | +2 luck. Rarely (2 % + luck, every 5 s at most) a JACKPOT: 3 s of two extra shots, homing and pierce. Lucky-green stars. |
| **Haunted House** | Bedsheet Ghost + Wisp in a Bottle | +1 fear. Every fallen foe comes back as a little ghost that flies at the nearest foe (1.2 × damage). Ghost-white bubbles. |
| **Tin Can Knight** | Sardine Tin + Tin Ribcage + Pot Lid (active) | A Tin heart at the start of every floor; getting hit rattles eight tin shards out of your armour (0.8 × damage each). Tin-grey gears. |
| **Hearthside** | Hot Water Bottle + Warming Pan | +1 burn; half an Ember heart at the start of every floor. Hearth-red embers. |

## Which synergies a new player can make (polish batch 4)

Locked items never roll until their achievement is earned (docs/characters.md "Gating items"). The balance pass ungated
every carrier and a passive for every modifier — the Firecracker Pouch and the Neon Tube (they waited on wins with Pip and
Bolt), Twin Straws, Geode, Ice Cube Tray, Party Popper, Paper Valentine, Crumbly Biscuit, Static Cling, Lantern Moth and
the Cast-Iron Kettle — and moved the gates to plain boosts and oddities (Chipped Piggy Bank, Dizzy Top, Tin Cuckoo, Spare
Spoon, Spine Rattle, Toddlecap, Crow's Jawbone, Pocket Metronome, Snail Mail Stamp). From a brand-new save **41 of the 63**
synergies can now be made (34 before), among them Thunder Furrow, Lasso Laser, Cluster Crackers and Ball Lightning. The 22
that wait on an achievement: Kite and Key, Slow Dance, Mushroom Circle, Mirror Ball, Orrery, Fireworks Night, Butterfingers,
Lantern Parade, Continental Drift, Heart Mail, Tea Party, Under the Weather, Paper Snowflake, Haunted House, Hearthside,
Crown of Storms, Cyclone Sweep, Lightning Rod, Frozen Moment, Ember Harvest, Crow Call and Overcharge
(tests/item-gating.test.ts keeps at least 40 makeable).

Values the pass changed under the synergies (ARCHITECTURE §4): the melee swipe hits for 1.4 × damage (was 2.2) with a
0.6 × crescent (was 1) and swats one hostile shot a swing near the blade; the boomerang 1 × (was 1.25); the bomb rider
≥ 1.3 × (was 1.8); damage above 12 is soft-capped (`12 + 10·ln(1 + (x − 12)/10)`), like the fire rate above 5; the
Wind-Up Crank gives +0.45 fire rate (was +0.75); Brick Chip and Snail Mail Stamp are quality 3 and the Paperweight
quality 2. Every "× damage" above follows your (soft-capped) damage stat.

## How the flourishes work (for content authors)

Synergy effects are plain `Effect`s. The unusual parts are hooks run from the synergy's triggers
(`fire`, `kill`, `hurt`, `use`, `bomb`, `pickup`, `roomClear`, `floorStart`) — all in
`src/content/hooks/synergies.ts`, parameterised by data, allocation-free and capped:

| Hook | Does |
|---|---|
| `syn.debut` | The first-activation ring in the new shot colour. |
| `syn.burst` | Damage / status / shove in a radius + a nova (`needs` = only when the fallen foe had a status). |
| `syn.skyBolts` | Bolts from the sky onto the N nearest foes. |
| `syn.forkBolt` | Seeking lightning that forks from every foe it strikes to the nearest ones it hasn't (breadth first, ≤ 16 strikes); optionally the sky strikes you first. |
| `syn.cone` | A cone blast along your aim (steam), optionally scaled by the release's charge. |
| `syn.lineStrikes` | Bolts (+ craters) along the aim line to the wall. |
| `syn.orbs` | Slow-drifting allied orbs hung along the aim line. |
| `syn.blasts` | Player blasts (never hurt you) in a ring, or on every foe. |
| `syn.waves` | Allied expanding shockwave rings. |
| `syn.gust` | Shove (or yank) foes around you, optionally popping hostile shots. |
| `syn.ring` / `syn.foeRings` / `syn.ghosts` | Rings of allied shots from a point / from every foe with a status / aimed at the nearest foes. |
| `syn.reflect` | Hostile shots turn into yours (in front of a swing, or the whole room). |
| `syn.stall` | Hostile shots slow down. |
| `syn.contagion` | A fallen foe's status jumps on to its neighbours. |
| `syn.loot` | A pickup from a fallen foe with a status. |
| `syn.puddles` / `syn.conduct` / `syn.familiarPuddles` / `syn.puddleRain` | Puddles turn elemental / electrified; puddles under familiars; puddles rained over the room. |
| `syn.tether` / `syn.lasso` / `syn.choir` / `syn.vortex` | Kite strings to blades in flight; a lasso along the aim; familiars zapping; a whirlpool. |
| `syn.everyFoe` | Runs another hook at every foe (e.g. the Fairy Ring's spore cloud). |

Looks added for synergies (generic, usable by anything): `StyleOverride.tether` (a crackling line from each
thrown shot back to its thrower), 'nova' flavours `frost`, `spore`, `charm`, `ink`, `gold`, `water` or any
`#rrggbb`, and allied puddles with an elemental style (ember, muck, ice, dust…) drawn in that style with a
friendly pink rim instead of plain pink.
