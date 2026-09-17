// NODE preview sign-in gateway (PREVIEW only).
//
// Stand-in for the future trusted HKUST SSO gateway. For the small internal
// test it issues simple username accounts (no password, no ITSO; the FIRST
// registered username becomes Owner), then reverse-proxies to the NODE app
// injecting the x-hkust-* identity headers that NODE's lib/auth trusts —
// signed by a cookie so identities cannot be forged. Accounts persist in
// ./accounts.json (uid == username == NODE users.identity_id).
//
// When the real HKUST SSO gateway is ready, this service is replaced by it;
// the NODE application itself is unchanged.
//
// Env: GATEWAY_PORT (default 8081), NODE_UPSTREAM_URL (default
// http://127.0.0.1:3000), GATEWAY_SECRET (required; also sent to NODE as
// x-node-proxy-secret so NODE accepts the injected identity).

import { readFile } from 'node:fs/promises';
import { chmodSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';

const PORT = Number(process.env.GATEWAY_PORT ?? 8081);
const UPSTREAM = new URL(
  process.env.NODE_UPSTREAM_URL ?? 'http://127.0.0.1:3000',
);
const SECRET = process.env.GATEWAY_SECRET;
if (!SECRET) throw new Error('GATEWAY_SECRET is required.');

const COOKIE_NAME = 'nodeust_preview_session';
const MAX_AGE = 60 * 60 * 24; // 24h preview session

const ACCOUNTS_FILE = new URL('./accounts.json', import.meta.url);
const USERNAME_RE = /^[A-Za-z0-9_-]{2,20}$/;
const HKUST_EMAIL = '@connect.ust.hk';

// accounts: Map<foldedUsername, { username, role, createdAt }>
const accounts = await loadAccounts();

async function loadAccounts() {
  try {
    const parsed = JSON.parse(await readFile(ACCOUNTS_FILE, 'utf8'));
    const list = Array.isArray(parsed?.accounts) ? parsed.accounts : [];
    return new Map(list.map((a) => [a.username.toLowerCase(), a]));
  } catch {
    return new Map();
  }
}

function saveAccounts() {
  const payload = { accounts: [...accounts.values()] };
  writeFileSync(ACCOUNTS_FILE, JSON.stringify(payload, null, 2) + '\n');
  chmodSync(ACCOUNTS_FILE, 0o600);
}

// Derive the identity that proxyRequest injects (uid == username == identity_id).
function toIdentity(account) {
  return {
    uid: account.username,
    email: `${account.username.toLowerCase()}${HKUST_EMAIL}`,
    affiliation: 'student',
    fullName: account.username,
    role: account.role,
  };
}

// ---------------------------------------------------------------- signing

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${mac}`;
}

function readSession(req) {
  const header = req.headers.cookie;
  if (!header) return null;
  const token = header
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);
  if (!token) return null;
  const [body, mac] = token.split('.');
  if (!body || !mac) return null;
  const expect = createHmac('sha256', SECRET).update(body).digest('base64url');
  const a = Buffer.from(expect);
  const b = Buffer.from(mac);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (Date.now() > payload.exp) return null;
    const account = accounts.get(String(payload.uid ?? '').toLowerCase());
    if (!account) return null;
    return toIdentity(account);
  } catch {
    return null;
  }
}

function setSession(res, identity, redirectTo) {
  const payload = {
    uid: identity.uid,
    exp: Date.now() + MAX_AGE * 1000,
  };
  res.setHeader(
    'set-cookie',
    `${COOKIE_NAME}=${sign(payload)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}`,
  );
  res.writeHead(303, { location: redirectTo });
  res.end();
}

function clearSession(res) {
  res.setHeader(
    'set-cookie',
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  );
}

// ------------------------------------------------------------------ pages

const PAGE_CSS = `
  :root { color-scheme: dark; font-synthesis: none; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; min-height: 100svh; background: #121429; color: #f4f6ff;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    -webkit-font-smoothing: antialiased; }
  main { width: min(100% - 40px, 500px); margin: 0 auto; padding: 44px 0 32px; }
  a { color: inherit; text-decoration: none; }
  a:hover { color: #b6ff75; }
  a:focus-visible, summary:focus-visible { outline: 2px solid #b6ff75; outline-offset: 5px; border-radius: 4px; }
  .page-header { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 28px; }
  .brand { display: inline-flex; align-items: center; gap: 10px; }
  .brand .dot { width: 28px; height: 28px; border: 1px solid #8894c6; border-radius: 9px; position: relative; }
  .brand .dot:before { content: ""; position: absolute; width: 10px; height: 10px; top: 8px; left: 8px;
    border-radius: 50%; background: #b6ff75; }
  .brand-name { font-size: 20px; font-weight: 650; letter-spacing: -.7px; }
  .home-link { font-size: 12px; color: #bcc5df; display: inline-flex; align-items: center; gap: 7px; }
  .auth-panel { background: #1c213b; border: 1px solid #384262; border-radius: 24px; padding: 34px;
    box-shadow: 0 18px 52px rgba(0,0,0,.14); }
  .eyebrow { margin: 0 0 12px; color: #b6ff75; font-size: 10px; letter-spacing: 1.5px; font-weight: 650; }
  h1 { font-size: clamp(28px, 6vw, 36px); line-height: 1.18; letter-spacing: -1.4px; font-weight: 550; margin: 0; }
  .intro { margin: 12px 0 24px; color: #bcc5df; font-size: 14px; line-height: 1.65; }
  .note { margin: 0; padding: 14px 16px; border: 1px solid #414c70; border-radius: 12px; background: #222943;
    color: #bcc5df; font-size: 12px; line-height: 1.7; }
  .note b { color: #f4f6ff; font-weight: 550; }
  .card { margin-top: 26px; }
  .kicker { margin: 0 0 12px; color: #f4f6ff; font-size: 13px; font-weight: 600; }
  label { display: block; margin-bottom: 8px; color: #d6def3; font-size: 12px; }
  input[type=text] { display: block; width: 100%; min-height: 48px; padding: 0 14px; border: 1px solid #626f98;
    border-radius: 10px; background: #151a30; color: #f4f6ff; outline: none; font: inherit; font-size: 16px; }
  input[type=text]:focus { border-color: #b6ff75; box-shadow: 0 0 0 3px rgba(182,255,117,.12); }
  input[type=text]::placeholder { color: #aab5d2; }
  input:-webkit-autofill { -webkit-text-fill-color: #f4f6ff; box-shadow: 0 0 0 40px #151a30 inset; }
  .field-hint { margin: 8px 0 0; color: #aab5d2; font-size: 11px; line-height: 1.6; }
  button { width: 100%; min-height: 48px; margin-top: 13px; padding: 12px 16px; border: 1px solid transparent;
    border-radius: 10px; background: #b6ff75; color: #12162c; font: inherit; font-size: 14px; font-weight: 650;
    cursor: pointer; transition: background .16s ease, border-color .16s ease; }
  button:hover { background: #caff99; }
  button:focus-visible { outline: 2px solid #b6ff75; outline-offset: 4px; }
  button.secondary { background: transparent; border-color: #626f98; color: #f4f6ff; }
  button.secondary:hover { background: #2a3150; border-color: #8894c6; }
  .register-card { border-top: 1px solid #384262; margin-top: 28px; padding-top: 24px; }
  .who { margin: 18px 0 0; padding: 10px 14px; border-radius: 10px; color: #c0eac3; background: #24392b; font-size: 12px; }
  .err { margin-top: 18px; padding: 12px 14px; border: 1px solid #6a4b3b; border-radius: 10px;
    color: #f3c1a2; background: #30261e; font-size: 12px; line-height: 1.65; }
  .err small { display: block; color: #dbbbaa; font-size: 12px; margin-top: 5px; }
  .preview-details { margin-top: 25px; padding-top: 18px; border-top: 1px solid #384262; }
  summary { width: fit-content; color: #bcc5df; font-size: 11px; line-height: 1.6; cursor: pointer; }
  .foot { margin-top: 12px; color: #aab5d2; font-size: 11px; line-height: 1.75; }
  code { padding: 1px 4px; border-radius: 4px; background: #2a3150; color: #d6def3; font-size: 10px; }
  .page-footer { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 20px;
    color: #aab5d2; font-size: 11px; line-height: 1.6; }
  .page-footer > span { font-size: 10px; letter-spacing: .7px; }
  @media (max-width: 480px) {
    main { width: min(100% - 28px, 500px); padding-top: 24px; padding-bottom: 24px; }
    .page-header { margin: 0 5px 22px; }
    .auth-panel { border-radius: 20px; padding: 26px 23px; }
    .intro { font-size: 13px; }
    .note { padding: 12px 13px; }
    .page-footer { margin: 18px 5px 0; }
  }
  @media (prefers-reduced-motion: reduce) { button { transition: none; } }
`;

const ERROR_TEXT = {
  unknown: ['That username is not registered. Sign in with your own, or register below.', '该用户名未注册，请在下方注册，或改用你自己的用户名登录。'],
  taken: ['That username is already taken — pick another or sign in above.', '该用户名已被占用，请换一个，或用上方表单直接登录。'],
  format: ['Usernames are 2–20 letters, numbers, _ or -.', '用户名需为 2–20 位字母、数字、下划线或短横线。'],
};

function loginPage({ out = false, error = '', next = '/explore' } = {}) {
  const err = ERROR_TEXT[error] ?? null;
  const returnPath = escapeHtml(safeNext(next));
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>NODE · sign in</title><style>${PAGE_CSS}</style></head>
<body><main>
  <header class="page-header">
    <a class="brand" href="/" aria-label="NODE home"><span class="dot" aria-hidden="true"></span><span class="brand-name">NODE</span></a>
    <a class="home-link" href="/">Back to home <span aria-hidden="true">↗</span></a>
  </header>
  <section class="auth-panel" aria-labelledby="signin-title">
  <p class="eyebrow">YOUR CAMPUS, CONNECTED</p>
  <h1 id="signin-title">Welcome to NODE.</h1>
  <p class="intro">A shared campus. A place to connect.<br />登录或创建账号，开始你的校园连接。</p>
  <p class="note">This preview uses a simple username in place of the future HKUST SSO.
  <b>No password.</b> The first username registered becomes the Owner. Your posts
  stay anonymous — usernames are only your sign-in handle.</p>
  ${out ? '<p class="who" role="status">Signed out. · 已退出登录。</p>' : ''}
  ${err ? `<div class="err" role="alert">${err[0]}<small>${err[1]}</small></div>` : ''}

  <form class="card" method="post" action="/__gateway/auth">
    <div class="kicker">Sign in · 登录</div>
    <label for="signin-username">Username · 用户名</label>
    <input type="text" id="signin-username" name="username" required minlength="2" maxlength="20"
           pattern="[A-Za-z0-9_-]+" placeholder="Your username" autocomplete="username" autocapitalize="none" spellcheck="false" />
    <input type="hidden" name="next" value="${returnPath}" />
    <button type="submit">Continue · 继续</button>
  </form>

  <form class="card register-card" method="post" action="/__gateway/register">
    <div class="kicker">New here? · 首次使用</div>
    <label for="register-username">Choose a username · 创建用户名</label>
    <input type="text" id="register-username" name="username" required minlength="2" maxlength="20"
           pattern="[A-Za-z0-9_-]+" placeholder="New username" autocomplete="username" autocapitalize="none" spellcheck="false"
           aria-describedby="username-help" />
    <p class="field-hint" id="username-help">2–20 letters, numbers, _ or - · 2–20 位字母、数字、_ 或 -</p>
    <input type="hidden" name="next" value="${returnPath}" />
    <button type="submit" class="secondary">Create account · 创建账号</button>
  </form>

  <details class="preview-details">
  <summary>About this preview · 关于内测</summary>
  <div class="foot">Open registration — the very first account is the Owner. Use two browser
  profiles to act as two users and switch via <code>/__gateway/logout</code>. Preview build:
  HTTP only, fake login, throwaway MySQL data.</div>
  </details>
  </section>
  <footer class="page-footer"><a href="/rules">Community rules · 社群规则</a><span>HKUST COMMUNITY · BETA</span></footer>
</main></body></html>`;
}

// ------------------------------------------------------------ reverse proxy

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);
const STRIP_INBOUND = new Set([
  'x-hkust-uid',
  'x-hkust-email',
  'x-hkust-affiliation',
  'x-hkust-full-name',
  'x-node-role',
  'x-node-proxy-secret',
]);

function proxyRequest(identity, req, res) {
  const headers = {};
  for (const [name, value] of Object.entries(req.headers)) {
    const lower = name.toLowerCase();
    if (HOP_BY_HOP.has(lower)) continue;
    if (lower === 'host') continue; // reset below
    if (STRIP_INBOUND.has(lower)) continue;
    headers[name] = value;
  }
  headers.host = req.headers.host ?? `${UPSTREAM.host}`;
  headers['x-forwarded-for'] =
    (req.headers['x-forwarded-for']
      ? `${req.headers['x-forwarded-for']}, `
      : '') + (req.socket.remoteAddress ?? '');
  headers['x-forwarded-proto'] = 'http';

  // Public pages use the same proxy with no trusted identity. Inbound identity
  // headers have already been stripped above, including for anonymous requests.
  if (identity) {
    headers['x-hkust-uid'] = identity.uid;
    headers['x-hkust-email'] = identity.email;
    headers['x-hkust-affiliation'] = identity.affiliation;
    headers['x-hkust-full-name'] = identity.fullName;
    if (identity.role === 'owner') headers['x-node-role'] = 'owner';
    headers['x-node-proxy-secret'] = SECRET;
  }

  const outReq = http.request(
    {
      hostname: UPSTREAM.hostname,
      port: UPSTREAM.port,
      path: req.url,
      method: req.method,
      headers,
    },
    (outRes) => {
      const outHeaders = { ...outRes.headers };
      for (const name of Object.keys(outHeaders)) {
        if (HOP_BY_HOP.has(name.toLowerCase())) delete outHeaders[name];
      }
      res.writeHead(outRes.statusCode ?? 502, outHeaders);
      outRes.pipe(res);
    },
  );
  outReq.on('error', (err) => {
    if (!res.headersSent) {
      res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Gateway cannot reach the NODE upstream.');
    } else {
      res.destroy();
    }
    console.error('[gateway] upstream error', err.message);
  });
  req.pipe(outReq);
}

// ------------------------------------------------------------------ server

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://local');
  const path = url.pathname;
  const session = readSession(req);

  try {
    if (path === '/__gateway/login') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(
        loginPage({
          out: url.searchParams.get('out') === '1',
          error: url.searchParams.get('error') ?? '',
          next: safeNext(url.searchParams.get('next')),
        }),
      );
      return;
    }
    if (path === '/__gateway/auth' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        const form = new URLSearchParams(body);
        const name = (form.get('username') ?? '').trim();
        const next = safeNext(form.get('next'));
        const account = accounts.get(name.toLowerCase());
        if (!name || !account) {
          res.writeHead(302, { location: loginUrl(next, 'unknown') });
          res.end();
          return;
        }
        setSession(res, toIdentity(account), next);
      });
      return;
    }
    if (path === '/__gateway/register' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        const form = new URLSearchParams(body);
        const name = (form.get('username') ?? '').trim();
        const next = safeNext(form.get('next'));
        if (!USERNAME_RE.test(name)) {
          res.writeHead(302, { location: loginUrl(next, 'format') });
          res.end();
          return;
        }
        const folded = name.toLowerCase();
        if (accounts.has(folded)) {
          res.writeHead(302, { location: loginUrl(next, 'taken') });
          res.end();
          return;
        }
        const account = {
          username: name, // canonical casing kept
          role: accounts.size === 0 ? 'owner' : 'member',
          createdAt: new Date().toISOString(),
        };
        accounts.set(folded, account);
        saveAccounts();
        setSession(res, toIdentity(account), next);
      });
      return;
    }
    if (path === '/__gateway/logout') {
      clearSession(res);
      res.writeHead(302, { location: '/__gateway/login?out=1' });
      res.end();
      return;
    }
    if (path.startsWith('/__gateway/')) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Not found.');
      return;
    }

    // Let Next render the public welcome, rules and maintenance pages, plus
    // their CSS, JavaScript and images. Mutation/API requests still need a session.
    if (
      (req.method === 'GET' || req.method === 'HEAD') &&
      isPublicPath(path)
    ) {
      proxyRequest(session, req, res);
      return;
    }

    if (!session) {
      const wantsHtml = (req.headers.accept ?? '').includes('text/html');
      if (wantsHtml && req.method === 'GET') {
        res.writeHead(302, {
          location: loginUrl(safeNext(`${url.pathname}${url.search}`)),
        });
        res.end();
      } else {
        res.writeHead(401, { 'content-type': 'application/json' });
        res.end('{"error":"未登录。"}');
      }
      return;
    }

    proxyRequest(session, req, res);
  } catch (err) {
    console.error('[gateway] request error', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Gateway error.');
    }
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(
    `[gateway] NODE preview sign-in listening on http://127.0.0.1:${PORT} → ${UPSTREAM.href}`,
  );
});

function isPublicPath(path) {
  return (
    ['/', '/rules', '/maintenance', '/favicon.svg', '/favicon.ico', '/node-brand-icon.png'].includes(path) ||
    path.startsWith('/_next/static/') ||
    path === '/_next/image'
  );
}

function loginUrl(next, error) {
  const query = new URLSearchParams({ next: safeNext(next) });
  if (error) query.set('error', error);
  return `/__gateway/login?${query}`;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function safeNext(value) {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes(String.fromCharCode(92)) ||
    [...value].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
  ) return '/explore';
  try {
    const target = new URL(value, 'http://local');
    if (target.origin !== 'http://local' || target.pathname.startsWith('/__gateway/'))
      return '/explore';
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return '/explore';
  }
}
