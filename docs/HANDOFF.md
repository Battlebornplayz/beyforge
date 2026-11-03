# BeyForge — session handoff (2026-11-02, updated after V6.8)

**To continue in a new session, say:** "Continue BeyForge. Read docs/HANDOFF.md first."

## About the owner (Aiden)
- He has no coding experience. Claude builds everything.
- Keep the tone casual.
- Send progress updates with screenshots every ~5 minutes during long work.
- Ask questions as buttons (AskUserQuestion), not long lists.
- **Show examples or mockups before building any new UI.** He asked for this for the parts browser.
- Goal: a full, fairly addictive game. Everything must be tunable from BeyForge Studio, with no code needed.
- No official Beyblade names anywhere (Play Store). Parts are based on real ones, with BeyForge names.
- Every shipped update gets a new section at the **top of CHANGELOG.md**. GitHub releases copy it automatically.
- After pushing, mirror changed files to the PC folder O:\BeyForge with the device file tools when the computer is linked. `.github/` files there are protected; skip them.

## Repo, builds and links
- **Repo:** github.com/Battlebornplayz/beyforge (main branch). **Site:** https://battlebornplayz.github.io/beyforge/
- **Workflows:**
  - `release.yml`: Windows .exe + Android APK. The release notes come from CHANGELOG.md.
  - `rules.yml`: auto-deploys firestore.rules.
  - `studio.yml`: builds BeyForge Studio, but only when `studio-desktop/` changes. It publishes to the rolling `studio` prerelease.
  - `backfill-notes.yml`: one-off, already ran.
- **BeyForge Studio** (owner dashboard): `studio/` (web), `studio-desktop/` (Electron, asks before updating). Demo mode: `studio/?demo`.
- **Firebase:** stays on the free Spark plan for now (the owner chose "Blaze later"). Uploads are stored compressed in Firestore.
- **Design docs:**
  - `docs/V5_DESIGN.md`, `docs/UI_DESIGN.md`
  - `docs/STUDIO_DESIGN.md`: 30 dashboard answers + 20 rank-overhaul answers.
  - `docs/ENGAGEMENT_DESIGN.md`: the 20 picked engagement features in waves E1–E4.
  - `docs/GAMEPLAY_DESIGN.md`: 40 answers for the battle overhaul.

## Done so far
- **V6.0–6.4:** UI overhaul, Home, battle HUD, shop, 3D pack opening with real part models.
- **V6.5:** BeyForge Studio wave 1 (`js/live.js` + `studio/*`).
- **V6.6 (E1):**
  - `js/engage.js`: onboarding first battle, free pack timer + local notifications, 30-day streak + freezes, first win, Spin Drops, reward cascade.
  - `studio/pages-economy.js`.
  - Rank fixes.
- **V6.7 (E2 part 1):**
  - `js/geometry.js`: Burst layer generations (`BF.LAYER_STYLES`) and disc frames (`BF.DISC_FRAMES`).
  - `js/catalog.js`:
    - `BF.CATALOG`: 158 parts. `BF.Catalog.pick/design/owned/progress`.
    - `BF.GIMMICKS` + `BF.gimmicksOf`.
    - Renamed and new tips.
    - Packs drop catalog parts; parts carry a `catId`.
  - `js/battle.js`: gimmick physics in the sim (`f.g` flags), Burst Attack/Tornado stadiums. Blade mode toggle in the launch UI.
  - New packs: `burst`, `xbooster`, `burstcrate` (pack `system` field).

- **V6.8 (Beydex):**
  - `js/dex.js`: 4 switchable layouts (`grid` default, `binder`, `locker`, `show`), lazy thumbnails, live 3D. The player's layout is saved per device.
  - Missing parts: black silhouette + name, with stats and gimmicks hidden.
  - Stats are measured in the background and cached per device (`bf.dexStats.v68`). **Bump that key when physics or the catalog change.**
  - Rewards: `BF.Econ` `dex` config (Studio → Rewards & economy → Beydex). Claims are saved on the profile as `dexClaims`.
  - `BF.Catalog.pool` is shared by pack rolls and the odds shown on part pages.
  - The tutorial no longer mentions 3D printing (owner's request).

## Known issues
- **Official names and printing still in the game.** Not cleaned up in V6.8:
  - "Beyblade": `manifest.webmanifest`, the X Booster description in `js/packs.js`, `js/ui.js` (Generation option, ID card), `js/export.js`, `js/terrain.js`, and others (grep to get them all).
  - Printing: the Home tile says "Design & print", and the manifest description mentions 3D printing.
- **Look-alike parts:** all bits and drivers are the same pink, and some discs match across rarities (Enigma Disc = 0 Disc).
- **Pack duplicate protection** in `BF.Packs.open` compares generated names, but the catalog hook then swaps in a different part, so it likely no longer works. Check it.

## Previewing work in the Claude desktop browser pane
The pane can't open a server in the cloud container. Push a test branch and open `https://rawcdn.githack.com/Battlebornplayz/beyforge/<full commit sha>/index.html`. The first visit shows a notice page to click through. Sign-in won't work there. The owner chose this way of watching.

## Next up (in order)
0. **Gameplay overhaul comes first (owner's call).** See `docs/GAMEPLAY_DESIGN.md`: his 40 answers, proposed waves and risks. Get the waves approved and show mockups before building UI. Packs fix V6.8.1 still needs confirming on his real account.
1. **Rest of E2 (paused):** one shard currency is decided. Other questions are listed at the end of `docs/GAMEPLAY_DESIGN.md`.
   - Forge Shards (duplicates → shards → craft or level a specific catalog part).
   - Evolutions (max-level part → new look + stronger signature).
   - Masteries (wins per part → titles and frames).
   - A visuals/animation pass.
   - Studio pages to tune all of it.
   - Also: add the pack `system` field to the Studio pack editor, and add a catalog editor to Studio.
2. **E3:** finisher replays, in-battle bounties, ghost battles, steal-a-part, weekly leagues, showcase likes.
3. **E4:** monthly seasons + free pass, event modes, weekly tournaments, quest chains + mystery chest. The rank overhaul from STUDIO_DESIGN.md merges in here: metal tiers + RP, placements, 3D emblems, rank-up cinematic, Lv100 + prestige.
4. **Studio wave 2 items:** events, redeem codes, mass gifts, news/pop-ups, balance sliders + simulator, testing tools, uploads, feedback, planning board, anti-cheat, alerts.

## Testing approach
- **Test saves against real Firestore validation.** Stubbing `cloud()` to false hides save errors. Use `firebase.firestore().batch().set(ref,data)`: it validates right away and writes nothing, as long as you never commit. V6.7 shipped a live pack bug because of this gap.
- Headless Playwright with swiftshader, from scripts in the scratchpad.
- Fake the profile by stubbing `BF.Account.profile`/`update` and `firebase.firestore.FieldValue` (see the e1.js pattern).
- Studio: `studio/index.html?demo` runs on in-memory fake Firestore data.
