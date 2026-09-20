# Goods recall: input uncertainty versus extraction failure

The original acceptance gates remain in force. Goods high-confidence recall is **57.3666%**, below 60%; this audit does not turn that failure into a pass.

Reproduction:

```sh
node scripts/match-evaluation/audit-corpus-misses.mjs reports/match-iteration-2026-09-19/iteration-open-invitation reports/match-iteration-2026-09-19/corpus-missing-currency-audit.json
```

The complete development corpus contains 177 positive-price goods posts with no parsed explicit currency. All 8,030 missed student/candidate recommendations are returned as possible matches with exactly `currency` missing. They affect 375 students and 693 distinct candidates. These are not 8,030 independent missing posts: a missing currency in a student's own request can affect many candidates, including candidates that do state their currency.

Example source wording: `放螢幕，賣250蚊，校內交收，有冇人啱？`. Gold compatibility compares its price number without establishing currency from the public text. The matcher does not equate an unspecified unit with HKD. Consequently, adding extraction synonyms elsewhere cannot improve this particular corpus gate. All missing recommendations are already retrieved; the shortfall is the confidence decision.

## Consequences for the next work

1. Preserve the original evaluation and reported failure. Do not silently default currency, edit gold, remove these cases, or count possible recommendations as high.
2. Finish independent evaluation on newly authored inputs with explicit positive, negative, and genuinely uncertain labels before further parser tuning. That validation must include bare currency units and explicit foreign currencies, not omit them.
3. Inspect the actual interface for possible results: users must be able to see and resolve the missing currency. A context-dependent currency assumption, if introduced later, needs explicit provenance and user-visible confirmation rather than an assertion that both prices are comparable.
4. Product-side clarification can improve future data, but does not retrospectively satisfy the archived corpus gate. The final report must distinguish input-quality limits from algorithm improvements and keep this gate unresolved unless a justified solution actually passes it.

This audit is based on exposed synthetic development data and does not estimate real-student performance.
