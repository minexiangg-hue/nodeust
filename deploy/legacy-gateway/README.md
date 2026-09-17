# Legacy preview registration gateway

This is the complete source snapshot of the previous username-only preview login
service, preserved for rollback. It is not university SSO or email verification.
Its first registered username becomes Owner; it must only be used as the original
preview system, never as the new email authentication service.

Runtime location on the existing server: `/home/ubuntu/nodeust-gateway/server.mjs`.
The live service has been stopped and disabled since email-authentication cutover.
Copying this source into Git does not change the service or activate old login.

`accounts.json`, `identities.json`, `gateway.env`, database contents and signing
secrets are deliberately excluded. They remain in protected server storage and
backups. Do not start this gateway with an empty account file to restore existing
users; recover the original account file and matching legacy app/database config.

The old `../gateway-routing.patch` is historical; this source already includes it.
For coordinated switching see [authentication systems](../AUTH-SYSTEMS.md).
