# Matching development checkpoint — 2026-09-11

**Not ready for release.** This checkpoint is being synchronized to `feat/tencent-node-mysql` at the user's request. Production remains on the transport release based on `f32c923` (build `K-J2oPFCmJQOkDipbss3_`). This matching work has not been deployed and has not changed production data.

## Implemented

- Server-side matching across housing, goods, study, transport and social posts, with an index over all active posts, complementary roles, hard constraints, explicit missing details and expiry checks.
- Authenticated `/api/matches`, pagination, account/block filtering, private response fields and index invalidation after post or moderation changes. No database migration in this checkpoint.
- Matching UI with independent category/page controls, optional possible matches, explanations, missing-detail editing links and request race handling.
- Isolated synthetic-data seed, algorithm evaluation, real API/lifecycle/browser scripts and parser regression tests.
- Experimental `semantic-schema.ts`: local-model JSON schema, prompt, public-input allowlist and validation/adapter. Unsupported hard constraints remain marked as missing. This module has not been connected to the matcher or used for model inference. Literal quotations and numeric grounding are checks, not proof of semantic correctness.

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

At synchronization, 81 existing matching tests, 10 existing unit tests and 22 management tests passed. The experimental semantic module adds 20 passing tests. TypeScript and targeted lint are checked before committing.

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

Trial local multilingual structured extraction with deterministic compatibility checks. Measure extraction validity, matching quality, latency and resource usage on synthetic data before deciding whether to adopt it. The candidate is [Qwen3-4B-Instruct-2507](https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507), using the [ggml-org conversion](https://huggingface.co/ggml-org/Qwen3-4B-Instruct-2507-Q8_0-GGUF) and [llama.cpp server](https://github.com/ggml-org/llama.cpp/tree/master/tools/server); no inference results are available yet.

After development, freeze another independent validation set. Deployment requires passing the acceptance gates, a fresh build, applicable API/UI verification and a current-release backup with rollback verification. `NODE_MATCHING_ENABLED=false` provides an authenticated endpoint disable switch; it does not replace a deployment rollback.
