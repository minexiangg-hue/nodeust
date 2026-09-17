# Independent university-email accounts

Default mode remains `legacy` until an explicit, fully configured cutover. Email
mode accepts exact `connect.ust.hk` and `ust.hk` domains for ordinary members.
The exact configured `NODE_EMAIL_OWNER_EMAIL` is the sole exception and may use
an external domain; no domain-wide or plus-address alias exception is granted. It normalizes email
case, and requires a one-use 24-hour emailed link plus the registration password
before activation. It is not HKUST SSO. Verification GET requests do not change
account state. Login uses email/password; reset links expire in 30 minutes and
invalidate all sessions when consumed. Sessions expire after seven days.

## Isolation and preservation

- `DATABASE_URL` remains the original database. `NODE_EMAIL_DATABASE_URL` must
  identify a different `nodeust_email_*` schema and a different restricted DB user.
- A fresh new database contains its own users, posts, chats and auth tables. No
  legacy account or business row is imported, even when an email looks identical.
- Email mode accepts only its opaque server-side session cookie. Legacy headers,
  gateway roles and the old preview cookie cannot authenticate it.
- New user records are created only inside successful verification transactions.
  Their identities use new UUIDs. The first user is a member, never an automatic
  Owner. Only the configured `NODE_EMAIL_OWNER_EMAIL` (including an explicitly designated
  external address), after verification, becomes
  Owner. Configure it before registrations; changing it later does not silently
  promote an already-existing account.
- Local drafts/preferences/saved items use the new identity namespace. Legacy
  browser storage is retained unchanged for rollback.
- Before cutover, back up old SQL, `.env.local`, full `.next`, the complete
  `nodeust-gateway` directory (including `accounts.json`), gateway/app service
  definitions and the NODE nginx vhost. Protect the bundle with mode 0700.

The current preservation bundle is
`/home/ubuntu/nodeust-backups/20260916T183515Z-before-email-auth`.
It contains the running matching-v5 program and old account/data/configuration
snapshots. **No authentication-system cutover has happened.** On 2026-09-17 the
user explicitly authorized production HTTPS and SMTP configuration. HTTPS is now
active with a valid Let’s Encrypt certificate; the old gateway remains in use.
See `HTTPS-2026-09-17.md`. SMTP authorization and delivery remain pending.

## Production prerequisites

1. Configure a usable SMTP sender in a protected env file: `NODE_EMAIL_FROM`,
   `NODE_EMAIL_SMTP_HOST`, `NODE_EMAIL_SMTP_PORT` (465 or 587),
   `NODE_EMAIL_SMTP_USER`, `NODE_EMAIL_SMTP_PASSWORD`. Sending requires TLS and
   normal certificate validation. No credentials belong in Git or chat.
2. Specify `NODE_EMAIL_OWNER_EMAIL` and `NODE_EMAIL_ORIGIN` (canonical HTTPS URL).
   Provision a valid certificate for `nodeust.duckdns.org` and verify renewal.
   The existing HTTP/self-signed redirect setup is insufficient for password login.
3. Create a completely new production schema, never run these auth SQL statements
   against the old database:

   ```bash
   node --experimental-strip-types --env-file=/protected/mail-and-owner.env scripts/email-auth/provision.mjs /home/ubuntu/nodeust-backups/NEW-BUNDLE/new-db.env
   ```

   The provisioner applies existing application migrations to the empty new schema,
   then `db/email-auth.sql`. It subsequently restricts the runtime user to
   SELECT/INSERT/UPDATE/DELETE. The credential file is written before migration so
   a partial failure can be recovered; do not rerun blindly or delete either DB.
4. Compose a protected `email.env` in the preservation bundle. Preserve the old
   `DATABASE_URL` for legacy mode, add the fresh `NODE_EMAIL_DATABASE_URL` and rate
   secret, SMTP settings, canonical origin and Owner email; set `NODE_AUTH_MODE=email`,
   `NODE_EMAIL_TEST_MODE=false`, `NODE_EMAIL_MAIL_TRANSPORT=smtp`.
   Preserve existing app flags and bind the server to 127.0.0.1:3000.
