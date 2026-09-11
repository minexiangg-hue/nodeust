# Matching development checkpoint — 2026-09-11

**Not ready for release.** This checkpoint is being synchronized to `feat/tencent-node-mysql` at the user's request. Production remains on the transport release based on `f32c923` (build `K-J2oPFCmJQOkDipbss3_`). This matching work has not been deployed and has not changed production data.

## Implemented

- Server-side matching across housing, goods, study, transport and social posts, with an index over all active posts, complementary roles, hard constraints, explicit missing details and expiry checks.
- Authenticated `/api/matches`, pagination, account/block filtering, private response fields and index invalidation after post or moderation changes. No database migration in this checkpoint.
- Matching UI with independent category/page controls, optional possible matches, explanations, missing-detail editing links and request race handling.
- Isolated synthetic-data seed, algorithm evaluation, real API/lifecycle/browser scripts and parser regression tests.
- Experimental `semantic-schema.ts`: local-model JSON schema, prompt, public-input allowlist and validation/adapter. Unsupported hard constraints remain marked as missing. At the GitHub checkpoint this module had not been used for inference; subsequent local synthetic trials are recorded below. It remains outside the production matcher. Literal quotations and numeric grounding are checks, not proof of semantic correctness.

## Recorded evidence

See [checkpoint-results.json](checkpoint-results.json) for the original machine-readable summaries and [plan.md](plan.md) for the acceptance gates fixed before evaluation.

The original synthetic corpus has 500 students and 3,746 posts. Iteration 02 recovered all 23,753 expected contacts without false positives on that exposed corpus. The initial 120 hand-authored development scenarios returned 10/10 positive cases in each of housing, goods, study and transport, and 8/10 in social, without high-confidence false positives. These results do not establish generalization.

A fresh author created 150 scenarios without inspecting the implementation, old generator or previous fixtures. The implementation was frozen before their first evaluation in iteration 03. Each category contains 12 positive, 10 reject and 8 uncertain cases:

| Category | Correct positives | False high-confidence matches |
| --- | ---: | ---: |
| Housing | 0/12 | 0 |
| Goods | 6/12 | 0 |
| Study | 3/12 | 1 |
| Transport | 1/12 | 0 |
| Social | 0/12 | 0 |

**The blind validation failed the release gates.** Common misses include paraphrased roles, loans, academic-year housing terms and activity participation; a study case mishandled a negated language requirement. `validation-v2.json` is now exposed development data. It must not be described as a fresh holdout after further tuning.

The earlier isolated iteration-02 build passed 500-user real API evaluation (1,202 requests, no failures), 17 lifecycle/authorization checks, and 500 real-browser roles (250 mobile, 250 desktop; 10,536 rendered cards; no API, runtime or overflow failures). These integration checks validate that earlier build; later parser/UI/schema refinements still require a fresh production build and appropriate integration verification before release.

## Verification and reproduction

At checkpoint `3c5539f`, 81 existing matching tests, 10 existing unit tests and 22 management tests passed; the experimental semantic module added 20 passing tests. At this synchronization, all 144 current matching tests pass (including 24 semantic-schema, 24 constraint, 11 pair-client and 4 residence-engine tests). TypeScript, targeted lint and `git diff --check` also pass. A fresh application build and integration verification remain release prerequisites.

```sh
node --experimental-strip-types --test scripts/match-evaluation/*.test.mjs
npm run check:unit
npm run check:management
npx tsc --noEmit --incremental false
```

`evaluate.mjs` consumes the archived synthetic corpus described in [the original report](../match-study-2026-09-11/report.md). Bulk generated payloads, per-role logs, earlier frozen source snapshots, isolated database credentials, model binaries and model weights remain local and are excluded from Git. The committed JSON summaries retain the measured outcomes; they do not package every historical executable snapshot. Iteration 01 has contemporaneous logs but no frozen intermediate source snapshot.

Fixture SHA-256 values:

- Original corpus: `c04c4c47f9e5e1bea2468be2fe14c4e7c2022428f5cbd068288c5fc78859ec8b`.
- Initial 120 scenarios: `37a3d5f8b0a28b8f347e14d33f2218338d2bb08ce35fadf675d6a04abb126d3a`.
- Fresh 150 scenarios: `d5427d91f41b0feab012cb593d432ac7cf13dfa8ba25e2443bcf0e60949d1b93`.

## Next iteration

