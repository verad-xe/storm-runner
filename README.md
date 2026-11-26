# storm-runner

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/verad-xe/storm-runner/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/verad-xe/storm-runner/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

**Storm Runner** is a 2D canvas flight game: a bush plane crossing a dusk alpine valley — river, town lights, a mountain pass, and a storm front closing in from the east. Thread the glowing target rings, watch the fuel, mind the gusts, and put her down soft on the far strip.

## Missions

- **Ring Run** — thread all eight rings through the pass, then land on the far strip.
- **Supply Drop** — carry a crate to the stranded survey camp and drop it on the marked field (SPACE), then land.
- **Storm Landing** — land on the short strip in gusting crosswind before the fuel runs out.

Fuel drains with throttle, hard landings and terrain hits damage the airframe, and wind gusts push the nose around — every sortie is a set of decisions.

## Controls

- **W / S** — throttle up / down
- **A / D** or **mouse** — pitch (mouse steers toward the pointer)
- **SPACE** — drop the crate (Supply Drop)
- **P** — pause · **R** — restart sortie · **M** — mission select

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. No build step, no network requests — the game is plain static files under `game/`, and all sounds are synthesized with WebAudio.

Screenshots are reproducible: open `?shot=title&seed=1`, `?shot=rings&seed=1`, `?shot=drop&seed=1` or `?shot=land&seed=1` for a fixed frame of the game.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
