# STORMDRAIN

A storm has rained for forty days, and everything the town lost washed down the storm drains. **Wren**, a kid in
an oversized yellow raincoat, follows a trail of glowing marbles down there to get it back.

STORMDRAIN is a top-down, room-by-room shooter: fight your way through each room, pick up items that stack and
combine in surprising ways, beat the boss, drop through the trapdoor to the next floor. Every run is different.
There are 12 chapters (6 main ones and 6 hidden ones), 8 characters to unlock, over 200 items and three endings.
Your progress (unlocks, collection, achievements) is saved on the device.

It is made for an **iPhone in landscape**, added to the home screen, and it also plays in any desktop browser with
a keyboard. It works offline once it has been opened.

## Controls

**Touch (phone)**

- **Move:** put your left thumb anywhere on the left half of the screen and slide it. The stick appears under
  your thumb.
- **Shoot:** put your right thumb anywhere on the right half and slide it toward where you want to shoot.
- **Buttons** along the edges: bomb, active item (its charge bar is beside it), consumable (left edge), pause and
  the map (top right). Pip gets an extra **DASH** button.
- Tap the small map to open the big map. Tap anywhere to close it.
- Settings: left-handed mode (swaps the sticks and the buttons), 360° aiming, button size, volumes.

**Keyboard (computer)**

| Key | Does |
|---|---|
| W A S D | move |
| Arrow keys | shoot |
| E | drop a bomb |
| Space | use the active item |
| Q | use the consumable |
| Shift | dash (Pip) |
| Esc or P | pause |
| Tab | the big map |

In menus: arrow keys move, Enter picks, Esc goes back.

## Put the game online and on your iPhone

You only need to do steps 1 to 7 once. It takes about 20 minutes. You need a computer and a free GitHub account.

### 1. Create a GitHub account

Go to <https://github.com> and click **Sign up**. Follow the steps (email, password, username) and confirm your
email address. Remember your **username**: it will be part of your game's web address.

### 2. Create a new, empty repository

A repository ("repo") is a folder on GitHub that holds the game's files.

1. On GitHub, click the **+** in the top-right corner, then **New repository**.
2. **Repository name:** for example `stormdrain` (short, lowercase, no spaces).
3. Choose **Public**.
4. Leave everything else **unticked**: no README, no .gitignore, no license. The repository must start empty.
5. Click **Create repository**.

### 3. Upload this folder to the repository

You need **Git** on your computer. On Windows, install it from <https://git-scm.com/download/win> (the default
choices are fine). On a Mac, open Terminal and type `git --version`; if Git is missing, the Mac offers to install it.

Open a terminal **in this folder** (the one that contains this README). On Windows: open the folder in File
Explorer, right-click an empty spot and choose **Open Git Bash here** (or "Open in Terminal"). Then type these
three commands, pressing Enter after each one. Replace `<user>` with your GitHub username and `<repo>` with the
repository name from step 2:

```
git remote add origin https://github.com/<user>/<repo>.git
git branch -M main
git push -u origin main
```

- The second command names the branch `main`. That matters: the website is only built from the `main` branch.
- The first time you push, a window asks you to sign in to GitHub. Sign in and allow access.
- If Git says `remote origin already exists`, run `git remote set-url origin https://github.com/<user>/<repo>.git`
  and then the last two commands again.
- If this folder is not a Git repository yet (Git says `not a git repository`), run these first:
  `git init`, then `git add -A`, then `git commit -m "First upload"`.

**Without typing commands:** install **GitHub Desktop** from <https://desktop.github.com>, sign in, choose
**File → Add local repository…** and pick this folder, then click **Publish repository**. Untick "Keep this
code private", and make sure the branch shown at the top is called `main` (if it is called `master`, use
**Branch → Rename…** to rename it to `main` first).

### 4. Turn on GitHub Pages (one time only)

1. On your repository's GitHub page, click **Settings** (the tab with the gear).
2. In the left menu, click **Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.

There is nothing to save. This step is never needed again.

### 5. Wait for the build, then open the game

