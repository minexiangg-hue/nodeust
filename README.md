# NODE

NODE is an HKUST-only anonymous exchange community. It uses a segmented campus-location plaza instead of a conventional feed and supports housing matching, item exchange, study help, other campus needs, anonymous chat, mutual contact reveal, announcements, reporting, and moderation.

## Run locally

Requirements: Node.js 22.13 or newer and MySQL 8.

```bash
npm ci
cp .env.example .env.local
npm run db:migrate
npm run dev
```

Set a development MySQL `DATABASE_URL` in `.env.local`, then open `http://localhost:3000`. Development mode uses a clearly marked local Owner identity. Interface demo records are representative fixtures and are labelled `DEMO` in the UI and in location counts.

## Architecture

- `app/(community)/`: real App Router pages for the welcome home, exploration, matches, inbox/conversations, request details, posts/editor, saved requests, profile, settings, announcements and moderation. The shared layout enforces maintenance and the identity boundary.
- `app/plaza-app.tsx`: persistent community shell and shared data/navigation state. Map filters, form caches, preferences and unread indicators survive navigation between member pages.
- `components/community/`: independent welcome, settings, post editor, chat, profile, announcements and request presentation modules. Ordinary pages use document headings; only short contextual tasks retain dialogs/sheets.
- `app/community-shell.css` and `app/community-pages.css`: shared responsive navigation and page design.
- `app/api/`: MySQL-backed posts, announcements, reports, conversations/messages, private profile, mutual contact exchange, moderation, and health endpoints.
- `db/schema.ts`: users, private profiles, posts, announcements, conversations, messages, contact consent, reports, and auditable moderation actions.
- `drizzle-mysql/`: append-only MySQL migrations.
- `lib/auth.ts`: authentication boundary. Local development returns a demo Owner; production accepts identity headers only when accompanied by the secret of a trusted HKUST SSO gateway.
- `lib/content-policy.ts`: explicit prohibited-content taxonomy plus pre-publication safety checks.
- `lib/campus-locations.ts`: shared location registry for UG/PG/staff housing, academic core, Lee Shau Kee Campus, and campus-life areas.
- `app/rules/page.tsx`: user-facing community standard and enforcement policy.
- `deploy/`: reviewed examples for the existing Ubuntu, systemd, Nginx, and MySQL environment.

English is the default interface language and new automatic anonymous aliases are generated in English. Simplified and Traditional Chinese remain available from the language switcher.

## Announcements and maintenance

Owners, administrators, and moderators can publish information, maintenance, or upgrade notices from the moderation console. Published notices appear in the plaza announcement board and can be scheduled with database start/end times through the API.

For planned work, publish a maintenance announcement first. To replace the welcome and member pages with the lightweight maintenance screen, set `NODE_MAINTENANCE_MODE=true`; `NODE_MAINTENANCE_RETURN` and `NODE_STATUS_URL` customize its return message and optional status link. `/maintenance` always provides a preview. A provider-level outage still requires an independently hosted status page or edge fallback in production.

## HKUST SSO production handoff

1. Register the application with HKUST ITSO for CAS or OIDC and provide an HTTPS test/production callback URL.
2. Configure a trusted server-side gateway to complete SSO, validate issuer/audience/state/nonce, and remove any client-supplied `x-hkust-*` headers.
3. After validation, the gateway may set `x-hkust-uid`, `x-hkust-email`, `x-hkust-affiliation`, and `x-hkust-full-name` for the application. It must also send `x-node-proxy-secret`.
4. Set `HKUST_SSO_START_URL`, `NODE_TRUSTED_PROXY_SECRET`, and `NODE_OWNER_EMAIL` in the service environment.
5. Keep the site private until ITSO test approval and a privacy/security review are complete.

Never collect an ITSO password inside NODE. The application must redirect to HKUST's own authentication screen.

## Privacy and moderation defaults

- Real name, ITSO email, affiliation, department, programme, year, bio, and chosen contact method are private by default.
- Other users see only the stable anonymous alias. Contact details are returned only after both conversation participants consent.
- The first verified account becomes Owner. Owners can appoint moderators; moderation actions are recorded.
- Hall-place trading, unauthorized private swapping, illegal content, fraud, harassment, hate, sexual content, privacy leaks, spam, and unapproved advertising are prohibited.
- NODE only helps users find a swapping partner. Every room/hall change must be completed through the official SHRLO process.

## Checks

```bash
npm run build
npm run check:backend # with the local dev server running
npm run check:health  # with the local dev server running
npx oxlint app lib db
npx tsc --noEmit
```

For the Ubuntu 24.04 production handoff, follow `deploy/README.md`. NODE binds to `127.0.0.1:3000`; the existing Nginx instance owns the public domain and TLS connection.

## Private account statistics

Owner can open `/owner/stats` directly; it is not linked from the main interface.
Other roles receive a not-found page. Each page request reads aggregate counts
from the existing MySQL users table; no tracking scripts or schema changes are
required. The page shows cumulative accounts, new accounts today / over 7 and
30 calendar days, account status counts, and a 30-day trend in Hong Kong time.
Known `local-demo-owner` and `node-smoke-*` test identities are reported separately.
Counts reflect first creation of a NODE profile, not gateway-only registrations,
page views, unique visitors, online presence, or unique real people. Manually
created test identities are not automatically excluded.

## Page routes and preferences

The public home is `/`; the campus map/list is `/explore`. Personal routes are
`/matches`, `/messages`, `/saved`, `/posts`, `/profile` and `/settings`.
A request has `/requests/[id]`; publishing uses `/posts/new` and editing uses
`/posts/[id]/edit`. `/messages/[id]` loads its own authorized conversation metadata
without depending on the inbox's result window. `/announcements` holds the
collapsed notice board and recent activity; `/moderation` requires a moderator,
admin or Owner account. `/owner/stats` remains hidden and Owner-only.

Language and manual location follow the account. Map pop-ups, the default view
and saved requests remain browser preferences. The current exploration state
survives navigation and refresh within the tab. Drafts remain browser-local and
account-scoped; their URLs contain only a draft ID. Unsaved editor input survives
member-page navigation, while saving a draft provides persistence after reload.

The existing preview gateway lives outside this repository. The reviewed
`deploy/gateway-routing.patch` adds the public welcome and assets, preserves
login return paths and updates its login presentation. The public sign-in link
uses that gateway's `/__gateway/login?next=/explore`. Authentication remains the
existing preview mechanism; the future SSO handoff remains a separate task.

See `docs/architecture-rearrange.md` for the route map, verified backup and rollout.

## Transport and current matching scope

Transport is available in posting, editing, drafts, exploration filters and
request displays. Apply `0003_add_transport_category.sql` through the normal
migration runner before deploying this version; it appends the MySQL enum value.

Matching still means exact reciprocal housing fields within the latest 100-post
feed. Adding Transport does not implement transport matching. The shared baseline
is in `lib/matching.ts`; the 500-student / 3,746-post evaluation and proposed
improvements are documented in [the match study](reports/match-study-2026-09-11/report.md).
See [reproduction instructions](scripts/match-study/README.md) for isolated tests.
