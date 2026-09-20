# Fresh 30-case probe, first execution

This probe was labelled before its first execution against the frozen current source. The implementing assistant also authored it: it is **not independent-author validation**, and the small sample does not satisfy the full acceptance gate. It becomes exposed development data after this run.

Source: `work/match-snapshots/reciprocal-intents-v6-dev-49-of-60/`, 86 files hash-verified. Input and labels: `scenarios.json`, SHA-256 in `freeze.json`. Actual evaluation time is the fixture's `2026-09-19T04:00:00Z`. No labels changed after execution. Run used the snapshot's `diagnose.mjs`; output is `first-run.json`, numerical aggregation `summary.json`.

| Category | Recovered positives | High-confidence negatives |
| --- | ---: | ---: |
| Housing | 1/3 | 0/3 |
| Goods | 3/3 | 0/3 |
| Study | 2/3 | 0/3 |
| Transport | 1/3 | 0/3 |
| Social | 3/3 | 0/3 |
| Total | 10/15 | 0/15 |

Precision is 100% *within this tiny sample*, not an estimate of real-user precision. Overall positive recall is 66.67%. Housing, study and transport fall below the existing 75% per-category target. Existing exposed v2 results of 49/60 do not establish generalization.

## Next priorities from the new evidence

- Housing: sentence ordering and room-before-hall versus hall-before-room lose current or wanted room facts; abbreviated/full academic-year references lose scope.
- Study: `No paid tutoring` in an explicit peer request leaves `study-fee` unresolved; inspect negation scope instead of interpreting all payment terms as a positive fee claim.
- Transport: explicit `no luggage` and `no luggage allowed` remain unresolved; zero is a real baggage count/limit, not absent information.
- Transport: `max HKD 40 each` leaves fare unresolved; inspect common budget/basis phrasing.

Do not retune and report the same cases as an independent holdout. Preserve first-run evidence and labels; improvements on these cases must be reported as development results, followed by fresh verification. Original goods corpus 60% recall gate remains unresolved separately.