1. Click the **Actions** tab of your repository.
2. You will see a run called **Test & deploy** (if the list is empty, push again or click **Test & deploy** on the
   left and then **Run workflow**). A yellow dot means it is still working: it installs everything, checks the
   code, runs the tests and builds the game. This takes a few minutes.
3. When the jobs **Typecheck, test, build** and **Deploy to GitHub Pages** have a **green tick**, the game is online.
   (A third job, **End-to-end (WebKit, iPhone 15 profiles)**, runs extra browser tests. It is informational: if it
   fails, the game is still published.)
4. Open `https://<user>.github.io/<repo>/` (for example `https://wrenfan.github.io/stormdrain/`). The address is
   also shown on the **Deploy to GitHub Pages** job.

### 6. Put it on your iPhone's home screen

1. On the iPhone, open that address in **Safari** (it must be Safari).
2. Tap the **Share** button (the square with an arrow pointing up).
3. Scroll down and tap **Add to Home Screen**, then **Add**.
4. From now on, **start the game from its icon** on the home screen. Turn the phone sideways (landscape) to play.
   The game fills the screen, without Safari's address bar, and works offline once it has been opened.

### 7. Important: two separate saves

> **Safari and the home-screen app keep SEPARATE saves.** Progress made in Safari does not show up in the
> home-screen app, and the other way round. **Always play from the home-screen icon.**
>
> To move your progress (for example from Safari to the app, or to a new phone): open **Settings → EXPORT SAVE**
> where your progress is, copy the code, then open **Settings → IMPORT SAVE** in the other place (on the title
> screen) and paste it.
>
> Safari may delete a website's saved data if you don't visit it for about 7 days. The home-screen app is exempt
> from that, which is another reason to play from the icon.

### 8. Updating the game

When the game's files change (you edited something, or received a new version):

1. Push the changes: in the terminal, in this folder, type `git add -A`, then `git commit -m "Update"`, then
   `git push`. (GitHub Desktop: write a summary, click **Commit to main**, then **Push origin**.)
2. Wait until the new **Test & deploy** run in the **Actions** tab is green.
3. On the iPhone, **close the app completely** (swipe it away in the app switcher) and open it again. The game
   checks for a new version when it starts and when you come back to it; when it finds one it shows a notice that
   an update is ready. Follow the notice (or close and reopen the app once more) to play the new version.

### 9. When something goes wrong

- **The run in the Actions tab is red.** Click the red run, then the job with the red cross, then the step with
  the red cross, and read its log. Usually a test failed: the log names the test and what it expected. The game
  stays on the previous working version until a run is green again.
- **The page is blank or says "404".** Check that step 4 is done (Source: **GitHub Actions**), that the address
  is exactly `https://<user>.github.io/<repo>/` with your username and repository name (and the `/` at the end),
  and that the last run is green. Right after the first deploy it can take a minute: wait, then refresh.
- **The old version still shows.** The game keeps a copy of itself on the phone so it works offline. Make sure the
  latest run is green, then close the app completely and open it again (in Safari: reload the page). It can take
  one more restart after the update notice.
- **"git push" is refused.** Check that you are signed in to the right GitHub account and that the repository
  address in step 3 is right (`git remote -v` shows it).

### 10. For developers

The game is TypeScript + Canvas 2D, built with Vite. You need **Node.js** (the current LTS version, the same as
the build uses: <https://nodejs.org>). In this folder:

```
npm ci                          # install exactly what package-lock.json lists
npm run dev                     # play it locally at the address it prints (also reachable from a phone on the same Wi-Fi)
npm run typecheck               # check the types
npm test                        # unit and simulation tests (Vitest)
npm run build                   # typecheck + production build into dist/
npx playwright install webkit   # once: the WebKit browser for the end-to-end tests
npm run test:e2e                # end-to-end tests in WebKit (iPhone 15 profiles); builds and serves the game itself
```

More documentation: `DESIGN.md` (the game), `ARCHITECTURE.md` (the code), `PLAN.md` (the build plan),
`DECISIONS.md` (choices made along the way), `SYNERGIES.md` (item combinations) and `docs/`.