Trial local multilingual structured extraction with deterministic compatibility checks. Measure extraction validity, matching quality, latency and resource usage on synthetic data before deciding whether to adopt it. The candidate is [Qwen3-4B-Instruct-2507](https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507), using the [ggml-org conversion](https://huggingface.co/ggml-org/Qwen3-4B-Instruct-2507-Q8_0-GGUF) and [llama.cpp server](https://github.com/ggml-org/llama.cpp/tree/master/tools/server); the subsequent local trials are summarized below.

After development, freeze another independent validation set. Deployment requires passing the acceptance gates, a fresh build, applicable API/UI verification and a current-release backup with rollback verification. `NODE_MATCHING_ENABLED=false` provides an authenticated endpoint disable switch; it does not replace a deployment rollback.

## Continued work after GitHub checkpoint 3c5539f

Production remains unchanged. The local Qwen3-4B-Instruct-2507 Q8 model was downloaded from the pinned ggml-org revision and verified against SHA-256 `ae916ede1c010a26955ee8ae2e908bf8815a3f135ec860439ab924701c69d5f1`. Experiments run only on synthetic data through a loopback-only llama.cpp server, with three CPU threads, one slot and a 4,096-token context. The previous isolated API/browser server has been stopped; its disposable database is retained for later verification.

[semantic-trials.json](semantic-trials.json) records the completed small trials. None is acceptance evidence:

- Iteration 04: first positive pair per category, ten posts. Four outputs failed the validator, three abstained, and none of the five pairs produced a correct high match. The model had not been given a complete field guide; JSON schema grammar does not automatically provide one.
- Iteration 05: explicit per-kind field/role guidance and required nullable core fields improved role and housing-period extraction, but still yielded no complete high matches. Optional fields, incomplete evidence quotations and unsupported constraints remained problems.
- Iteration 06: direct pair judgment got four of five known-positive cases correct. It wrongly called a reciprocal housing exchange a direction conflict and also failed quote validation. This all-positive pilot cannot estimate precision or false-positive rate.
- Iteration 07: using identical posts/prompts with plain JSON restored some previously skipped price/model/time keys, but both outputs failed strict validation through wrong roles, types, time values or evidence shapes. Plain JSON is not a usable fix by itself.
- Iteration 09 completed all 15 fixed cases (first match, reject and uncertain case per category) with explicit role-direction rules: 4/5 positive cases found, 3/10 negative/uncertain cases falsely high, and 3 invalid responses. False matches include unconfirmed housing allocation, incomplete item facts and missing travel details. The method remains unsuitable for release.

Observed Q8 decoding is about 5–6 tokens/second. The first direct-pair pilot averaged about 55 seconds per pair; the longer field-guide extraction had a cold request of about 153 seconds. These are shared-host experimental measurements, not production latency guarantees. Inference cannot be placed synchronously in the matching page request.

The [semantic compatibility design](semantic-compatibility-design.md) identifies structural gaps that a better text interpreter alone cannot repair: loans/returns, barter, activity hosting/joining, detailed residence periods, fees, luggage and participant constraints. New typed residence/room/money comparators have focused tests. Complete canonical residence periods and accepted-room sets are now used by the development engine. Different end dates no longer collapse into the same first year; explicit room-type alternatives no longer fail as unequal strings.

The first residence integration inadvertently required a numeric year for every legacy season-only post, reducing original-corpus housing recall to zero. That regression is recorded in `iteration-08-residence`. It was corrected by preserving the original stated-season scope: two season-only posts can still match on that statement, with an explicit explanation to confirm the year in chat; an explicit year on either side still requires compatible calendar evidence. The corrected 500-student/3,746-post run restores all original-corpus gates; independent validation-v2 remains failed. Exact-year verification must not be inferred from a season-only contact suggestion.

[local-model-options.md](local-model-options.md) documents official model/runtime sources, the standard GBNF optional-field ordering issue, and alternatives. A newer Qwen3.5-4B Q4_K_M local conversion is now prepared from pinned official weights (`851bf6e806efd8d0a36b00ddf55e13ccb7b8cd0a`) using llama.cpp `5266f24da75dc449bd56cbed7addb9c8e4a6a73e`. The 2,708,804,352-byte result has SHA-256 `4a742444a7106eb33ba5b1ae60ceabaf2d3a960cbe98bcf4ebbf30209dca8c52`; conversion and quantization completed within a 6 GiB memory limit, but loading and matching quality have not been tested. The model and full conversion records remain in `/tmp/nodeust-qwen35-model`, outside Git. Iteration 10 completed four serial requests on two fixed housing pairs, comparing decision-first with evidence-first output. Evidence-first recovered the reciprocal exchange positive and removed the uncertain case's false high match, but mislabeled that uncertain case as a direction conflict with an incorrect explanation. All four responses passed structural/quote validation; only one had the correct three-way semantic classification. This targeted result supports further investigation, not an accuracy claim. Request times ranged from 39.7 to 94.0 seconds, with unequal prompt-cache reuse and concurrent local preparation; they are not a fair speed comparison. Neither is connected to production. A fresh independent validation set, full applicable integration checks, release backup and rollback verification are still required before deployment.
