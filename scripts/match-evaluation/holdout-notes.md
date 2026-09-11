# Independent scenario holdout: frozen labels

Fixture: `holdout.json`.

SHA-256 at label freeze:
`37a3d5f8b0a28b8f347e14d33f2218338d2bb08ce35fadf675d6a04abb126d3a`.

The labels were fixed before the author inspected any new matching/parser implementation or observed its predictions. The author used the product semantics in `reports/match-study-2026-09-11/report.md` and wrote the requests and rationales independently. This is a hand-authored synthetic holdout, **not human annotation or a claim of independent real-user sampling**. During an earlier, separate credential audit this same author had seen the previous `scripts/match-study/generate.mjs`; the author did not reopen it for this task. Therefore the author is blind to the new implementation/output, but was not historically unexposed to the older generator. This limitation must stay with reported results.

The temporary authoring script only serializes explicitly written scenarios; it is outside the repository. Do not change these labels in response to model predictions. If an independent semantic review identifies an actual labeling error, record the original hash, ID, reasoning and revised hash before rerunning; report both results. Once outputs are inspected, this fixture is a disclosed regression set, not an untouched future holdout. Tuning then requires a new independently authored holdout.

## Fixed input contract

- 120 independent pairs; 24 each for `hall`, `goods`, `study`, `transport`, and `other`.
- Every category has 10 strict positive `match`, 8 explicit `reject`, and 6 `uncertain` cases: totals 50 / 40 / 30.
- Evaluation instant: `2026-09-11T04:00:00Z`, which is **11 September 2026, 12:00 in Hong Kong**. All local times are Hong Kong times unless a post explicitly says the timezone is unresolved.
- Post `createdAt` is the anchor for relative expressions, not the evaluation instant. Most posts share the fixed instant; a few cross the UTC calendar boundary while remaining on the same Hong Kong date.
- All authors are invented, distinct, active members; all records are accessible, unblocked and belong to different people. These assumptions isolate semantic compatibility. Authorization, self-exclusion, stale database status and candidate retrieval need separate integration checks.
- `kind` is the evaluator's intended semantic domain, **not an allowed matcher input**. A/B `category` remains the original selected category and is deliberately wrong in some cases.
- Only the two post objects may enter extraction/matching. Never send `id`, `kind`, `expected` or `reason` to a model or use them in retrieval/features. Keep labels separate from the extraction process and compare only after predictions have been written.
- Some positives contain specific models, lesser-covered activities, several independent intents or new aliases. Lack of parser support is a recall failure or a reason to keep that category in shadow mode, not a reason to relabel a clear positive.

## What each label means

`match`: The available text supplies a concrete mutually useful reason to contact, with compatible explicit hard constraints. This is a potential contact, not a promise of exchange, official approval, trustworthiness or future replies. The strict hall positives deliberately state term, rooms and relevant accommodation eligibility. Goods positives state product, price and overlapping handover. Timed study/transport/activity positives give actual dates and compatible times.

`reject`: Both sides are sufficiently understood to establish a conflict, an explicit refusal/cancellation, or an expired opportunity. A different required model, incompatible prices, too few seats, opposite travel direction, different hall namespace or two one-way seekers are not weak positives. Declared accommodation eligibility is checked as an explicit constraint; no protected or personal attribute is inferred from names, language or other proxies.

`uncertain`: Essential information is missing, contradictory or explicitly unconfirmed, or the content is outside supported peer-matching intents. The appropriate outcome is abstention and, where useful, a concrete question. This does not mean that a known viable pair is negative. A quoted activity, product mention, vague greeting or irrelevant service inquiry must not be converted into an invented actionable request.

Negation is scoped. Selling a lamp while saying a guitar is sold can still match the lamp. Explicit corrections supersede an old time/target; an unresolved contradiction cannot be silently resolved. A post with several independent intents can match through any genuinely compatible intent, without requiring all its unrelated wishes to align. Categories are weak hints, not permission to discard clear intent.

