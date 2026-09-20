# Independent scenario authoring brief

## Access boundary

The author receives this brief and the JSON schema below only. Do not read matcher implementation, previous fixtures, regression tests, parsed outputs, scores, or reports explaining misses. Do not run the matcher while authoring. Authoring must finish and the resulting bytes must be frozen with a timestamp and SHA-256 before any prediction is inspected. A different author from the implementing assistant is required for this gate; a fresh conversation with the same implementation context is insufficient.

## Product behavior

A university community recommends one student's public request to another where their needs/provision or peer activities complement each other. Categories: housing room swaps (`hall`), goods transactions (`goods`), tutoring/peer learning (`study`), rides/taxi sharing (`transport`), social activities (`other`). Users may select the wrong category. Public text can be English, simplified/traditional Chinese, Cantonese, mixed, informal, misspelled, multi-intent or partially cancelled. Do not assume users write to a template.

Use synthetic public posts only; no real accounts, contacts or private content. Represent each side's situation independently. Do not produce positive examples merely by paraphrasing the same sentence twice. Include realistic incidental information and different ordering. Avoid obscure knowledge needed to decide labels.

## Required cases and labels

Exactly 150 pairs: for each of the five kinds, 12 `match`, 10 `reject`, 8 `uncertain`.

- `match`: compatible complementary roles or compatible peers, with no unresolved explicitly mandatory condition. A recommendation does not guarantee a completed transaction or admission. Ordinary open invitations need not enumerate an unstated headcount limit; explicit limits must be checked.
- `reject`: at least one explicit decisive contradiction, incompatible role, withdrawn intent or expired need. Describe the precise contradiction in the reason.
- `uncertain`: a fact necessary to compare an explicit condition is absent, ambiguous or contradictory. Do not guess missing personal eligibility, room allocation, currency or fee basis, travel schedule, required skill/equipment, access, etc. Explain exactly what is unknown.

Include at least one bare currency unit and one explicit foreign-currency scenario; do not silently assume all prices are HKD. Dates and Hong Kong local-time interpretation must be unambiguous where essential. Include room direction/eligibility/period, goods price/identity/transaction type, study subject/role/topic/payment, transport direction/time/party/fare, and social activity/place/participation constraints. Include multi-intent and cancellation cases across the set. Do not make all negatives a single mechanically substituted field.

The author's confidence in each label and any ambiguity concerns go in `reason`. If a scenario cannot support a stable label, improve its wording before freezing, rather than guessing. No label changes after output inspection; an adjudication, if later needed, must be separately logged and original scores preserved.

## JSON contract

```json
{
  "now": "2026-09-19T04:00:00Z",
  "cases": [{
    "id": "independent-hall-001",
    "kind": "hall",
    "expected": "match",
    "a": {"title": "...", "body": "...", "category": "other", "createdAt": "2026-09-18T08:00:00Z"},
    "b": {"title": "...", "body": "...", "category": "hall", "createdAt": "2026-09-18T08:00:00Z"},
    "reason": "Independent semantic justification, not a description of parser behavior."
  }]
}
```

Only `title`, `body`, selected `category` and posting timestamp are available to the matcher in this evaluation. No hidden truth fields or author labels enter parser inputs. Keep creation/evaluation times internally consistent.

## Acceptance and reporting (fixed before predictions)

Each kind: returned-high precision ≥90%, positive recall ≥75%; overall reject/uncertain falsely high ≤5%. Report raw counts, denominators, null precision if no high predictions, all misses and all false highs. A per-category failure fails the gate; overall averages cannot hide it. Test size and synthetic authorship limitations must be stated. No claim of real-student precision follows from passing.

Save author provenance, frozen input hash, evaluation timestamp, exact candidate source hashes and first-run output. Once results inform implementation, mark the entire exposed set as development and require a new frozen set for final independent verification. Do not repeatedly test a revealed set and present its tuned score as holdout performance.
