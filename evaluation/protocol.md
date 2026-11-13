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

Format: date, what changed, why, and whether any results had been seen at the time. No test seed (201 to 205) had been touched when any of these were made.

**2026-11-06. Two supporting baselines added: `popularity_halal` and `type_only_halal`.** The same rankings with the engine's halal filter. The protocol's baselines have no filter, so part of the engine's lead could come from the filter and not from ranking. These rows show how much. The win rule still uses the baselines as written in section 7. Results seen: today's KNN on the development seeds.

**2026-11-06. One more supporting row on the final test: `knn_before`.** The engine's old feature set (six profile fields, nothing bought) at k 5 and min_support 0.3, to show whether the upgrade helped. Not part of the win rule. It runs on the current `KnnRecommender`, so top-ups no longer take its slots. Results seen: as above.

**2026-11-06. Sanity suite result on today's KNN: "Shuffle IDs" failed.** 10 of 210 outlets scored differently because ties were broken by id. This is what the check is for. The engine now breaks ties by outlet key and SKU, and the check passes on the hybrid. The other checks passed; "Scramble product tags" needs Stage 1 and first ran on the hybrid.

**2026-11-06. Stage 1 ranking variant tried and dropped.** Ranking by match times popularity was tried once on the development seeds (cold P@5 0.281 against 0.291 for match alone). It did not help and was removed. Recorded so the report can say so.

**2026-11-06. Engine values the grid in section 8 does not cover, fixed before tuning:** `min_match` 0.6, `min_compared_share` 0.5, a separate cap of 5 top-ups, `limit` 10. They are not tuned.

**2026-11-06, added after the final test ran. The expert check in section 11 has not run.** The raters are still to be confirmed, and the supervisor has not yet answered on ethics approval. The final test ran first because the code and settings were ready, and its result can't affect the raters, who see no scores. The sheet will use the same frozen settings. Results seen: the final test. The `protocol_hash` in `run-log.csv` is from before this entry was added, and no rule changed.

**2026-11-13. Version 2 added in section 14, after the version 1 final test.** A design review concluded the engine should suggest drinks made from catalogue products, not only single products. Version 2 is a new engine with its own generator, its own fresh seeds (401 to 405) and its own single final test. No version 1 rule changes, and the version 1 result is still reported as it stands. Section 14.8 replaces the sample in section 11, because no rater has seen a sheet yet. Results seen: the version 1 final test. No version 2 score exists.

## 14. Version 2: drink ideas

**Status:** written 2026-11-13, before any version 2 score exists. Approval: pending.

Sections 1 to 12 still apply unless this section says otherwise.

### 14.1 The question

For an outlet on a given date, does adding drink ideas make the new-product suggestions better than the baselines and the frozen version 1 engine? And are the drink ideas themselves better than suggesting the most common drinks?

### 14.2 What version 2 adds

- **Drinks.** The admin enters drinks. Each drink is a recipe made from catalogue products and is tagged with:
  - serve: hot, iced or either;
  - outlet types;
  - customer groups, using the 7 area kinds;
  - price level.
- **Customer groups.** An outlet's groups are the rep's "Main customers" answer when given, otherwise its area types.
- **Drink scoring.**
  - **Eligible drinks:**
    - active, with every ingredient on sale at the cut;
    - halal only, for a halal outlet;
    - not already made, meaning the outlet doesn't already buy every ingredient in the profile window;
    - for an outlet with purchases, no more than `max_missing` ingredients missing.
  - **Score:** a weighted mean of type, customers, price, ease and neighbours, with unknown features skipped.
    - "Ease" is the share of ingredients already bought.
    - "Neighbours" is the share of the k similar outlets that make the drink.
    - The same `min_compared_share` and `min_match` as Stage 1 apply.
  - **Tie-break:** recipe slug.
- **Output.**
  - The top 3 drinks are the drink ideas.
  - In the new-product list, the first `drink_slots` places go to missing drink ingredients, in drink order. The rest is the version 1 list with duplicates removed.
  - Top-ups are unchanged.
  - `drink_slots` 0 gives the version 1 list exactly.

### 14.3 The dataset: generator version 2

- **Catalogue:** the 80 products plus 6: Strawberry Syrup, Peach Syrup, Lychee Syrup, Brown Sugar Syrup, Tapioca Pearls and Jasmine Green Tea Leaves.
- **Drinks:** the 36 drinks in `database/data/recipes.json`.
  - Their written groups, outlet types and price levels are the world's hidden truth.
  - Each drink also gets a hidden style vector.
  - The tags the engine reads are noisy copies, made with `tag_fidelity` the same way as product tags.
  - Ingredients are read as written.
- **Buying.**
  - At each adoption, with probability `menu_share` the outlet adopts a drink instead of a single product. It then adopts every ingredient of that drink it doesn't already have.
  - Drinks are drawn by drink affinity, built like product affinity: `signal` blends structured fit with popularity plus noise.
  - Structured fit uses the version 1 shares: type 0.35, price 0.20, customers 0.15, taste 0.30.
  - A halal outlet never adopts a drink with a non-halal ingredient.
  - The first order holds 1 to 3 drinks, filled with single products up to the version 1 basket size.
