# Route and interface rearrangement

## Baseline and recovery

Baseline: `42f3a15` on `feat/tencent-node-mysql`. Production was kept in maintenance mode during implementation and reopened at the user's request after deployment.

Verified backup: `/home/ubuntu/nodeust-backups/20260910T091742168Z-architecture`.
It contains a restore-tested MySQL dump, the complete current standalone build, the Git source archive, application environment and gateway source. Backup directory is private. No database migration is planned.

Normal rollback restores the previous application build and gateway source, leaving current database records and messages intact. A database snapshot is for disaster recovery and must not overwrite newer user data during normal application rollback.

## Implementation sequence

1. Inventory every existing feature and back up the deployed baseline. **Complete.**
2. Introduce real App Router paths, a persistent shared application shell, and deep-link authorization/loading.
3. Extract posting, chat, profile, announcements and shared presentation components; upgrade desktop/mobile layout.
4. Add a welcome home and functional settings; preserve language, location, map preferences and every existing member/moderator action.
5. Adapt gateway public routes and login return paths. Preserve maintenance and identity boundaries.
6. Run unit/management checks, production build, isolated MySQL/API checks and desktop/mobile browser regressions.
7. Prepare/deploy the verified build with a runnable rollback; keep maintenance enabled until the user requests reopening.

## Planned route map

| Path | Purpose |
| --- | --- |
| `/` | Public welcome home; signed-in members use the shared navigation |
| `/explore` | Campus map/list, groups, search, filters, counts and location tag |
| `/matches` | Reciprocal housing matches |
| `/messages` | Anonymous conversation inbox |
| `/messages/[id]` | Authorized individual conversation and mutual contact exchange |
| `/requests/[id]` | Individual request details, save/report/chat |
| `/posts` | My posts and draft box |
| `/posts/new` | Publish a request or continue a browser draft |
| `/posts/[id]/edit` | Edit an owned, editable post |
| `/saved` | Saved requests |
| `/profile` | Private account profile and editing |
| `/settings` | Language, map preferences, manual location, privacy and feedback |
| `/announcements` | Collapsed announcement board, recent activity and matches |
| `/moderation` | Existing role-checked management tools |
| `/rules` | Community rules |
| `/owner/stats` | Existing hidden Owner-only aggregate statistics |
| `/maintenance` | Maintenance preview |

## Preservation checks

- Map/list, group, keyword and category survive client navigation; browser back/forward and direct refresh work.
- Editing and drafts retain their semantics; failed writes keep entered content.
- Chat cannot acknowledge messages while another page is displayed. Deep links must not depend on bounded feed/inbox lists.
- Announcements remain collapsed and only displayed announcements become read.
- Settings perform actual persistence; omitted profile fields remain untouched.
- Mobile navigation exposes every destination, including saved requests and settings.
- All new member routes honor maintenance and authentication. Role enforcement remains server-side; hidden stats stay unlisted.
- No changes to database schema, matching algorithm, moderation policy or mutual-contact consent.

## Implemented behavior and validation

- Real server routes use a persistent shared shell. Post, chat, profile and editor views are extracted into their own components. Headers and browser titles reflect the destination. Desktop navigation and a five-item mobile bar share the same paths; the profile hub exposes every secondary destination.
- The new welcome home introduces the community with links to exploration, announcements, rules, profile and settings. The public gateway forwards the home and required static assets without adding an identity.
- Member settings save language and location through existing APIs; map/list default and bubble visibility use browser storage. Privacy stays mandatory and mutual contact exchange stays unchanged.
- A new read-only `GET /api/conversations/[id]` checks participation and blocked state, returning anonymous metadata for direct links. It neither exposes real identities nor acknowledges messages.
- The editor retains unsaved input during member navigation. A saved draft can be reopened by ID; failed storage/network operations preserve the form.
- Browser storage preference descriptions distinguish device-local choices from account settings. No database migration is required.