Missing values never become a convenient default. In particular, this holdout does **not** assume a universal 30-minute travel tolerance or a universal four-person taxi: time flexibility and taxi capacity are stated where needed. Explicit interval endpoints are inclusive. A departure strictly before the fixed evaluation instant is expired. An author who explicitly says their timezone/date is unresolved must be asked, even if a parser can produce a plausible guess.

## Prespecified evaluation and gates

Report a three-way confusion matrix overall and per category. A recommendation means the implementation's **high-confidence, user-visible match** decision; tentative candidates with missing conditions must be tracked separately. Specify that mapping before running. If the implementation exposes only a binary result, uncertain-vs-reject classification cannot be scored; report that limitation rather than claiming correct abstention labels.

Let `TP` be expected-match pairs actually recommended; `FP_reject` and `FP_uncertain` are recommendations on the other two labels. Strict precision is `TP / (TP + FP_reject + FP_uncertain)`. Both kinds of false positives count fully; unknown conditions must not disappear from the precision denominator. Positive recall is `TP / 50` overall and `TP / 10` per category. Report per-category precision and recall as well as macro/micro values, recommendation rate, abstention rate on each true class, and each false-positive reason. Zero recommendations yields undefined precision and fails the recall gate; it is not 100% precision.

Proposed necessary gates, set before predictions:

1. **At least 90% strict recommendation precision overall and in every enabled category.** Do not hide a failing category in an aggregate score, and do not lower this threshold after seeing results.
2. **At least 80% positive recall overall and at least 70% in every enabled category.** For the full fixture this means at least 40/50 positives overall and at least 7/10 in each category. These are prespecified anti-abstention coverage floors, not measured results or claims from the earlier report. Disabling a category must be explicit; report its zero coverage and do not advertise all-category matching.
3. **Zero high-confidence matches for these critical explicit-conflict sentinels:** `holdout-hall-12` (PG/UG conflation), `holdout-hall-15` (explicit eligibility conflict), `holdout-hall-16` (cancelled), `holdout-goods-12` (excluded model), `holdout-goods-13` (hard budget), `holdout-goods-14` (sold), `holdout-study-14` (explicit language incompatibility), `holdout-study-17` (cancelled), `holdout-study-18` (expired), `holdout-transport-14` and `holdout-transport-15` (capacity), `holdout-transport-17` (cancelled), `holdout-transport-18` (expired), `holdout-other-15` (cancelled), `holdout-other-16` (explicitly declines company), and `holdout-other-18` (expired). An abstention avoids an unsafe recommendation but remains a reject-vs-uncertain classification error if the system claims three-way understanding.
4. **At least 90% of expected-uncertain cases must not become high-confidence recommendations** (at least 27/30). Also report correct uncertain classification separately: a blanket hard rejection does not demonstrate good follow-up questions or semantic understanding.
5. **No implementation errors, date parsing crashes, label leakage or missing predictions.** Every ID gets a recorded output. Freeze ranking thresholds and parsing confidence settings before the run; keep the hash and exact source commit with the result.

These gates are necessary engineering evidence, **not sufficient evidence for broad release**. There are only ten positives per category; report uncertainty with precision estimates. An observed 9/10 is not statistical proof that population precision is at least 90%. As an illustration, even with no observed errors, at least 29 independent successful recommendations are required for the one-sided 95% exact-binomial lower confidence bound to exceed 90%; ten flawless recommendations are far too few. Independence and deployment representativeness are themselves unverified for synthetic scenarios. Gather a larger fresh evaluation with independent annotation before claiming a production precision guarantee.

This pair set cannot measure **P@5** or user-level useful-result coverage: it has no independently labeled ranked candidate pools. Do not rename pair precision P@5, pad empty slots with successful abstentions, or rank unrelated pairs to manufacture a retrieval score. The report's proposed per-category P@5 ≥90% remains a separate requirement for fresh query/candidate pools. Candidate retrieval beyond the latest 100 posts, the author's older active needs, blocked/removed posts, pagination and page refresh also require separate tests. Shadow-mode comparison, a reversible feature flag and real-user usefulness feedback remain required before gradual rollout.

If a gate fails, keep the affected new behavior in shadow/off mode, report the gap, and improve using a separate development set. Keep the frozen failure result; do not rewrite this holdout to fit the implementation.