- **Main customers:** left blank for every generated outlet, so the test doesn't depend on an invented answer rate.
- **Primary settings:** `signal` 0.75, `tag_fidelity` 0.75, `menu_share` 0.5. All three are guesses with no measurement behind them.
- **Version 1 datasets are unchanged** and reproduce byte for byte.
- **Freeze:** generator version 2 parameters may change only until it meets the section 4 minimums, before any version 2 score. After that, only logged bug fixes.

### 14.4 The test

- **Unchanged:** windows, groups, targets, minimums and metrics (sections 3 to 6). The main metric is still Precision@5 on the new-product list.
- **Supporting drink metrics,** on the same scored outlets:
  - **Drink hit:** a suggested drink whose every missing ingredient the outlet newly buys in the target window. "Missing" means not bought in the profile window.
  - **Partial drink hit:** at least one missing ingredient newly bought.
  - **Drink hit@3:** hits in the top 3 drinks, always divided by 3. An outlet with fewer drinks counts the empty places as misses.

### 14.5 Baselines

All of section 7, plus:

| Name | How it ranks |
|---|---|
| **Version 1, frozen** | The version 1 engine with the settings used in its final test |
| **Popular drinks** | Eligible drinks, under the same rules as the engine, ranked by how many outlets make them in the profile window |
| **Drink Oracle** | Eligible drinks ranked by the generator's true drink affinity |

### 14.6 Choosing the settings

- **Data:** validation windows of development seeds 101, 102 and 103, regenerated with generator version 2.
- **Fixed:** the version 1 settings (k, min_support, Stage 1 and Stage 2 weights, switch) stay as selected for version 1. They are not re-tuned.
- **Cold outlets (no purchases):**
  1. The drink weight set is chosen on cold Drink hit@3.
  2. Then `drink_slots_cold` is chosen on cold Precision@5.
- **Outlets with purchases (thin and warm):**
  1. The drink weight set and `max_missing` are chosen on warm Drink hit@3.
  2. Then `drink_slots_warm` is chosen on warm Precision@5.
- **Selection rule:** the section 8 rule. Best mean, then everything within one standard error, then the fewest changes from the defaults, then the smaller `drink_slots`.
- **Defaults:** weight set `equal`, `max_missing` 2, `drink_slots` 0.
- **Publication:** the whole grid is published.

| Setting | Values |
|---|---|
| Drink weight set | `equal` (all features 1), `customers` (customers 2), `neighbours` (neighbours 2) |
| `max_missing` | 1, 2 |
| `drink_slots_cold`, `drink_slots_warm` | 0, 2, 3, 5 |

### 14.7 Final test and win rule

- **Data:** final test windows of fresh seeds 401 to 405, made with generator version 2 at the primary settings. No earlier phase touches them.
- **Frozen:** engine code, generator version 2 and the selected settings.
- **Run once.** Every run is logged in `evaluation/results/run-log.csv` with its reason.

**Win rule, for each of cold and warm:**

1. The comparison is against whichever of Popularity, Type-only and Version 1 frozen has the highest mean Precision@5 in that group.
2. Version 2 wins the group if the 95% confidence interval of the paired per-seed difference is entirely above zero (t distribution, 5 seeds).
3. Otherwise the result is "no demonstrated win".
4. If the selected `drink_slots` is 0 for a group, version 2's list there is version 1's. That is reported as "drink ideas leave the product list unchanged", not as a win or a loss.

**Drink ideas** are compared with Popular drinks on Drink hit@3, with the same paired interval. This is reported as supporting evidence.

**Sensitivity:** the frozen settings are run across, one setting at a time:

- `menu_share` 0, 0.25, 0.5, 0.75 and 1;
- `tag_fidelity` 0, 0.25, 0.5, 0.75 and 1;
- `signal` 0, 0.25, 0.5, 0.75 and 1.

The settings not being swept stay at their primary values.

### 14.8 Expert check (replaces the sample in section 11)

- **Sample:** 20 outlets from final test seed 401, 10 cold and 10 warm, picked with sample seed 301.
- **Sheet, two blocks:**
  1. **Products:** the combined top-5 lists of Version 2, Version 1 frozen, Popularity and Type-only.
  2. **Drinks:** the combined top-3 drinks of Version 2 and Popular drinks.
  
  Both blocks are shuffled and show no method. Raters mark each item "suits" or "doesn't suit".
- **Unchanged:** raters, ethics and the separate answer key, as in section 11.
- **Reported:** Precision@5 and drink precision@3 per method and rater, plus Cohen's kappa.

### 14.9 Sanity suite additions

All checks in section 10 run on version 2. These are added:

| Check | Expected | If it fails |
|---|---|---|
| Scramble drink tags | Drink hit@3 falls | Drink tags are not doing what is claimed |
| `menu_share` 0 | Version 2 is not above Version 1 frozen by more than one standard error | The evaluator flatters drink ideas |
| `drink_slots` 0 | Product lists byte-identical to Version 1 frozen | The merge changes what it shouldn't |
| Shuffle recipe IDs | Results unchanged | IDs or tie-breaks carry signal |
| Compare with the Drink Oracle | No method above it by more than one standard error | Something is reading the answer |

### 14.10 What the results can claim

Section 12 applies. The report must also disclose:

- the same author wrote the drink list, its tags, the pack sizes and the generated world that decides who makes each drink;
- `menu_share`, how much buying follows drinks, is a guess, and the `menu_share` curve is shown, not only one figure;
- the "Main customers" answer is not in the generated data, so the test doesn't measure it.
