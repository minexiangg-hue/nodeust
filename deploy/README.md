# Tencent Cloud deployment handoff

This branch targets an existing Ubuntu 24.04 server with MySQL and Nginx. It
does not install, remove, or reconfigure those services automatically.

## 1. Prepare MySQL

Create a dedicated database and least-privilege application account. Do not use
the MySQL root account in `DATABASE_URL`.

```sql
CREATE DATABASE nodeust CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER 'nodeust'@'127.0.0.1' IDENTIFIED BY 'replace-with-a-long-password';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES
  ON nodeust.* TO 'nodeust'@'127.0.0.1';
FLUSH PRIVILEGES;
```

If the installed MySQL version does not support `utf8mb4_0900_ai_ci`, use
`utf8mb4_unicode_ci`.

## 2. Install and build the application

Install Node.js 22 LTS and npm from a trusted distribution, then clone the
repository into `/opt/nodeust`. Create `/etc/nodeust/nodeust.env` from
`.env.example`; make it readable only by root and the `nodeust` service group.

```bash
npm ci
npm run db:migrate
npm run build
```

The build produces `.next/standalone/server.js` plus the static assets it needs.

## 3. Register the service

Copy `deploy/nodeust.service.example` to
`/etc/systemd/system/nodeust.service`, review the paths and service account,
then enable it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now nodeust
sudo systemctl status nodeust
curl --fail http://127.0.0.1:3000/api/health
```

NODE listens only on `127.0.0.1:3000`; do not expose that port in the Tencent
Cloud firewall.

## 4. Connect Nginx and HTTPS

Copy `deploy/nginx-nodeust.conf.example` into the existing Nginx configuration,
replace `node.example.com`, and provision the certificate before enabling the
443 server. Test with `sudo nginx -t` before reloading Nginx.

The example intentionally clears all public `X-HKUST-*` identity headers.
Production sign-in requires a trusted CAS/OIDC gateway that authenticates the
user, injects verified attributes, and provides the matching proxy secret.

## 5. Back up and update

Back up MySQL with the server's existing backup policy before every migration.
For updates, fetch the reviewed branch, run `npm ci`, apply migrations, build,
and restart the systemd service. Keep the previous release directory until the
health check passes so rollback is immediate.
