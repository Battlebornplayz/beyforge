# BeyForge Studio — owner dashboard (design answers, 2026-11-02)

Goal: an owner admin dashboard where the owner, with **no coding experience**, can manage and **add** anything in the game.

## Dashboard (30)
1. **Where:** its own desktop .exe (BeyForge Studio). Shell loads the live Studio page so most updates are instant.
2. **Access:** owner + staff by rank.
3. **Adding things:** a mix: step-by-step wizards for big content, quick forms for small edits, drag-and-drop where it fits.
4. **Before publishing:** pick any combination: live 3D preview, test it in-game privately, drafts, scheduled go-live.
5–6. **Creatable content:** parts, packs & crates, cosmetics, moves (incl. signatures), events & seasons, achievements & missions, bosses/gyms/raids/tower, stadiums & terrains.
7. **Uploads:** images, sounds, 3D models (STL/GLB). On the free plan they are stored compressed inside the database (size-limited); full uploads once Blaze is on.
8. **AI helper:** none.
9. **Home stats:** players, economy, packs & drops, battles & balance, plus the game analytics a game dev needs (retention, funnels, session length, feature usage, errors).
10. **Players:** profiles & inventory, give & take (incl. IVs), moderation, activity logs.
11. **Mass rewards:** everyone, filters, redeem codes, one-click compensation.
12. **Balance:** global sliders, per-part/move/element tweaks, battle simulator, auto patch notes.
13. **Publishing:** instant, scheduled (with end date), staff review/approval, slow rollout (% of players).
14. **Safety:** undo/history, audit log, type-to-confirm big actions, auto backups.
15. **Switches:** maintenance mode, feature toggles, force update, reward multipliers.
16. **Player news:** in-game news cards, pop-up banners, inbox messages.
17. **Look:** clean pro dashboard.
18. **Layout:** modeled on real dev tools (Firebase / Supabase / Vercel console style: left nav, top bar, command search).
19. **Alerts:** weird economy, errors, milestones, reports.
20. **Anti-cheat:** flag suspicious, compare history, wipe & restore, shadow ban.
21. **Server:** free now, Blaze later. Built to work free; server extras switch on when upgraded.
22. **Testing:** test account, pack simulator, economy sim, view as player.
23. **Money:** plan for real-money gems and reward ads later (not now).
24. **Exports:** charts (no spreadsheets).
25. **Feedback:** bug reports, suggestions with votes, polls, ratings.
26. **Planning:** to-do board, content calendar, release notes.
27. **Exe updates:** ask first.
28. **Staff permissions:** preset roles that can be customized with per-section view/edit checkboxes.
29. **Sign in:** same BeyForge account.
30. **Rollout:** everything is planned up front and shipped in waves.

## Rank overhaul (20)
- **R1 Tiers:** Bronze → Silver → Gold → Platinum → Diamond → Master → Legend, each with I/II/III.
- **R2 Climbing:** points per win (RP bar).
- **R3 Protection:** promo protection, tier floors, win-streak bonus, loss forgiveness vs much higher ranks.
- **R4/R5 Season end:** season badges, tier rewards, then a reset with 5 placement matches.
- **R6 Season length:** set in Studio.
- **R7 Matchmaking:** close ranks only, region preference, bot after a wait if no real player.
- **R8 Modes:** 1v1, 3v3 deck ranked, draft ranked, weekly element cup.
- **R9 Levels:** Lv 100 + prestige.
- **R10 Level perks:** rewards every level, unlocks, cosmetics, blader tree points. All tweakable in Studio.
- **R11 XP sources:** battles, daily first-win bonus, opening packs & crafting.
- **R12 Battle pass:** free track now, premium track later.
- **R13 Staff ranks:** the owner creates them (no fixed built-ins).
- **R14 Staff display:** badge + colored name in game.
- **R15 Owner powers:** anything can be granted through ranks.
- **R16 Rank display:** name tags, player card, leaderboards, VS splash.
- **R17 Rank-up:** full cinematic.
- **R18 Emblems:** 3D spinning emblems.
- **R19 Decay:** set in Studio.
- **R20 Clans:** yes, in a later wave (clan ranks + clan wars).

## Waves
1. **Studio core:** exe shell, sign-in, dev-tool layout, live content pipeline in the game, game switches, players, staff roles, audit/history, analytics v1 + charts, content editors (packs, cosmetics, parts) with 3D preview, drafts/schedule/review/rollout.
2. **More content and tools:** moves, events/seasons, achievements/missions, adventure, stadiums, uploads, codes and mass gifts, news/pop-ups/inbox, balance sliders/simulator/patch notes, testing tools.
3. **Rank overhaul in game:** tiers/RP/placements/seasons/modes, 3D emblems, rank-up cinematic, Lv 100 + prestige, free pass.
4. **Feedback and ops:** bugs/suggestions/polls/ratings, planning board/calendar/release notes, anti-cheat, alerts, backups. Then clans.
