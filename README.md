# STORMDRAIN

A storm has rained for forty days, and everything the town lost washed down the storm drains. **Wren**, a kid in
an oversized yellow raincoat, follows a trail of glowing marbles down there to get it back.

STORMDRAIN is a top-down, room-by-room shooter. You move with one thumb and shoot with the other. You clear each room,
pick up items that stack and combine in surprising ways, beat the boss and drop through the trapdoor to the next
floor. Every run is different. When you die you start again, and what you unlocked on the way stays unlocked.

- 12 chapters of two floors each (6 main ones and 6 hidden ones), plus a secret floor at the very bottom
- 8 characters (7 of them to unlock), each with a trick of their own
- over 200 items, 9 item sets that transform you and 63 special item combinations ([SYNERGIES.md](SYNERGIES.md))
- 22 bosses, 8 minibosses, 3 final bosses and 3 endings
- your progress is saved as you play, and the game works offline

It is made for an **iPhone held sideways (landscape) and added to the home screen**. It also plays in any desktop
browser with a keyboard.

**Contents**

1. [Controls](#controls)
2. [Put the game online and on your iPhone](#put-the-game-online-and-on-your-iphone) (steps 1 to 6, done once)
3. [Updating the game](#updating-the-game) · [Playing offline](#playing-offline) · [Seeds and the daily run](#seeds-and-the-daily-run)
4. [When something goes wrong](#when-something-goes-wrong)
5. [For developers](#for-developers): running it locally, where things are, adding content, the hidden debug menu

---

## Controls

**On the iPhone (touch)**

| What | How |
|---|---|
| **Move** | Put your left thumb anywhere on the left half of the screen and slide it. The stick appears under your thumb. It works right up to the edge of the screen, the black bars beside the picture included. |
| **Shoot** | Put your right thumb anywhere on the right half and slide it toward where you want to shoot. Keep it there to keep shooting. A quick flick turns your aim at once. |
| **Charge** | Some weapons charge up: keep aiming and a meter fills above Wren. Lift your shooting thumb when it is full to fire. |
| **Bomb and active item** | The buttons just above your shooting thumb. The bar beside the active item shows its charge; clearing rooms fills it. |
| **Consumable** | The button on the left edge (potions and stickers). |
| **Pause and map** | Top right. Tap the small map to open the big map; tap anywhere to close it. |
| **Dash** | Only Pip, the mole: he gets an extra **DASH** button. |

The faint MOVE and SHOOT circles at the start show where your thumbs rest. No button is ever in their way. Hold the
phone sideways: in portrait the game pauses and asks you to turn it.

**Settings** (title screen: top-right corner; during a run: pause → **SETTINGS**): **LEFT-HANDED** swaps the sticks and
the buttons, **AIM** 4-way or 360°, **BUTTON SIZE** 100-150 % (never smaller than a fingertip), volumes, screen
**SHAKE**, **REDUCE FLASHING** and **SHOW FPS**.

**On a computer (keyboard)**

| Key | Does |
|---|---|
| W A S D | move |
| Arrow keys | shoot (hold to keep shooting; a charging weapon fires when you let go) |
| E | drop a bomb |
| Space | use the active item |
| Q | use the consumable |
| Shift | dash (Pip) |
| Esc or P | pause |
| Tab | the big map |

In menus: the arrow keys move, Enter picks, Esc goes back. You can also click with the mouse.

---

## Put the game online and on your iPhone

The game is a website. **GitHub** (free) stores the game's files, and **GitHub Pages** (also free) turns them into a
website. Every time you upload a change, GitHub tests the game and publishes the new version by itself. On the
iPhone you then add that website to the home screen. From there it opens like an app, full screen, and works
offline.

You only do steps 1 to 6 once. Plan on about 30 minutes, most of it waiting.

**You need:** a Windows PC or a Mac with this folder on it, an iPhone with Safari, and an email address. You do
**not** need to install any programming tools to publish the game: GitHub builds it.

### Step 1 — Create a free GitHub account

1. Go to <https://github.com/signup>.
2. Type your email address, a password and a **username**, and follow the steps. GitHub may show a small puzzle to
   check you are a person, then emails you a code to type in.
3. If it asks for a plan, choose **Free**. You can skip the questions about how you will use GitHub.

Remember your username: it becomes part of your game's web address, `https://<username>.github.io/...`.

### Step 2 — Upload this project to GitHub

GitHub keeps each project in a **repository** (a "repo"): a project folder in your account. This folder already
holds the whole project with its history, on a branch called `main`. You only need to upload it. Big folders
(`node_modules`, `dist`, test results) are left out on purpose (the `.gitignore` file lists them), so the upload is
small.

Pick **one** of the two options.

#### Option A — GitHub Desktop (recommended for beginners)

GitHub Desktop is a free app with buttons instead of commands. It also creates the repository for you.

1. Download **GitHub Desktop** from <https://desktop.github.com> and install it.
2. Open it and click **Sign in to GitHub.com**. Your browser opens: sign in and click **Authorize desktop**, then go
   back to GitHub Desktop. If it asks you to configure Git, keep the name and email it suggests and click
   **Finish**. (Skipped the sign-in? Windows: **File → Options → Accounts → Sign in**. Mac: **GitHub Desktop →
   Settings → Accounts → Sign in**.)
3. Click **File → Add local repository…**, then **Choose…**, pick this folder (the one with this `README.md` in it)
   and click **Add repository**.
4. At the top, **Current branch** must say `main`. (If it says `master`, click **Branch → Rename…**, type `main` and
   click **Rename**.)
5. Click the blue **Publish repository** button (in the top bar, or in the middle of the window).
6. In the window that opens:
   - **Name:** for example `stormdrain` (short, lowercase, no spaces; it becomes part of the web address).
   - **Untick "Keep this code private".** A free account can only publish a website from a public repository.
   - Click **Publish repository**.
7. Wait until the top bar says **Fetch origin**: the upload is done. **Repository → View on GitHub** opens your new
   repository in the browser.

Now go to [step 3](#step-3--turn-on-github-pages-once).

#### Option B — The git command line

**1. Create an empty repository on GitHub.**

1. On <https://github.com>, signed in, click the **+** in the top-right corner, then **New repository**.
2. **Repository name:** for example `stormdrain` (short, lowercase, no spaces).
3. Choose **Public**. (A free account can only publish a website from a public repository.)
4. Leave everything else **off**: no README, no .gitignore, no license. The repository must start empty.
5. Click **Create repository**. Leave the page open.

**2. Install Git.** On Windows, install it from <https://git-scm.com/download/win> (the default choices are fine;
it comes with **Git Bash**). On a Mac, open **Terminal** and type `git --version`: if Git is missing, the Mac offers
to install it.

**3. Open a terminal in this folder.** On Windows, open the folder in File Explorer, right-click an empty spot and
choose **Open Git Bash here** (on Windows 11 click **Show more options** first) or **Open in Terminal**. On a Mac,
right-click the folder in Finder and choose **New Terminal at Folder** (or type `cd `, drag the folder into the
Terminal window and press Return).

**4. Upload.** Type these three commands, pressing Enter after each one. Replace `<username>` with your GitHub
username and `<repo>` with the repository name from part 1:

```
git remote add origin https://github.com/<username>/<repo>.git
git branch -M main
git push -u origin main
```

- The first command tells Git where your repository on GitHub is (it calls it `origin`).
- The second makes sure the branch is called `main`. That matters: the website is only built from the `main` branch.
- The third uploads everything. The first time, a window asks you to sign in to GitHub: choose **Sign in with your
  browser** and click **Authorize**. After this, a plain `git push` is enough.

If Git complains:

- `remote origin already exists`: run `git remote set-url origin https://github.com/<username>/<repo>.git`, then the
  last two commands again.
- `not a git repository`: the terminal is in the wrong folder. Open it in the folder that holds this README.
- `Author identity unknown`: run `git config --global user.name "Your Name"` and
  `git config --global user.email "you@example.com"`, then the command again.
- `rejected … (fetch first)`: the repository wasn't empty (a README was added when it was created). For a brand-new
  repository only, `git push -u --force origin main` replaces what GitHub added with this project.

### Step 3 — Turn on GitHub Pages (once)

1. Open your repository on GitHub: `https://github.com/<username>/<repo>`.
2. Click **Settings** (the tab with the gear, at the top of the repository).
3. In the menu on the left, under "Code and automation", click **Pages**.
4. Under **Build and deployment**, set **Source** to **GitHub Actions**.

There is nothing to save, and you never need to do this again.

> [!NOTE]
> Your upload in step 2 already started a first build. Its deploy part probably failed (a red cross), because Pages
> was not on yet. That is expected: step 4 starts it again.

### Step 4 — Build the game and find its address

1. Click the **Actions** tab of your repository.
2. On the left, click **Test & deploy**. On the right, click **Run workflow**, then the green **Run workflow** button.
   (You can also open the failed run and click **Re-run all jobs**.)
3. A new run appears in the list; click it. It has three jobs:
   - **Typecheck, test, build**: checks the code, runs about 2,800 tests and builds the game. This is the long part
     (usually 5 to 15 minutes).
   - **Deploy to GitHub Pages**: puts the game online (about a minute).
   - **End-to-end (WebKit, iPhone 15 profiles)**: extra tests in a Safari-like browser. It is only for information:
     if it fails, the game is still published.

   A yellow dot means the job is still working, a green tick means done, a red cross means it failed (see
   [When something goes wrong](#when-something-goes-wrong)).
4. When **Deploy to GitHub Pages** has a green tick, the game is online at:

   **`https://<username>.github.io/<repo>/`** (for example `https://wrenfan.github.io/stormdrain/`)

   You can also find the address under the deploy job, and in **Settings → Pages** ("Your site is live at…", with a
   **Visit site** button). Try it on the computer first: it plays with the keyboard.

From now on, every upload to `main` runs this by itself.

### Step 5 — Put the game on your iPhone's home screen

1. On the iPhone, open **Safari** (these steps are for Safari).
2. Type the address from step 4 exactly, with the `/` at the end. Wait until the title screen appears (Wren in
   front of a drain). While you wait, the game also stores itself on the phone for offline play.
3. Tap the **Share** button: the square with an arrow pointing up. (On newer iOS versions tap **•••** at the bottom
   right first, then **Share**.)
4. Scroll down and tap **Add to Home Screen**. (Not in the list? Scroll to the very bottom, tap **Edit Actions…**
   and add it.)
5. If there is an **Open as Web App** switch, leave it **on**. Keep the name **Stormdrain** and tap **Add**.
6. Go to your home screen and tap the new **Stormdrain** icon. Turn the phone sideways. The game fills the whole
   screen, without Safari's address bar.
7. Tap the screen once: an iPhone only lets a website make sound after the first tap.

From now on, **always start the game from its icon**. Here is why:

### Step 6 — Important: two separate saves

> [!WARNING]
> **Safari and the home-screen app keep SEPARATE saves.** Progress made in a Safari tab does not show up in the
> home-screen app, and the other way round. **Always play from the home-screen icon.**
>
> Safari may also delete a website's saved data if you don't visit it for about 7 days. The home-screen app keeps its
> saves, which is another reason to play from the icon. Removing the icon from the home screen can delete its saves
> too, so export your save first (below).

**Moving your progress** (from Safari to the app, to a new phone, or just to keep a backup) uses a save code:

1. **Where your progress is:** open **SETTINGS** (title screen: top-right corner; during a run: pause →
   **SETTINGS**), tap **EXPORT SAVE**, then **Copy**, then **Done**. The code (a long text that starts with `SD1:`)
   is now on the clipboard. For another phone, paste it into a note or a message to yourself.
2. **Where you want it:** on the **title screen**, open **SETTINGS** and tap **IMPORT SAVE**, then **Paste**. The code
   is checked at once and you see what it contains. Tap **Replace**. (Importing replaces the progress there, and it
   only works from the title screen, not during a run.)

The game helps you with this. In a Safari tab the title screen says **ADD TO HOME SCREEN TO KEEP YOUR SAVES** and,
once you have some progress, shows an **EXPORT SAVE** button in its bottom-left corner. The first time you open the
home-screen app it offers **IMPORT SAVE** in the same corner. The bottom line of Settings says where your saves are:
"SAVED ON THIS DEVICE" in the app, "SAVED IN SAFARI · MAY BE CLEARED" in a Safari tab.

**What is saved:** your unlocks, collection, achievements, stats and settings are saved the moment they change. A run
is saved every time you enter a room and every time you clear one, so closing the app never costs more than the fight
you were in. Tap **CONTINUE** on the title screen to carry on.

---

## Updating the game

When the game's files change (you edited something, or you received a newer version of the files):

1. **Upload the change.**
   - GitHub Desktop: the changed files are listed on the left. Type a short summary at the bottom left (for example
     "New items"), click **Commit to main**, then **Push origin** at the top.
   - Command line, in this folder:

     ```
     git add -A
     git commit -m "Describe the change"
     git push
     ```
2. **Wait for the build.** In the **Actions** tab a new **Test & deploy** run starts by itself. When it is green,
   the new version is online. If a test fails, nothing changes online: the previous version stays up.
3. **Open the app on the iPhone.** The game checks for a new version when it starts and when you come back to it (at
   most once an hour), and downloads it in the background. When it is ready, the title screen says **NEW VERSION
   READY · TAP RELOAD** and shows a **RELOAD** button (bottom right): tap it. Your progress and your run are saved
   first, so you can Continue right after. During a run you only see a short "UPDATE READY" notice: the game never
   reloads while you play.

Don't see it? Close the app completely (swipe up from the bottom edge and hold, then swipe the game away) and open it
again. The update is picked up on the next launch; sometimes it takes two launches (one to download, one to show it).

## Playing offline

After the game has been opened once with an internet connection (and the title screen appeared), everything it needs
is stored on the phone. It then plays with no connection at all: airplane mode, underground, anywhere. Saving never
needs the internet. New versions arrive the next time you open the game online.

## Seeds and the daily run

Every run is built from a **seed**, an 8-character code such as `ABCD 1234`. The same code always builds the same run:
the same floors, rooms, enemies and items, on every phone and every save.

- **See a run's code:** in the pause menu, and on the game-over screen.
- **Play a code:** title screen → **ENTER SEED**, type the 8 letters or digits (spaces, dashes and small letters don't
  matter), pick a character and tap **START**. After a death, **RETRY SEED** replays the same run.
- **The daily run:** title screen → **DAILY RUN**. Everyone gets the same code each day (the day changes at midnight
  UTC). Your first attempt of the day is scored; the result goes to the **STATS** page. Later attempts that day are
  practice.
- **Seeded runs are practice.** A typed code, a retry or a daily replay can be learned by heart, so it doesn't unlock
  endings or routes or give single-run achievements. Lifetime stats, the collection and the bestiary still count. To
  build the same run for everyone, a code only uses the items a brand-new player has.

---

## When something goes wrong

- **The run in the Actions tab is red.** Click the run, then the job with the red cross, then the step with the red
  cross, and read its log. Usually a test failed: the log names the test and what it expected. The game stays on the
  previous working version until a run is green again. A red **End-to-end** job alone doesn't stop the game from being
  published.
- **The deploy job fails right away** (its log says "Not Found" or asks you to enable GitHub Pages). Pages is not on. Do
  [step 3](#step-3--turn-on-github-pages-once), then run the workflow again (step 4).
- **The page says "404" or "There isn't a GitHub Pages site here".** Check that step 3 is done (**Source: GitHub
  Actions**, not "Deploy from a branch"), that the repository is **public**, that the last run is green, and that the
  address is exactly `https://<username>.github.io/<repo>/`, with the `/` at the end. Copy it from **Settings → Pages**
  to be sure. Right after the first deploy it can take a minute or two: wait, then reload.
- **The page stays blank or black.** Wait a moment and reload. Make sure the iPhone's iOS is up to date. On a computer,
  opening `index.html` straight from the folder does not work; use the website address (or `npm run dev`, below).
- **An old version still shows.** The game keeps a copy of itself on the phone so it works offline. Make sure the latest
  run in the Actions tab is green, then close the app completely and open it again, and tap **RELOAD** on the title
  screen when it appears. In a Safari tab, reload the page.
- **No sound.** Check the Ring/Silent switch on the side of the iPhone (the game stays quiet in silent mode, like other
  games; on models with an Action button, check silent mode in Control Center), turn the volume up, and tap the
  screen once (an iPhone only allows sound after a tap). In Settings, check **MASTER**, **MUSIC** and **EFFECTS**.
- **The game won't turn sideways** (it keeps asking you to rotate). Open Control Center (swipe down from the top-right
  corner) and turn off **Portrait Orientation Lock** (the padlock with a round arrow).
- **The picture is small, with Safari's bars around it.** You are in a Safari tab, not the app. Use the home-screen
  icon ([step 5](#step-5--put-the-game-on-your-iphones-home-screen)).
- **Buttons are too small, or you are left-handed.** Settings → **BUTTON SIZE** and **LEFT-HANDED**.
- **My progress is gone.** Did you open the game in Safari instead of from the icon? They keep separate saves (step 6).
  If you exported a save code earlier, import it.
- **"SOMETHING WENT WRONG" and you are back on the title screen.** The game hit an unexpected error. Your run is kept as
  it was at the last room you entered or cleared: tap **CONTINUE**.
- **`git push` is refused or asks for a password.** GitHub doesn't accept your account password there. Sign in through
  the browser window Git opens (on a Mac, if no such window appears, use GitHub Desktop, option A), and check that
  the repository address is right: `git remote -v` shows it.
- **GitHub Desktop says the repository name already exists.** You already have a repository with that name (perhaps
  from a first try). Pick another name.

---

## For developers

### Running it on your computer

You need **Node.js**, the current LTS version (the same one the build on GitHub uses): <https://nodejs.org>. Then, in
this folder:

```
npm install                     # once: install the tools (npm ci installs exactly what package-lock.json lists)
npm run dev                     # play it locally at the address it prints (Ctrl+C stops it)
npm test                        # the unit and simulation tests (Vitest; about 3 minutes)
npm run typecheck               # check the types only
npm run build                   # typecheck + production build into dist/
npm run preview                 # serve the built game from dist/ at http://localhost:4173
npx playwright install webkit   # once: the WebKit browser for the end-to-end tests
npm run test:e2e                # end-to-end tests in WebKit (iPhone 15 profiles); builds and serves the game itself
npm run balance                 # optional: a bot plays 160 whole runs and prints win rates, deaths and the economy
npm run icons                   # regenerate the app icons in public/icons after changing their art
```

`npm run dev` also prints a **Network** address. Open it on a phone on the same Wi-Fi to try the touch controls. (The
offline mode only exists in the built game, not in the dev server.) The test switches (longer soaks, the full stress
test, the balance harness's options) are listed in [docs/testing.md](docs/testing.md).

### Where things are

| File | What it holds |
|---|---|
| [DESIGN.md](DESIGN.md) | The game bible: story, chapters, bosses, characters, item sets, curses, unlocks. New content should fit it. |
| [ARCHITECTURE.md](ARCHITECTURE.md) | The code contract: folder layout, content registries, the attack pipeline (§4), floors, runs, bosses, saving, UI, rendering, test hooks. |
| [SYNERGIES.md](SYNERGIES.md) | Every special synergy: what it needs and what it does. A test checks it against the data. |
| [PLAN.md](PLAN.md) | The build plan phase by phase, with a **Status** section on top: what is done and what is left. |
| [DECISIONS.md](DECISIONS.md) | Every choice made along the way and why, grouped by phase, with a topic index. |
| [docs/](docs/) | Module guides: `testing.md` (tests, the play-bot, CI), `floorgen.md` (floors and room templates), `saving.md` (saves, export codes, PWA), `audio.md` (music and sound), `characters.md` (characters, achievements, locked items), and `content-*.md` (notes from each content pack: items, enemies, rooms, bosses, finals, synergies). |

```
src/main.ts         starts everything: canvas, loop, scenes, input, audio, saves, service worker
src/engine/         loop, display scaling, touch + keyboard input, seeded random numbers
src/sim/            the game rules: no DOM, so tests run them headless (attack/, floor/, run/, bosses/, enemies/)
src/content/        the DATA: items, enemies, bosses, rooms, chapters, characters, synergies, sets, achievements, music
src/render/  src/ui/  src/audio/    drawing, menus and screens, sound and music
src/meta/  src/pwa/                  saves, achievements, unlocks; the service worker (offline, updates)
src/debug/          the hidden debug menu
tests/  e2e/        Vitest tests (npm test) and Playwright WebKit tests (npm run test:e2e)
.github/workflows/deploy.yml         test + build + deploy to GitHub Pages on every push to main
```

### Adding content

Every kind of content has its own folder in `src/content/` and is **found automatically**: add an entry to a file
there (or a new file that `export default`s a list) and it is in the game. There is no list to register it in. Then
run `npm test`: the content validation checks every reference, sprite and rule, and the failing test's message names
the problem. To try a new item or enemy at once, use the [debug menu](#the-hidden-debug-menu) (ITEMS / FOES tabs).

**An item** goes in `src/content/items/*.ts` (passives, actives, trinkets and consumables):

```ts
{
  id: 'drip-tray',                          // unique, lowercase-with-dashes
  name: 'Drip Tray',                        // unique across items, enemies and bosses
  desc: 'RANGE UP · CATCHES EVERY LAST DROP', // at most 46 characters, UPPERCASE (the pixel font has no lowercase)
  kind: 'passive',                          // 'passive' | 'active' | 'trinket' | 'consumable'
  quality: 1,                               // 0-4: how strong it is (stronger = rarer)
  pools: ['treasure', 'shop'],              // where it can appear: treasure, shop, boss, secret, cursed, broker…
  tags: ['stat-up'],                        // a set's tag (e.g. 'tidewalker') makes it count toward that set
  effects: [{ type: 'stat', stat: 'range', add: 30 }],
  sprite: DRIP_TRAY,                        // a 14 × 14 pixel map; copy one from the same file
},
```

Effects can change a stat (`damage`, `fireRate`, `shotSpeed`, `range`, `moveSpeed`, `luck`, `shotSize`,
`knockback`), add a shot modifier (`mod`: homing, bounce, split, chain, burn, freeze…), give a new attack type
(`carrier`: the Storm Lance's beam, lasers, boomerangs, melee, bombs, charge, orbiting blades), a helper
(`familiar`), a flag (flight…), heal or give hearts or pickups, or run other effects on a trigger (on firing, a kill,
getting hurt, a cleared room…). An optional `unlock: '<achievement id>'` keeps an item locked until that achievement
is earned. Look at the existing files for actives (charges) and consumables, and at ARCHITECTURE §4 for the modifiers.

**An enemy** goes in `src/content/enemies/<chapter>.ts`. It is data only: it picks one movement and a few attacks
from a shared behaviour library (movements such as `wander`, `chase`, `hop`, `dash`, `burrow`, `float`, `turret`;
attacks such as `aimedShot`, `ringN`, `spreadFan`, `lob`, `spawnMinion`, `leaveTrail`):

```ts
{
  id: 'sewer-newt',
  name: 'Sewer Newt',
  hp: 14, speed: 30, radius: 5, contact: 1,  // contact = half hearts it takes when it touches you
  move: { kind: 'wander', params: { pause: 1, dist: 30 } },
  attacks: [{ kind: 'aimedShot', cooldown: 2, params: { speed: 90, windup: 0.4 } }],
  sprite: SEWER_NEWT_SPRITE,                  // pixel frames, like the others in content/sprites/
  chapters: ['rootcellar'],                   // which chapters' rooms it appears in
  weight: 6,                                  // how often it is picked there
  championable: true,                         // may spawn as a tougher, coloured champion
  bestiary: 'Lives in the pipes and spits at anything that splashes.',
},
```

Every behaviour's settings have defaults and limits, and the validation tells you if one is unknown or out of range.
(The first chapter's pool is kept at exactly 8 enemies by a test, so add new ones to other chapters.)

**A room** goes in `src/content/rooms/<chapter>.ts`. Rooms are 13 × 7 tiles:

```ts
{
  id: 'gutter.normal.leaf_pile',   // <chapter prefix>.normal.<name>
  chapters: CH,                    // the file's chapter
  type: 'normal',
  difficulty: 1,                   // 1-3: deeper floors pick harder rooms
  grid: [
    '.............',
    '..#.......#..',
    '.....e.e.....',
    '..x.......x..',
    '.....e.e.....',
    '..#.......#..',
    '.............',
  ],
},
```

What each letter means: `.` floor, `#` rock, `$` tinted rock (holds loot), `M` metal block, `O` pit, `^` spikes, `f` fire,
`x` crate, `u` urn, `e` enemy, `E` strong enemy, `c` chest, `p` pickup, `i` item pedestal, `S` shop slot, `B` boss.
The rules: the middle tile of each edge (where the doors are) and the tile just inside it stay plain floor, no enemy
or hazard within 2 steps of a door, at most 10 enemies, and every floor tile reachable without walking through fire
or spikes. The details are in [docs/content-rooms.md](docs/content-rooms.md).

**Everything else** works the same way: bosses in `src/content/bosses/` (guides: `docs/content-bosses-*.md`),
synergies in `src/content/synergies/` (add a row to SYNERGIES.md too; a test checks it), item sets in
`src/content/sets/`, achievements in `src/content/achievements/`, characters in `src/content/characters/`
([docs/characters.md](docs/characters.md)) and music in `src/content/music/` ([docs/audio.md](docs/audio.md)).
ARCHITECTURE.md "Content registries" lists them all.

### The hidden debug menu

A menu for testing: spawn any item, enemy or boss, god mode, and more. It opens during a run:

- **On a computer:** press the **`` ` ``** key (backquote: the key left of 1, under Esc).
  Press it again, or Esc, to close. The number keys 1-4 switch tabs.
- **On the iPhone:** tap pause (top right), then quickly tap the word **PAUSED** (top left of the pause screen)
  **5 times**.

Its tabs: **ITEMS** (tap one to put it on a pedestal next to Wren, or switch to giving it straight away), **FOES**
(spawn any enemy, optionally as a champion), **BOSSES** (fight any boss, miniboss or final boss in the current room),
and **CHEATS**: god mode, full heal, +10 coins / bombs / keys, clear the room, waves of enemies, the performance
overlay, skip the floor, reveal the map, go to the boss, the next curse, the training yard, a new run, and
**UNLOCK ALL** / **RESET UNLOCKS** (tap twice to confirm).

> [!CAUTION]
> **UNLOCK ALL** and **RESET UNLOCKS** change your real save. RESET UNLOCKS wipes your progress (your settings and
> saved run stay). Export your save first if you want to keep it.

On a computer, the browser's developer console (F12) also has everything the menu does, under `window.__SD.debug`.
For example, `__SD.debug.runAt(9)` starts a run on floor 9, and `__SD.debug.bosses()` lists every boss id.
