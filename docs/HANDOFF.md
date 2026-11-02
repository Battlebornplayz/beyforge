# BeyForge — session handoff (2026-11-02)

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

## Next up (in order)
1. **Parts browser / Beydex page.**
   - The owner wants it to look like a card-grid store UI. He gave ScriptBlox as a *visual* reference only.
   - **First show him 3–5 mockup options** (inline visuals or a quick design) and let him pick.
   - A draft is already written: `js/dex.js` (`BF.Dex`, `BF.DexThumb`). It is NOT loaded in index.html yet. It needs a "My parts | Beydex" toggle in the Parts tab (`#dexRoot`) plus CSS.
2. **Rest of E2:**
   - Forge Shards (duplicates → shards → craft or level a specific catalog part).
   - Evolutions (max-level part → new look + stronger signature).
   - Masteries (wins per part → titles and frames).
   - A visuals/animation pass.
   - Studio pages to tune all of it.
   - Also: add the pack `system` field to the Studio pack editor, and add a catalog editor to Studio.
3. **E3:** finisher replays, in-battle bounties, ghost battles, steal-a-part, weekly leagues, showcase likes.
4. **E4:** monthly seasons + free pass, event modes, weekly tournaments, quest chains + mystery chest. The rank overhaul from STUDIO_DESIGN.md merges in here: metal tiers + RP, placements, 3D emblems, rank-up cinematic, Lv100 + prestige.
5. **Studio wave 2 items:** events, redeem codes, mass gifts, news/pop-ups, balance sliders + simulator, testing tools, uploads, feedback, planning board, anti-cheat, alerts.

## Testing approach
- Headless Playwright with swiftshader, from scripts in the scratchpad.
- Fake the profile by stubbing `BF.Account.profile`/`update` and `firebase.firestore.FieldValue` (see the e1.js pattern).
- Studio: `studio/index.html?demo` runs on in-memory fake Firestore data.
