# Frozen blind validation v2

Frozen on 2026-09-11 before the author viewed any matching implementation, parser result, recommendation output, prior holdout case, or prior study generator. The author read only the acceptance plan at `reports/match-iteration-2026-09-11/plan.md` for evaluation thresholds. This is an independently agent-authored test set, not human annotations or observations of actual students.

The author owns only `validation-v2.json` and this note. No production code, private user content, secrets, existing holdouts, or old `scripts/match-study/generate.mjs` were inspected. No matching engine was run during authorship or review. Editorial and schema review occurred before freezing; it used only the newly authored text and the stipulated public-evidence labeling rules.

## Frozen artifact and schema

- File: `scripts/match-evaluation/validation-v2.json`
- SHA-256 of exact UTF-8 file bytes, including the final newline: `d5427d91f41b0feab012cb593d432ac7cf13dfa8ba25e2443bcf0e60949d1b93`
- Evaluation instant: `2026-09-11T04:00:00Z` (12:00 Hong Kong time).
- Top-level object: `{"now": "2026-09-11T04:00:00Z", "cases": [...]}`.
- Every case has `id`, `kind`, `a`, `b`, `expected`, and a fixed natural-language `reason`.
- Posts contain `title`, `body`, `category`, and `createdAt`; a small number also have `currentHall` and `targetHall`. Posts deliberately omit `ownerID` and post `id`.
- `other` is the social category; `hall` is housing.

| Kind | Match | Reject | Uncertain | Total |
| --- | ---: | ---: | ---: | ---: |
| hall | 12 | 10 | 8 | 30 |
| goods | 12 | 10 | 8 | 30 |
| study | 12 | 10 | 8 | 30 |
| transport | 12 | 10 | 8 | 30 |
| other | 12 | 10 | 8 | 30 |
| Total | 60 | 50 | 40 | 150 |

The integrity audit passed: 150 unique case IDs, 300 unique complete post texts, required and allowed schema fields, supported category and label values, nonempty strings, and creation times no later than the evaluation instant. No parser or model was involved in those checks. The labels and reasons are now fixed.

## Labeling contract

`match` means public text supplies actionable complementary intent and enough explicit evidence that every stated material constraint fits. A request for peer collaboration can complement another peer request when both actually seek the same session. A taxi-sharing request can complement another sharing request when actual route, date, departure and stated party/capacity constraints fit. Compatible incidental mentions alone do not suffice.

`reject` means public evidence establishes a conflict or explicitly rules out a live complementary intent: wrong item or edition, opposing routes, unavailable date, incompatible venue or language, inadequate seats, hard budget mismatch, withdrawn requested activity, explicitly ineligible exchange, two offers without a requester, or explicit chitchat disclaiming participation.

`uncertain` means a material fact cannot be answered from the public post: actual allocation, UG/PG namespace, term, required room type or eligibility, model, price, transaction role, departure point/direction, party or luggage capacity, exact availability, teaching topic/language/mode, social eligibility, or undecided intent. An ambiguous cancellation does not authorize assuming that a desired offer is live. Uncertain cases should not receive high confidence just because matching keywords occur.

Housing labels treat the authors' explicit allocations and eligibility declarations as fixture facts; they do not purport to establish real university housing policy. Likewise, named game editions, books, venues and capacities are public facts asserted inside these invented scenarios, not independently verified real listings.

## Diversity and scope

All 150 pairs were written individually. No existing corpus was copied, no keyword-replacement generator was used, and no implementation result influenced labels. Deliberately similar hard negatives test whether material distinctions survive strong lexical overlap. These contrasts share ordinary campus topics, so cases are not statistically independent.

There are 35 pairs with at least one post filed under a category different from the case's semantic kind. Of 300 post texts, 118 contain Chinese characters; the corpus combines English, Mandarin, Cantonese and mixed technical English/Chinese. Register includes complete descriptions, short casual notes, colloquial complaints, typos, changing plans and multiple live or withdrawn needs. Script counts measure text presence, not linguistic quality or dialect coverage.

Housing includes UG versus PG namespaces, reciprocal and nonreciprocal routes, full-year and semester allocations, room types, alternative accepted targets and explicit eligibility. Goods includes purchases, sales, free gifts, lending, reciprocal item exchanges, models/editions, budgets, physical size, item condition and pickup constraints. Study includes tutor/learner and peer/peer roles, open group places, course/topic specificity, fees, languages and online/in-person sessions. Transport includes driver/rider and taxi-sharing roles, real origins distinguished from audience tags, direction, exact dates and departure times, group size, taxi occupancy, luggage, fare and scoped trip cancellations. Social includes explicit invitations and join requests, games, sports, meals, walks, language practice, online venues, time/place and stated participation conditions.

Strict positives use clear dates and bounded times where schedules matter. Most activities occur on or after 12 September 2026. Relative Hong Kong dates include timestamps after UTC/Hong Kong date rollover and explicitly clarified calendar dates. Naturally unresolved schedules belong to the uncertain class. Housing uses specified residence periods rather than arbitrary appointment times.

## Fixed measurement rules

The acceptance plan requires at least 90% high-confidence precision and at least 75% positive recall in every category. With 12 gold positives per category, at least 9 must receive high-confidence matches to meet positive recall. Precision is true high-confidence matches divided by all high-confidence predictions for that category. An empty prediction denominator must be reported as undefined; it is not a precision pass, and the recall gate still applies.

Across all 90 reject/uncertain cases, falsely returning high confidence must be at most 5%. Thus 4 false high-confidence results pass this overall rate and 5 fail. A high-confidence result on an uncertain case counts as a false high-confidence result for this test, without claiming the pair is definitely incompatible in real life.

Report all three label strata and per-category denominators. These independent pairs test semantic classification and confidence abstention. They do not by themselves measure top-five ranking, literal P@5, fill, student coverage, large-corpus recall, filtering of inactive or blocked accounts, pagination, API behavior or UI correctness; those require the other acceptance-plan checks.

## Holdout discipline and limits

Verify the JSON checksum before evaluation and record the implementation revision and evaluator settings alongside results. Do not rewrite a case, reason or label after seeing outputs to make it agree with the matcher. If an authoring defect is later found, retain this frozen file and disclose the defect separately; a corrected version requires a new identity and checksum.

Once failures or cases are revealed for implementation tuning, this set becomes development data. A fresh independently frozen set is required for any subsequent claim of blind validation. Do not conceal that reuse by continuing to call this file a holdout.

This set is small, balanced by construction, synthetic and authored by a single independent agent. Its labels have not had human adjudication, and local room/eligibility rules are represented only by asserted fixture facts. Repeated campus subjects, deterministic date conventions and intentional hard contrasts may favor or penalize particular representations. Passing cannot establish real-student precision, real prevalence, multilingual robustness or useful production recommendations. Report uncertainty and retain post-launch usefulness validation as a separate requirement.
