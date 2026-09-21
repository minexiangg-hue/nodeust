# Practical discovery release

User explicitly accepted an additional, clearly labelled related-post discovery section, conditional deployment if better than the online version, rollback flexibility, and GitHub synchronization.

## Behavior
Existing high/possible matching is preserved. Up to ten related public posts appear in a separate section after matching results; they have no match confidence and do not inflate match counts. The UI states that only wording is related and needs/timing/conditions require confirmation. Active-account/status and bidirectional blocking revalidation apply before discovery. Known comparable pairs rejected by matching are suppressed from related leads. Unknown roles/constraints can still produce incompatible leads; this is discovery, not a compatibility guarantee.

Set NODE_RELATED_ENABLED=false and restart to disable only the related section. NODE_MATCHING_ENABLED=false remains the whole-feature kill switch. No database schema migration or model service is introduced.

## Evidence and limits
The live build identifies reciprocal-intents-v5. Comparing its corresponding Git checkpoint e0be78d against the candidate on the same already-exposed synthetic set: true matches recovered 11/50 -> 12/50; including separately labelled top-ten related leads, 37/50 partners were discoverable. Explicit-conflict matches remain 2/25; 11/25 conflicting pairs appeared as related leads, illustrating why these are not matches. This is a development comparison against the source checkpoint, not proof of exact deployed source parity or a fresh release-accuracy claim.

The earlier pure matching candidate failed its new holdout recall requirement (24% vs 60%). That result is preserved in reports/match-practical-2026-09-21/acceptance.json. The accepted product extension does not rewrite that result or declare the matching goal achieved.

314 matching tests pass before release build; final email/API/browser results and release/rollback paths will be recorded after execution. Prior performance p95 about99ms covered matching with lexical candidate retrieval but not the newly added related ranking; it must not be presented as the final combined endpoint latency.

## Release policy
Build only in /tmp/nodeust-practical-build-20260921. scripts/switch-release.py preserves the actual previous .next build and automatically restores it on failed health checks. Database and auth configuration remain unchanged. Rollback by invoking the same script with the recorded previous-next path. Preserve new user data; do not restore a database snapshot for a code rollback.

## Final validation

Final build ydSGmmPz9uNsU3HLbk4wl completed successfully with local dependency copies. Shared node_modules symlink builds failed with a Next module resolution error; no failed build was deployed. Final314 matching tests and TypeScript/static checks pass. Twenty email integration tests pass including relatedItems separate counts, identity allowlist, blocking and visible unconfirmed label in desktop/mobile browsers. Final combined pure-algorithm p95 is184.29ms for500 users/3746 posts, excluding database/network.

## Deployed and rollback

Deployment healthy; build ydSGmmPz9uNsU3HLbk4wl replaced s_N0AgjqzUmDaEED5XFpr. No database changes. Exact rollback command:

```sh
python3 scripts/switch-release.py /home/ubuntu/nodeust-backups/switch-20260921T082811Z-6375acd8/previous-next
```

Public HTTPS health/login/matches page availability checked after switch; see public-smoke.json.