5. Put a tested complete email-enabled `.next` under `candidate-next` in the bundle.
   Use `deploy/nginx-nodeust-email.conf.example` for `email-nginx.conf` and
   `deploy/nginx-nodeust-legacy-tls.conf.example` for `legacy-nginx.conf` (review
   certificate paths). The latter preserves HTTPS while restoring the old gateway.
   Keep the original saved `nginx.conf`, `app.env`, and `previous-next` intact.
6. Run readiness checks. SMTP verification opens a connection but sends no email:

   ```bash
   python3 scripts/email-auth/switch-system.py email /absolute/bundle --check
   ```

   Next validate the certificate/configuration and perform one explicitly
   authorized real delivery test. Actual university inbox receipt, expiry and
   resend behavior still need to be accepted; file-transport tests do not prove
   deliverability or SMTP-provider anti-spam acceptance.

## Cutover and rollback

```bash
python3 scripts/email-auth/switch-system.py email /absolute/bundle
python3 scripts/email-auth/switch-system.py legacy /absolute/bundle
```

The coordinated switcher validates the build and production settings, preserves
current configuration/build, tests nginx configuration, changes the app environment,
starts the selected app, checks DB health, and reloads the proxy. It stops and
disables the preview gateway in email mode; legacy mode starts/enables it. On a
failure it restores previous build, environment, proxy and gateway state. It does
not restore a SQL dump or delete/import either realm. **New-system users/data stay
in the new DB when returning to the old system, and vice versa.**

For rollback across authentication systems, do not merely switch `.next`. The
ordinary release switcher rejects an old build without email auth routes while
email mode is active. Within the same auth system, normal matching-only iteration
and code release rollback remain available. Production nginx/certificate and real
mail delivery checks remain necessary; fixture rollback tests do not replace them.

Application migration configuration also selects the dedicated email database when
`NODE_AUTH_MODE=email`. Never run migrations with the wrong env file. Auth tables
are maintained by `db/email-auth.sql` and explicit reviewed follow-up migrations;
do not use schema-push tools to drop tables absent from the application ORM model.

## Tests and upkeep

```bash
node --experimental-strip-types --test scripts/email-auth/core.test.mjs
node scripts/email-auth/setup-test.mjs
node --env-file=/tmp/nodeust-email-auth-test.env /path/to/test-build/.next/standalone/server.js
node --env-file=/tmp/nodeust-email-auth-test.env scripts/email-auth/integration.mjs
node --env-file=/tmp/nodeust-email-auth-test.env scripts/email-auth/browser.mjs
python3 -B scripts/email-auth/switch-test.py
```

The test transport writes mode-0600 messages only under an explicitly configured
`/tmp/nodeust-email-*` directory. It requires a loopback origin and a test-only
schema. It is rejected by production preflight. Tests use synthetic identities and
never deliver real email. Test database setup refuses to overwrite existing state.
Browser tests use the locally installed Playwright/Chromium paths documented in the
runner; install or adjust them on a different machine.

Run `node --experimental-strip-types --env-file=/protected/email.env
scripts/email-auth/cleanup.mjs` periodically to remove expired tokens/sessions/rate
buckets and pending registrations untouched for 30 days. It never removes verified
accounts or business data. Account/address/IP/global rate limits protect expensive
hashing and email delivery; tune them for actual campus NAT traffic before a larger
rollout. Configure monitoring without logging passwords, raw links or cookies.

Password storage uses salted scrypt (N=2^17, r=8, p=1), following the
[OWASP password storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
One-use expiring reset tokens follow the
[OWASP reset guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).
SMTP uses [Nodemailer's TLS transport](https://nodemailer.com/smtp).

The designated external Owner is saved in the protected preservation bundle as
`owner-pending.env`. Merge it into the future `email.env` before provisioning;
it is not an SMTP sender configuration and does not activate production auth.
