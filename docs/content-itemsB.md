# Items B: 42 passives, 4 sets, 4 familiars

Content only. Nothing in `src/sim` changed. Everything uses the existing effect vocabulary (ARCHITECTURE §5)
and passes `validateContent()`. Tests are in `tests/content-items-b.test.ts`.

| File | What |
|---|---|
| `src/content/items/passives-b-sets.ts` | 22 set members (Toybox 6, Ossuary 6, Tidewalker 5, Glimmer 5) |
| `src/content/items/passives-b-general.ts` | 20 general passives |
| `src/content/sets/{toybox,ossuary,tidewalker,glimmer}.ts` | the four `ItemSetDef`s (need 3) |
| `src/content/familiars/itemsB.ts` | Tin Sentry, Threadbare Bear, Tadpole, Gutter Ferret |
| `src/content/hooks/itemsB.ts` | `itemsB.statusBurst`, `itemsB.toll` |
| `src/content/sprites/itemsBIcons.ts` / `itemsBCostumes.ts` / `itemsBFamiliars.ts` | icons, costume layers, familiar sprites |

## Sets (transformations)
| Set | Members | Bonus (persistent effects) | Look |
|---|---|---|---|
| **Toybox** | Tin Sentry, Threadbare Bear, Chattering Teeth, Stacking Blocks, Paper Crown, Marble Run | 2 × `tin-sentry` familiar, +1 luck, +0.3 fire rate | checked patches sewn on the coat (body, dir) |
| **Ossuary** | Tin Ribcage, Merrythought, Bone Jacks, Crow's Jawbone, Spine Rattle, Skeleton Key | `orbit` carrier (bone blades), +0.5 damage, `floorStart` → +1 Tin heart | bone mask with glowing sockets (eyes, dir) |
| **Tidewalker** | Squelchy Galoshes, Skipping Stone, Leaky Bucket, Tadpole Jar, Startled Frog | `bounce` + `puddle`, +16 move speed, +20 shot speed | wet shimmer + falling drops (aura, behind, anim, additive) |
| **Glimmer** | Cracked Cat's-Eye, Pocket Prism, Rock Salt Crystal, Amethyst Heart, Glowstone Pendant | `split` (+1 count: 3 shards), +0.5 damage, +0.5 shot size | violet crystals out of the hood + gems (hat, anim) |

The set bonuses stack with the members: the Toybox sentries add to Tin Sentry items, the Ossuary blades to
Bone Jacks / Tin Pinwheel, the Tidewalker bounce to Skipping Stone / Rubber Ball, the Glimmer split to Geode /
Cracked Cat's-Eye.

Notes for whoever builds the set engine:
- The set bonuses use only persistent effects (familiar, carrier, mod, stat, trigger). `recomputePlayer` skips
  instant effects in set bonuses, so the Ossuary Tin heart is a `floorStart` trigger.
- The current `recomputePlayer` counts duplicate copies toward `need`, so 3 × Paper Crown completes Toybox.
  My tests don't depend on that either way (they use 3 different members, or at most 2 copies of one).
- No set uses `hook`.

## Items
Quality in brackets. Duplicates stack: stats add (multipliers multiply), modifiers and carriers add stacks,
familiars add another helper, chance triggers roll once per copy, and one-time hearts or pickups come with every
fresh copy.

**Toybox**: Tin Sentry [2] (follow shooter familiar), Threadbare Bear [2] (guard familiar, blocks shots),
Chattering Teeth [2] (on hurt: shockwave 64 px / 30 dmg + knockback shots for 4 s), Stacking Blocks [1]
(+0.6 dmg, knockback), Paper Crown [2] (every stat up a little, costume), Marble Run [2] (circleFirst + bounce).

**Ossuary**: Tin Ribcage [1] (+2 Tin), Merrythought [2] (+1 luck; room clear 6 % + 2 %/luck, max 30 %, drops a
Tin heart), Bone Jacks [3] (orbit carrier, costume), Crow's Jawbone [2] (+0.5 dmg; kill 3 % + 1 %/luck, max
10 %, drops a Tin heart), Spine Rattle [1] (on hurt: `itemsB.statusBurst` fear, 96 px, 3.5 s + fear shots for 6 s),
Skeleton Key [1] (+2 keys; room clear 10 % + 2 %/luck drops a key).

**Tidewalker**: Squelchy Galoshes [2] (+14 speed, slow), Skipping Stone [2] (bounce +1 extra bounce, shot
speed), Leaky Bucket [2] (puddle), Tadpole Jar [2] (hover shooter familiar), Startled Frog [1] (on hurt: +30 speed
and +1.2 fire rate for 6 s).

**Glimmer**: Cracked Cat's-Eye [3] (split with +1 count, costume), Pocket Prism [2] (spread), Rock Salt Crystal
[2] (pierce + 0.5 dmg), Amethyst Heart [2] (+1 container, +1 Tin), Glowstone Pendant [2] (seeSecrets,
darkVision, +1 luck, costume).

**General**: Hot Water Bottle [2] (+1 container, +1 Ember), Sardine Tin [1] (+3 Tin), Warming Pan [2] (+2 Ember,
fireImmune), Clover in Amber [2] (+1.5 luck, a lucky coin every floor), Bent Horseshoe [2] (+2 luck,
inaccuracy), Grudge Pebble [2] (on hurt: +2 dmg for 10 s, stacks), Spare Spoon [1] (kill: heal ½ heart, 6 % +
1 %/luck, max 25 %), Stray Cat's Bell [2] (kill: homing for 2.5 s, 0.5 s cooldown), Tin Lunchbox [1] (room clear
may roll the `basket` table), Thunder Egg [1] (room clear may add +1 active charge), Chipped Piggy Bank [1]
(+5 coins, +1 coin per clear), Leather Apron [2] (+3 bombs, explosionImmune; placing a bomb may refund it),
Rusty Toll Box [1] (each clear: `itemsB.toll` trades 4 coins for a Tin heart pickup), Hand-Me-Down Pockets [2]
(extra trinket and consumable slot; pickups may add a coin), Bundle of Balloons [3] (flying, costume behind),
Bedsheet Ghost [2] (spectral + fear, costume), Cast-Iron Kettle [3] (damage ×1.3, speed ×0.92, kettle
helmet), Burnt Coffee Bean [2] (fire rate ×1.2), Kaleidoscope [2] (side + back shots, damage ×0.85), Gutter
Ferret [2] (chase familiar that also fires point-blank).

## Hooks (`src/content/hooks/itemsB.ts`)
- `itemsB.statusBurst { status, radius, duration, power?, damage?, look? }`: applies a status to every hittable
  enemy within `radius` of the effect position and shows a nova. It reads `ctx.w.enemies` directly and imports
  no sim modules (the kill-credit source `SRC_BOMB = 1` is mirrored in a local constant).
- `itemsB.toll { cost, pickup }`: if the player has `cost` coins, it takes them and pops the pickup out, with the
  `shop_buy` sound.

## Tags
Every item carries its set tag when it has one (`toybox`, `ossuary`, `tidewalker`, `glimmer`), plus a
category: `familiar`, `modifier`, `trigger`, `health`, `luck`, `economy`, `stat`, `stat-mul`, `flight`,
`spectral`, `utility` or `attack`. Items tagged `familiar` or `modifier` also go through the starter-item test
suite (`tests/starter-items.test.ts` selects by those tags), and they pass it.
