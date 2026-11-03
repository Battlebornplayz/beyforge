# BeyForge gameplay overhaul: Aiden's 40 answers (2026-11-02)

Builds on `docs/V5_DESIGN.md`. Where they disagree, this doc wins.
**Everything here must be tunable from BeyForge Studio, with no code.**

## Direction
- **Biggest problems today (Q1):** repetitive, not enough impact, not enough control. He wants better hit animations (his example: the parry in ULTRAKILL).
- **Feel (Q2):** a strategy game first. Spectacle supports the strategy.
- **Match length (Q4):** keep the 2 to 3 minute target.

## Control and hits
- **Control (Q3, Q5):** strong nudges. Tap to lean, flick for a big dash. The Bey still moves on its own.
- **Limit (Q6):** nudges spend an energy meter.
- **Parry (Q7):** a real timed tap as a hit lands: freeze frame, flash, no damage, hit sent back. Every big hit also gets the impact effects.
- **Hit effects (Q8):** all of them: freeze frames, slow-mo + zoom, sparks + shockwaves, screen shake + sound, scaled to the hit.

## Launch
- **Launch preview (Q1, Q9):** predicted path, landing spot and how the shot changes stats. No ghost Bey.
- **Secrecy (Q10):** both players choose in secret, then reveal.
- **Launch input (Q11):** a real ripcord pull: drag back and yank. Speed and straightness set the power. Replaces the timing meter.
- **Penalty (Q12):** moderate, and a really bad launch can misfire (wobble or stumble).

## Stadium, camera and physics
- **Stadium (Q9, Q13):** bigger, with more camera movement. He wants it to feel like the show.
- **Camera (Q14):** several modes to pick from in Settings.
- **Physics (Q15):** one model with live Studio sliders for speed and knockback.
- **Show clearly (Q16):** wobble + tilt, rail rides, spin matchups, parts flying on bursts, and move animations.

## Winning
- **Scoring (Q17):** depends on the mode.
- **Between rounds (Q18):** depends on the mode.
- **Comebacks (Q19):** bigger late moves, clutch bonuses, and rewards for using moves well.
- **Stadium events (Q20):** stadium damage and live hazards, but ranked stays clean with nothing random.

## Moves and energy
- **Limits (Q21):** shared meter plus a cooldown per move.
- **Charging (Q22):** depends on the Bey's type. His example: Stamina gains more over time.
- **Ultimate (Q23):** yes, a full cinematic.
- **Move visuals (Q24):** element effects, plus a spirit creature on ultimates. These must be original designs, not copied from the show.

## Builds
- **Type matchups (Q25):** strength set by a Studio slider.
- **Elements (Q26):** go deeper (combos and stadium interactions) and simplify (fewer elements). **Which ones stay is still open.**
- **Grind vs skill (Q27):** depends on the mode. Ranked evens stats out; adventure and casual let grind shine.
- **Extra depth (Q28):** part synergies, weight + balance tradeoffs, and scouting + countering an opponent.

## Competitive
- **Online parry (Q29):** build it, test with his friend, then tune.
- **Online ultimates (Q30):** a short cutscene on both screens, about 2 seconds.
- **Ranked (Q31):** 3-Bey deck, best of 3, hidden picks, stats evened out, clean stadiums.
- **Rules (Q32):** auto-balance alerts in Studio, a part ban list, a leaving penalty. He did not pick anti-stall.

## Variety and modes
- **Variety (Q33):** Bey personalities, random round twists (casual), more stadium types, bigger move variety.
- **CPU (Q34):** normal CPUs use the full kit, bosses have their own gimmicks, Expert adapts to your habits.
- **New modes (Q35):** free-for-all, 2v2 team battle, practice arena, story campaign.
- **Teaching (Q36):** one interactive tutorial fight.

## Audio and Studio
- **Audio (Q37):** heavy metal hits and reactive music. No announcer or blader voices.
- **Studio (Q38):** physics + feel, moves + energy, modes + rules, and a battle simulator.

## Rollout
- **Waves (Q39).** Each wave ships, then Aiden tests it.
- **Priority (Q40):** the overhaul comes before Forge Shards, Evolutions and Masteries.

## Proposed waves (not yet approved by Aiden)
1. **Feel:** hit effects, metal audio, camera modes, bigger stadium, wobble, rail rides, flying parts, launch preview, ripcord, misfires, practice arena, Studio feel sliders.
2. **Control:** energy meter with per-type charging, tap + flick, timed parry, move cooldowns, comeback rules, new move animations.
3. **Depth:** element rework, type slider, synergies, weight tradeoffs, Bey personalities, round twists, stadium damage, hazards, new stadium types, more moves.
4. **Spectacle + AI:** cinematic ultimates, spirit creatures, reactive music, full CPU upgrade.
5. **Competitive + modes:** per-mode scoring, 3-Bey ranked, scouting, ban list, balance alerts, leaving penalty, simulator, free-for-all, 2v2, interactive tutorial, story campaign.

## Risks to raise with Aiden
- **Show-size stadium:** decide if this means a bigger camera and art feel, or a physically larger arena. A larger arena changes all battle balance and may break the link to official stadium sizes.
- **Spirit creatures:** there are no artists or 3D models, so they'd be built from code. Test one early before promising all of them.
- **Online cheating:** online matches run on one player's device, and the game uses the free Firebase plan with no game server. Leaving penalties and ranked results can be cheated until a server exists.
- **Parry fairness:** the player hosting the match has less lag, which may make parries unfair.
- **Free-for-all and 2v2:** check how well player-to-player online holds up with 4 players.
- **Story campaign:** by far the largest item, and needs its own plan.

## Still open from the paused E2 questions
- **Decided:** one Forge Shard currency.
- **Not answered:** how duplicates turn into shards, which evolved look, and how Masteries count wins. Mockups: the "Shards, Evolutions, Masteries" canvas.
