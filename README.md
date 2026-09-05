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

- `app/plaza-app.tsx`: responsive campus-location plaza, location-anchored pop-ups with a persistent visibility toggle, manual non-GPS location tag, working matching/chat/saved sections, search/filtering, posting, announcement board, profile, and Owner console.
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

For planned work, publish a maintenance announcement first. To replace the home page with the lightweight maintenance screen, set `NODE_MAINTENANCE_MODE=true`; `NODE_MAINTENANCE_RETURN` and `NODE_STATUS_URL` customize its return message and optional status link. `/maintenance` always provides a preview. A provider-level outage still requires an independently hosted status page or edge fallback in production.

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
