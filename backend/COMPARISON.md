# Random director vs Jev director

Comparison run on 2026-11-14 for DIWhy v0.1.

> **Note:** this run happened before the DIWhy rename. The opening line of the text sent to the model has since been reworded to describe DIWhy. Rerun the harness to confirm the numbers still hold.

## Setup

- **Games:** 30 seeds (1 to 30) per director, so 60 games in total.
- **Player:** a bot that picks a random choice at every event. It uses the same seeds for both directors, so differences come from event selection, not from the player.
- **Random director:** weighted random selection from the eligible events, using each event's `weight(state)`.
- **Jev director:** the local model `alanhuangya/OpenJev-4B` (v0.2, bf16) served on an Apple silicon Mac. For each decision it receives the game state as text and the eligible events as options, answers one `choice` question, and the engine samples the pick from the returned probabilities with the seeded generator. If the model fails, a random fallback picks instead.
- **Engine:** identical in both runs. The engine decides eligibility and applies every consequence. Neither director can change costs or rules.
- **Reproduce:** `VITE_COMPARE=1 VITE_COMPARE_N=30 npx vitest run src/directors/compare.test.ts --disable-console-intercept` (needs the model server running).

## Results

| Metric | Random | Jev |
|---|---|---|
| Mean total cost | $4,716 | $4,062 |
| Mean days | 14.0 | 12.9 |
| Mean final stress | 23.7 | 22.3 |
| Mean unexpected problems | 4.3 | 4.3 |
| Mean events per game | 7.9 | 8.1 |
| Distinct stories | 30/30 | 30/30 |
| Same kind of event twice in a row | 38% | 39% |

### Endings

| Ending | Random | Jev |
|---|---|---|
| Renovation completed | 15 | 21 |
| Budget ran out | 15 | 9 |
| Time limit exceeded | 0 | 0 |
| Stress reached 100 | 0 | 0 |

### Event kinds (director picks only)

The forced opening event and the finale are excluded.

| Kind | Random | Jev |
|---|---|---|
| Problem | 40% | 45% |
| Temptation | 38% | 26% |
| Humor | 21% | 30% |

### How often each event appeared (out of 30 games)

| Event | Kind | Random | Jev |
|---|---|---|---|
| valve-stuck | problem (opening) | 30 | 30 |
| corroded-pipes | problem | 26 | 28 |
| hidden-water-damage | problem | 10 | 11 |
| outdated-wiring | problem | 23 | 26 |
| contractor-delay | problem | 18 | 21 |
| upgrade-vanity | temptation | 23 | 22 |
| replace-tile | temptation | 21 | 11 |
| heated-floors | temptation | 13 | 1 |
| upgrade-lighting | temptation | 16 | 15 |
| while-were-at-it | humor | 18 | 30 |
| inspiration-photos | humor | 17 | 25 |
| tile-discontinued | humor | 6 | 2 |

### Jev director health

- 192 model decisions across 30 games.
- 0 fallbacks to the random director.
- Mean latency 675 ms per decision.
- Mean top probability 51%. The model was often split between candidates rather than decisive.

## Observations

- **Jev finished more renovations and spent less.** 21 completions against 15, with budget failures down from 15 to 9 and mean cost down by about $650.
- **The savings come from which events it picked.** Jev avoided the expensive temptations. Heated floors ($2,400) appeared once in 30 games against 13 for random, and new tile ($1,800 premium) appeared in 11 games against 21.
- **Jev favored humor events.** "While we're at it" appeared in all 30 games against 18 for random, and the partner photos event in 25 against 17. That is consistent with the question asking for a funnier story, but it also suggests the model may weigh event titles and tone more than the game state.
- **Side effect on the design.** The tile, heated floors and wiring chain almost never fires under Jev, so one of the intended cascades is mostly lost.
- **No pacing difference.** Both directors repeated the same event kind back to back about 38% of the time, and unexpected problems were identical at 4.3.
- **Variety is equal.** Every game was a distinct story under both directors.

## Caveats

- **Small sample.** 30 games per director with a random-clicking bot. The 15 against 9 gap in budget failures could partly be noise. No significance test was run.
- **Bot, not a person.** A human choosing deliberately may interact with the directors differently.
- **Funnier is not measured.** The numbers describe pacing, cost and variety. Whether Jev makes a more entertaining game needs people playing the same seed under both directors.
- **Balance.** Half of the random-director games hit the $5,000 budget, so the budget may be tight regardless of director.
- **Sampling choice.** Jev picks are sampled from its probabilities, not the top answer. A top-answer mode would be more deterministic and likely more repetitive.

## Ideas for next experiments

1. Add a top-answer (argmax) mode and compare variety and repetition.
2. Reword the question to weigh the game state more heavily, then check whether picks follow from it, for example water damage after a flood.
3. Run 100 or more seeds, and add a second bot that always takes the cheapest option to stress risk debt.
4. Have people play seed 42 under both directors and rate which story was funnier.
