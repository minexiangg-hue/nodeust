# Match iteration acceptance plan

Baseline: f32c923, previous reports/match-study-2026-09-11. Production remains on the previous release until validation and deployment backup are complete.

## Scope

Independent server-side matching across housing, goods, study, transport and social requests; original post/category preserved. Full active own-post history and relevant candidates beyond the plaza's 100-post window. Evidence-based intent extraction, complementary roles, hard constraints, explicit uncertainty, cancellation/expiry/account/block filtering, explanations, pagination and UI integration. No external processing of user content. Reversible deployment with feature switch; no destructive migration.

## Gates fixed before measuring new algorithm

- Each category: precision among returned top-five high-confidence recommendations ≥90%; report literal P@5 (including empty slots) and fill rate separately.
- Each category: unlimited compatible candidate recall ≥60% on the previous full synthetic corpus; top-five recall reported against its attainable ceiling rather than requiring 60% when >5 relevant posts exist.
- Each category: ≥70% of eligible students receive at least one useful high-confidence result (eligibility defined by gold, never by parser success).
- Independent manually authored paired scenarios, labels fixed before output: ≥90% precision per category and ≥75% positive recall per category; reject/uncertain cases falsely labelled high ≤5% overall. These are independent agent-authored labels, not human annotations.
- Counterexamples, misses and subsequent development-set reuse must be logged. After tuning against revealed cases, a newly frozen test set is required; an exposed holdout is no longer a holdout.
- No private identity/contact leakage; inactive/removed/self/blocked candidates excluded; >100 and old own posts, edits, expiry, pagination, direct reload, mobile/desktop exercised against real API and browser.
- Existing relevant unit/management checks, production build and rollback verification pass before release.

## Work order

1. Freeze independent scenarios and extract explicit semantic intents from training corpus.
2. Implement shared matching/ranking engine and retrieval index; evaluate and inspect errors.
3. Improve general rules, add counterexample regression tests; freeze fresh independent cases after tuning.
4. Integrate server endpoint and page, real isolated MySQL/API/browser evaluation.
5. Report measured limits, back up current release, deploy and check; archive reproduction logs.

Report uncertainty honestly: synthetic and agent-authored results cannot establish real-student precision; post-launch usefulness feedback remains necessary.
