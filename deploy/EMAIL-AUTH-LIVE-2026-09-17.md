# Independent email authentication deployed

User authorized cutover on 2026-09-17. Public entry: https://nodeust.duckdns.org/register

- Build: `s_N0AgjqzUmDaEED5XFpr`; application code from `873fb0f` (later commits before build only changed documentation).
- Dedicated production database provisioned from an empty schema; no legacy accounts, posts or chats imported. Runtime account is restricted to its own database and DML.
- Latest HTML/plain-text verification and password reset emails included. SMTP authentication passed. Prior test mail reached the administrator's Spam folder; university inbox delivery and actual new-template inbox placement remain for user acceptance.
- Old gateway stopped and disabled; old data retained. Current legacy DB dump and gateway snapshot were saved before switching, in addition to the original preservation bundle.
- Auth core 7 checks, management permissions 22 checks, isolated API 18 checks, mobile 320px and desktop 1440px browser flows, and 4 rollback fixtures passed. External-owner browser login, role and original management-console entry also passed.
- Browser test wording updated from the obsolete university verification label to the current email verification label.
- Live HTTPS login/register/reset-request pages return 200; DB health reachable; unauthenticated forged legacy identity rejected; unauthorized external registration rejected; old gateway login returns 404. No real account was created by deployment tests, and no deployment-test email was sent.
- Users register and verify their own emails. Only the protected configured external Owner email is exempt from university domain restrictions and becomes Owner after verification. The sending mailbox is separate and has no implicit application privileges.
- Management interface and existing posts/chat/matching functions remain in the application. Existing records are intentionally not visible in the new realm. Checks above are not a claim that every business workflow was manually re-tested in production.

## Rollback

```bash
python3 scripts/email-auth/switch-system.py legacy /home/ubuntu/nodeust-backups/20260916T183515Z-before-email-auth
```

This restores the old build, environment and gateway while retaining HTTPS and both
databases. It does not restore a SQL dump or discard new registrations. To return to
the new system use the same command with `email` instead of `legacy`. Do not use a
build-only rollback across authentication systems. The bundle includes protected
`email.env`, `app.env`, both builds and both proxy configurations.
