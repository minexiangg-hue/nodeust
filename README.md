# NODE

NODE is a local-first MVP for an HKUST-only anonymous exchange community. It uses a segmented campus-location plaza instead of a conventional feed and supports housing matching, item exchange, study help, other campus needs, anonymous chat, mutual contact reveal, reporting, and moderation.

## Run locally

Requirements: Node.js 22.13 or newer.

```bash
npm install
npm run db:generate
npx wrangler d1 migrations apply site-creator-d1 --local --config wrangler.local.jsonc
npm run dev
```

Open `http://localhost:3000`. Development mode uses a clearly marked local Owner identity. Product records are stored in the local D1 database under `.wrangler/`; interface demo records are representative fixtures and are labelled `DEMO` in the UI and in location counts.

## Architecture

- `app/plaza-app.tsx`: responsive campus-location plaza, manual non-GPS location tag, working matching/chat/saved sections, search/filtering, posting, profile, and Owner console.
- `app/api/`: D1-backed posts, reports, conversations/messages, private profile, mutual contact exchange, and moderation endpoints.
- `db/schema.ts`: users, private profiles, posts, conversations, messages, contact consent, reports, and auditable moderation actions.
- `drizzle/`: append-only D1 migrations.
- `lib/auth.ts`: authentication boundary. Local development returns a demo Owner; production accepts only identity headers written by a trusted HKUST SSO gateway.
- `lib/content-policy.ts`: explicit prohibited-content taxonomy plus pre-publication safety checks.
- `lib/campus-locations.ts`: shared location registry for UG/PG/staff housing, academic core, Lee Shau Kee Campus, and campus-life areas.
- `app/rules/page.tsx`: user-facing community standard and enforcement policy.

## HKUST SSO production handoff

1. Register the application with HKUST ITSO for CAS or OIDC and provide an HTTPS test/production callback URL.
2. Configure a trusted server-side gateway to complete SSO, validate issuer/audience/state/nonce, and remove any client-supplied `x-hkust-*` headers.
3. After validation, the gateway may set `x-hkust-uid`, `x-hkust-email`, `x-hkust-affiliation`, and `x-hkust-full-name` for the application.
4. Set `HKUST_SSO_START_URL` to the gateway login endpoint and `NODE_OWNER_EMAIL` to the founding Owner's verified HKUST address.
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
npx oxlint app lib db
npx tsc --noEmit
```
