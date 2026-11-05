# Recommendation engine: evaluation protocol

**Status:** approved 2026-11-05, before any evaluation result exists.
**Version:** 1, written 2026-11-04.

This file fixes how the engine is judged before anyone sees how it scores (Zhao et al., as cited in the report). Once approved, it is not edited silently. Any later change goes in [Deviations](#13-deviations) with its date and reason.

## 1. The question

For an outlet on a given date, can the engine suggest products the outlet will newly buy in the next 2 months, better than simple baselines?

The engine under test is the hybrid:

- **Stage 1, area match:** used for outlets with little or no order history.
- **Stage 2, similar outlets:** KNN with Gower distance, used once an outlet has orders in enough months.

## 2. The dataset

The data is generated. It is not company data, and every result must be read with that in mind (section 12).

| Item | Value |
|---|---|
| Products | 80, including about 10% launched during the year and about 5% retired during it |
| Outlets | 300, across Klang Valley districts, with some profile fields left blank on purpose |
| Period | 12 months, 2025-11-01 to 2026-10-31 |
| Primary settings | `signal` 0.75, `tag_fidelity` 0.75 |

**How buying is generated.** Each outlet has a hidden archetype and a hidden personal taste, and each product has hidden traits. A buying decision blends two things:

- **Structured affinity:** archetype and taste against product traits.
- **General popularity:** how widely bought the product is, plus noise.

`signal` is the share given to structured affinity. At 0, buying depends only on popularity and noise.

**Keeping the dataset from answering its own test.** If the tags the engine reads were the same thing that drives buying, Stage 1 would score well for no real reason. So:

1. Observable tags are noisy copies of the hidden traits. `tag_fidelity` is the chance a tag is copied correctly instead of being replaced at random.
2. Buying is computed from hidden traits and never reads the observable tags.
3. Hidden values and the true affinity table go in a sidecar file that no dataset loader reads.
4. Outlet and product IDs are shuffled, so an ID says nothing about archetype or popularity.

**Shape needed for this test:**

- Outlets start buying in different months, with a lead record before their first order. This creates the cold group.
- Outlets take up new products over time. This creates targets for the warm group.

**Freeze.** Generator parameters may be adjusted only until phase 3 ends, to meet the minimums in section 4. No engine has been scored at that point. After that, only bug fixes are allowed, each recorded in section 13.

## 3. Time windows

| Use | Cut date | Profile window (180 days to the cut) | Target window |
|---|---|---|---|
| Validation | 2026-06-30 | 2026-01-01 to 2026-06-30 | 2026-07-01 to 2026-08-31 |
| Final test | 2026-08-31 | 2026-03-04 to 2026-08-31 | 2026-09-01 to 2026-10-31 |

The first two months are warm-up and are in neither profile window.

## 4. The test

- **What the engine sees:** only what was known at the cut (section 5).
- **Target:** products the outlet bought in the target window and did not buy in the profile window. This matches the engine's own meaning of a "gap".
- **Order month:** a calendar month with at least one confirmed order in the profile window.

| Group | Order months at the cut | Use |
|---|---|---|
| Cold | 0 | Win rule |
| Thin | Exactly 1 | Reported separately; informs the switch rule only |
| Warm | 2 or more | Win rule |

Only outlets with at least one target are scored, and the number left out is reported.

**Minimums per seed, at each cut:** 30 scored cold outlets and 100 scored warm outlets. Phase 3 is not finished until these are met.

## 5. No-leak rules

At a cut date:

- Orders after the cut are invisible.
- Monthly spend, the bought-products feature and order months come from the profile window only.
- Candidate products must exist and be active at the cut. Products launched later are neither suggestions nor targets.
- Only outlets whose lead record exists by the cut are in the pool. Only those with orders in the profile window can be neighbours.
- Only the Oracle (section 7) may read the truth sidecar.

Profile data such as tags and area type is treated as unchanged over the year. This is a simplification, and the report states it.

## 6. Metrics

Only new-product suggestions are scored, in rank order. Top-ups can't be hits by definition, so they are ranked separately in production as well.

| Metric | Role | Definition |
|---|---|---|
| **Precision@5** | **Main metric** | Hits in the top 5, always divided by 5. A shorter list counts its empty places as misses. |
| Precision@k | Supporting | Same, at k = 3 and 10 |
| Recall@k | Supporting | Hits in the top k, divided by the outlet's targets, at k = 3, 5 and 10 |
| Coverage | Supporting | Share of scored outlets with at least one suggestion, plus mean list length |
| N | Supporting | Outlets scored and left out, per group |

Metrics are averaged over outlets within a seed, then reported as mean and standard deviation across seeds, per group. Cold and warm are never pooled into one headline figure.

## 7. Baselines and ceilings

All lists exclude products the outlet bought in the profile window.

| Name | How it ranks |
|---|---|
| **Popularity** | Most distinct outlets buying in the profile window |
| **Type-only** | The same, among outlets of the same business type. Falls back to Popularity when the type is blank or the list runs short. |
| **Random** | Exact expected score, calculated rather than sampled |
| **Oracle** | Ranks by the generator's true affinity. This is the most a model could do without seeing future chance. |
| **Perfect list** | `min(5, targets) / 5` per outlet. Shows the most Precision@5 can reach when outlets have few targets. |

## 8. Choosing the settings ("training")

KNN stores no learned weights, so training here means selecting settings on data. The report says so plainly.

- **Data:** validation windows of development seeds 101, 102 and 103.
- **Selection rule:** find the best mean Precision@5, then consider every combination within one standard error of it. Choose the one with the fewest changes from the current defaults. If tied, choose the smaller k.
- **Defaults:** k 5, min_support 0.3, `current` weights, switch at 2 months.
- **Publication:** the whole grid is published, not just the winner.

| Tuned on | Setting | Values |
|---|---|---|
| Warm | k | 3, 5, 10, 20 |
| Warm | min_support | 0.1, 0.2, 0.3 |
| Warm | Stage 2 weights | `current` (existing weights, bought-products at 1), `behaviour` (bought-products at 3), `profile` (bought-products at 0) |
| Cold | Stage 1 weights (type, price tier, area) | `equal` (1, 1, 1), `type` (2, 1, 1), `area` (1, 1, 2) |
| Thin and warm, last | Switch at order months | 1, 2, 3 |

The `profile` weights show directly whether the new bought-products feature helps.

## 9. Final test and win rule

- **Data:** final test windows of fresh seeds 201 to 205, which no earlier phase touches.
- **Frozen:** engine code, generator and selected settings.
- **Run once.** Any re-run is recorded in `evaluation/results/run-log.csv` with its reason, and every run is reported.

**Win rule, at the primary settings, for each of cold and warm:**

1. The comparison is against whichever of Popularity and Type-only has the higher mean Precision@5 in that group.
2. The engine wins the group if the 95% confidence interval of the paired per-seed difference in Precision@5 is entirely above zero (t distribution, 5 seeds).
3. Otherwise the result is "no demonstrated win".

The two groups are reported separately, and a mixed result is stated as mixed. **If the engine loses to a baseline, that is the finding.** It is not tuned further on these seeds.

**Sensitivity:** the same frozen settings are run across, one setting at a time:

- `signal` 0, 0.25, 0.5, 0.75 and 1, at `tag_fidelity` 0.75;
- `tag_fidelity` 0, 0.25, 0.5, 0.75 and 1, at `signal` 0.75.

The primary settings of 0.75 are assumptions with no measurement behind them, so the report shows these curves and not only the single figure.

## 10. Sanity suite

A broken evaluator looks just like a good engine, so no score is used until these pass. Checks that need Stage 1 start once phase 5 is built.

| Check | Expected | If it fails |
|---|---|---|
| Scramble everything after the cut | Recommendations byte-identical | Future data is leaking |
| Compare with the Oracle | No method above it by more than one standard error | Something is reading the answer |
| Compare with the perfect list | No method above it, ever | The metric is wrong |
| Scramble product tags | Stage 1 falls, Stage 2 unchanged | Tags are not doing what is claimed |
| Permute targets across outlets | The lift collapses | The score is not about the outlet |
| Shuffle IDs | Results unchanged | IDs or tie-breaks carry signal |
| Hand-computed fixture | Exact match | The metric code is wrong |
| `signal` 0 | The engine does not beat Popularity | The evaluator flatters the engine |

## 11. Expert check

This is the only evidence from outside the generated data.

- **Raters:** two people with F&B supply knowledge, named before the sheet is generated. Rater 1: to be confirmed. Rater 2: to be confirmed.
- **Ethics:** the supervisor confirms whether approval is needed before anyone rates.
- **Sample:** 20 outlets from test seed 201, 10 cold and 10 warm, picked with sample seed 301.
- **Sheet:** the combined top-5 lists of the engine, Popularity and Type-only, shuffled, with no sign of which method suggested what. Raters see the outlet profile and product, and mark each as "suits" or "doesn't suit". The answer key is a separate file.
- **Reported:** Precision@5 per method and rater, relative recall, and Cohen's kappa between the raters.

## 12. What the results can claim

**Can claim:** on generated data with stated assumptions, the engine recovers planted patterns better than the baselines, or it does not.

**Cannot claim:** how real outlets would respond. No figure from generated data supports that.

**The report must disclose:**

- the data is synthetic, along with the generator parameters;
- the same author wrote the tags and the generated world;
- nearby places are seeded and not looked up live;
- "training" means selecting settings for a lazy learner;
- feedback buttons demonstrate the mechanism, since no real reps used them.

## 13. Deviations

None yet. Format: date, what changed, why, and whether any results had been seen at the time.