Validation completed against isolated MySQL and a production build:

- 8 unit tests and 22 management tests, including three new conversation metadata authorization tests.
- Targeted lint passes for all new community modules, navigation/model and the modified shell. Production build and TypeScript check pass.
- Real API tests: author-only editing, unavailable post privacy, metadata membership/blocked state, direct links outside the 100-post/200-conversation windows, monotonic read acknowledgements, contact consent, language-only updates and aggregate counts.
- Desktop (1440px) and mobile (390px): routes/back/refresh, group/search/view retention, drafts/editor input, publish failure and retry, preferences and failed-save behavior, collapsed/read announcements, active-page-only reads, hidden-document behavior and message receipts. No runtime errors or horizontal page overflow.
- Maintenance checked on all 14 welcome/member paths; ordinary members receive 404 for moderation and hidden statistics, Owner still receives statistics.
- Gateway patch: syntax, patch dry-run, isolated HTTP tests for public assets, identity stripping, login/registration return paths and invalid destinations; desktop/mobile login rendering.

The test databases and accounts are isolated from production. Existing feed/inbox windows, matching logic, privacy checks and database tables remain unchanged.

## Deployment completed

Deployed at `2026-09-10T09:46:24Z`. Application health, both systemd services,
the Nginx public host, maintenance on all member routes and the updated login page
were verified. Maintenance was enabled at this initial deployment and was
subsequently disabled at the user's request. The full final candidate browser suite and gateway-to-Next browser
integration passed before this switch. The previous application was also started
successfully against the unchanged schema in isolation.

Rollback application and gateway (preserves current database and accounts):

```bash
python3 /home/ubuntu/nodeust-backups/20260910T091742168Z-architecture/rollback.py
```

The script preserves the displaced new build and gateway, restores the backed-up
application and gateway, and checks health. It leaves the current maintenance
configuration unchanged. Do not restore the SQL/account snapshots during ordinary
rollback: doing so would replace data created after the backup.

The tested gateway patch is tracked at `deploy/gateway-routing.patch`. No database
migration was added or applied for this rearrangement.

Temporary preview services, isolated test database/account and private test environment were removed after verification.

## Palette and readability update

Deployed `2026-09-10T11:09:57Z`. The public site remains open. The interface
and login use the original navy/violet palette with lime reserved for actions
and small state markers. Neutral text, helper labels and control borders are
brighter. Mobile map labels are enlarged. Semantic button variants explicitly
set their foreground so the legacy button reset cannot turn primary labels white.

The final fixture-based browser audit measured 985 desktop/mobile text samples
without remaining contrast failures and checked label bounds for all 43 map nodes
across all six campus groups. No horizontal overflow or runtime errors occurred.
Protected management content was excluded from this palette fixture audit; its
shared tokens and button rules were updated. Production build, targeted button
lint and live homepage/login computed colors passed. No application behavior,
data model or API changed in this update.

Palette rollback: `python3 /home/ubuntu/nodeust-backups/20260910T110047Z-navy-palette/rollback.py`.
This restores the preceding application and gateway build while preserving data
and the current maintenance setting. Earlier architecture backups remain retained.


## Mobile search input

Deployed `2026-09-10T16:03:34Z`. Explore search inputs use 16px text on narrow
viewports and devices whose primary pointer is coarse, covering mobile portrait
and landscape. This removes the small-font trigger for iPhone Safari focus zoom.
Normal desktop inputs remain 13px; pinch zoom is unrestricted.

The production build passed. Chromium browser emulation verified typing, computed
font size and page width in mobile portrait, mobile landscape and desktop views.
Native iPhone keyboard zoom was not tested on a physical device. The deployed
build and public stylesheet were verified, and the site remains open.

Rollback: `python3 /home/ubuntu/nodeust-backups/20260910T155845Z-mobile-search/rollback.py`.
This restores the preceding application build and search stylesheet, preserving
database records, gateway and maintenance settings.
