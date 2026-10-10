# Direction: Recommendation Engine + Bedrock AI Agent

## Context

You think both features are still to be built. **Most of both is already in the repo** from earlier sessions. What's missing is mainly:
- **location-based inputs**, because your real dataset only has addresses;
- **proof that they work** (the evaluation your report promises);
- **real AWS Bedrock access**;
- **actually sending the summary to the manager**.

Your job from here is less "build from zero" and more **adapt, test and justify** what exists.

---

## Feature 1: Product Recommendation Engine

### What already exists

| Piece | Where | What it does |
|---|---|---|
| Gower distance | [GowerDistance.php](app/Services/Recommendation/GowerDistance.php) | Compares two outlets on mixed number and category fields, with weights. **Skips any field that's empty on either outlet** (line 105), so outlets with only an address can still be compared. |
| KNN recommender | [KnnRecommender.php](app/Services/Recommendation/KnnRecommender.php) | Finds the k=5 most similar outlets and lists products they buy that this outlet doesn't ("gap") or buys too little of ("top up"), with a quantity scaled to the outlet's size |
| Service + storage | [RecommendationService.php](app/Services/Recommendation/RecommendationService.php) | Builds outlet profiles from orders, refreshes nightly (`recommendation:refresh`), stores results in `outlet_recommendations` |
| "Why these?" | same file, `explain()` | Claude writes the explanation **from the engine's numbers only**, and a template is used when Bedrock is off |
| Ask Ronda chat | [OutletAssistantService.php](app/Services/Ai/OutletAssistantService.php), `Leads/Partials/AskRonda.tsx` | Rep chats with Claude about one outlet, grounded in that outlet's facts |
| UI | Outlet page "Suggested orders" tab, rep dashboard panel | Shown to reps |
| Product catalogue | `resources/js/Pages/Products/*` | Admin manages products (future enhancement: link to the company's product database) |
| Outlet location | `leads.latitude/longitude`, `ife_area_id` | Columns already exist, and the mobile app already captures a GPS pin |

### Your idea: "Rep gives Ronda the location, Ronda suggests products for that area's demographics"

The idea is good: location is the only signal your real data has. **What must change is where the demographics come from.**

- ❌ **Claude guesses the demographics from the address.** It might say "Bangsar is affluent, young professionals, so oat milk", but that's from memory: unverifiable, possibly out of date, and likely to stereotype. This is exactly the hallucination problem your 2.2.4 argues against, and you can't measure it.
- ✅ **The backend looks up real demographics, and Claude only explains them.** Malaysia publishes these openly:
  - **Household income by district** (mean and median, HIES 2019–2022): [OpenDOSM hh_income_district](https://open.dosm.gov.my/data-catalogue/hh_income_district)
  - **Census 2020 by district** (population, age, ethnic mix, etc.): [OpenDOSM Kawasanku](https://open.dosm.gov.my/dashboard/kawasanku/Selangor/district/Gombak)
  - *Optional:* **what's around the outlet** (offices, schools, malls, tourist spots within ~500 m), from OpenStreetMap. This gives you an "area type" such as office, residential, campus or tourist.

**How it flows:**
1. The rep enters the address or drops a GPS pin.
2. The backend geocodes it once, then stores the coordinates and the district.
3. The backend attaches the district's published figures.
4. **KNN** finds outlets that are near it or have a similar area profile, and lists what they buy.
5. **Claude** writes the "why", with every figure cited. For example: *"Petaling district, median household income RM X. 4 of the 5 most similar outlets nearby buy Oat Milk."*

Your UX is preserved, and the report's "model writes, backend decides" principle still holds.

### New feature set (what Gower compares)

| Feature | Type | Source | Always available? |
|---|---|---|---|
| Distance between outlets (km) | numeric | geocoded address | ✅ real data |
| District | categorical | geocoded address | ✅ real data |
| District median household income | numeric | OpenDOSM HIES | ✅ real data |
| District population density / age mix | numeric | OpenDOSM census | ✅ real data |
| Area type (office / residential / tourist / campus) | categorical | OpenStreetMap (optional) | ✅ real data |
| Monthly spend | numeric | order history | ✅ for existing customers |
| Outlet type, segment, seats | categorical / numeric | **rep fills in on visit** | ❌ grows over time |

The strong design story for your report: **Gower ignores empty fields.** So the engine works from day one on location alone, and gets better as reps fill in outlet type, segment and seats. That is how it handles both sparse profiles and cold start.

Also consider **halal status as a filter** (not a similarity factor): a halal outlet should never be shown a non-halal product.

### Should the LLM do the recommending instead?

**No: KNN selects and Claude explains.** But don't just argue it. **Test your original idea as a comparison.**
- Give Claude the address and the catalogue (SKUs only, so it can't invent products).
- Ask for its top 5.
- Score it with the same precision/recall as the others.

If it loses to KNN, your design is proven with numbers. If it wins, that's an interesting finding too. Either way your original idea becomes part of the research, not a discarded one.

### What's missing (your actual work)

**A. Confirm what the real dataset contains.** Precision and recall need to know **which outlet bought which product** (ideally with dates and quantities). If the dataset is *only* addresses with no orders, there's nothing to score against. Check this first.

**B. Location features.**
1. Geocode every address once (Google Geocoding API, or OpenStreetMap Nominatim, which is free but slower and weaker on Malaysian addresses).
2. Store the coordinates and the district on the outlet.
3. Load the OpenDOSM district tables.
4. Add the new fields to `RecommendationService::FEATURES` and `outletProfiles()`.

Distance in km needs a small addition to `GowerDistance`: a "geo" partial = km apart / largest km apart.

**C. The evaluation. This is the biggest gap.** Nothing computes Precision@k or Recall@k yet.
- **Write the procedure down first** (Zhao et al.: fix it before seeing results).
- **Cold start:** for each real customer, hide **all** its purchases, so the engine sees only its location. Can it find what the outlet really buys? This is exactly your "new outlet, rep only knows the address" scenario.
- **Warm:** hide ~30–50% of each outlet's products and try to find them.
- Compare on the same hidden sets:
  - **KNN (location features)**
  - **Popularity** (top sellers the outlet doesn't already buy)
  - **Random**
  - **LLM from address** (optional, see above)
- Report **P@k and R@k at k = 3, 5, 10**, averaged over outlets and several random seeds.
- *Optional:* compare feature sets (distance only vs + district income vs + area type). That shows **which location factors actually matter**, which answers your "what factors influence F&B products" question with evidence.
- Build it as an Artisan command (e.g. `recommendation:evaluate`) that prints the table. `KnnRecommender` is plain PHP, so it's easy to call in a loop.

**D. Keep the demo data for demos only.** [DemoDataSeeder.php](database/seeders/DemoDataSeeder.php) has 24 outlets and its baskets are decided by outlet type, so it's fine to show the UI but not to evaluate on. Your real dataset replaces it for the evaluation, which makes the result much stronger.

**E. Data handling.** The real data is the company's: anonymise outlet names and keep owner contacts out of anything sent to Claude (PDPA 2010). The current AI code already excludes contact details from what it sends to Claude.

**F. Make the report and code agree.** Update 2.2.3 to:
- describe location and published-demographic features (and cite DOSM);
- say that missing fields are skipped;
- mention top ups as well as gaps.

---

## Feature 2: Bedrock AI Agent (manager summary of at-risk tasks)

### What already exists

| Piece | Where | What it does |
|---|---|---|
| At-risk rules | [TaskRisk.php](app/Services/TaskRisk.php) | **Overdue** = past due. **At risk** = due within 24 h, or 75% of its time used. Plain rules, no AI. |
| Hourly check | [CheckTaskRisk.php](app/Console/Commands/CheckTaskRisk.php) (`tasks:check-risk`) | Flags newly at-risk or overdue tasks and **pushes a template alert to managers** (Firebase) |
| Morning Round-Up | [DailyDigestService.php](app/Services/DailyDigestService.php) (`digest:daily`, 07:00) | Backend counts tasks, forms, visits and orders, then **Claude writes the brief from those figures only**. A template is used if Bedrock is off. |
| Bedrock client | [ClaudeClient.php](app/Services/Ai/ClaudeClient.php) | Official Anthropic SDK, Bedrock client |
| Dashboard | `Dashboard/Partials/MorningRoundUp.tsx` | Shows the brief |

### "Pipeline or real agent: which is better?" My recommendation: **keep the pipeline**

- Your report's core argument is that **the backend decides what's true and the model only writes**. A scheduled pipeline is exactly that. A free-roaming agent that picks its own lookups works against your own argument.
- A pipeline is **predictable and testable**: the same figures go in and a checkable summary comes out. An agent is harder to test and costs more per run.
- The weak spot is the **word**, not the design. In the report, call it an **AI workflow / AI assistant**: the model runs inside fixed steps your code controls. Anthropic's "Building effective agents" article makes this workflow-vs-agent distinction, and you can cite it. Then explain *why* you chose a workflow: reliability, cost, and the hallucination risk.
- **If your supervisor insists on "agent":** add one bounded step. For each flagged task, Claude may call a few **read-only** lookups (task history, rep's workload, last visit) to explain *why* it's at risk. The rules still decide *what* is at risk. Treat this as a stretch goal.
- **Action:** ask your supervisor one line: *"Is an LLM in a fixed scheduled workflow acceptable as the 'AI agent', or do you expect tool use?"*

### What's missing (your actual work)

**A. "Send to the manager."** The AI brief only appears **on the dashboard** today. The hourly push is a template, not AI.
- Recommended split:
  - the **7:00 AI Round-Up** gets *sent* to managers (push with a short version, and/or email);
  - the **hourly alert** stays template, because it's fast, cheap and doesn't need AI.
- `CheckTaskRisk::notifyManagers()` already shows the Firebase pattern.

**B. Real Bedrock access.** Everything currently runs on the template fallback. You need:
1. an AWS account with **Claude model access enabled in Bedrock**;
2. keys in `.env`;
3. a check that the model ID matches the Bedrock console.

A smaller model (Haiku or Sonnet) is enough for summarising, and that fits your Béchard & Marquez Ayala citation. The config currently defaults to an Opus ID.

**C. Evaluate it.**
- **Faithfulness (automatic):** generate briefs over many days of data. Check that every number and name in each brief appears in the facts it was given. Report the % of briefs with zero unsupported claims.
- **Usefulness (UAT):** testers find the at-risk tasks **with vs without** the brief (time taken, plus a short rating questionnaire).

---

## Scope warning

The rep assistant (Visit brief, follow-up drafts, pitch tips) goes beyond your two features. **Ask Ronda** is worth keeping in scope, because it's where the rep "asks about this location". Mention the rest as extra features and don't test them in depth.

## Suggested order of work

1. **Check the real dataset:** does it have orders (outlet → product, quantity, date)? This decides whether the evaluation is possible on real data.
2. **Understand the built code.** Read the files in the tables above until you can explain Gower, KNN, support, top-up and the template fallback in a viva.
3. **Ask your supervisor** the "agent" question.
4. **Write the evaluation procedure** into the methodology chapter *before* running anything.
5. **Add location features** (geocode, district, OpenDOSM figures), then **build and run the evaluation** (KNN vs popularity vs random, and optionally LLM-from-address).
6. **Make Ronda's "why" cite the area facts** (district income, nearby outlets).
7. **Set up Bedrock**, then add sending the morning brief to managers.
8. **Faithfulness check + UAT** for the AI side.
9. **Update the report** to match (location features, DOSM data, "AI workflow" wording, halal filter if added).

## How to see what exists today

```bash
php artisan db:seed --class=DemoDataSeeder
```
```bash
php artisan recommendation:refresh
```
```bash
php artisan digest:daily
```
```bash
php artisan tasks:check-risk --dry-run
```

Then log in as a seeded rep and open a customer outlet's **Suggested orders** tab. Log in as the manager to see the **Morning Round-Up**.
