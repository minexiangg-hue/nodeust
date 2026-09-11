import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

// This runner only reads the disposable replay. Never point it at production.
const base = process.env.NODE_TEST_BASE_URL;
assert.equal(base, 'http://127.0.0.1:3102');
assert.match(new URL(process.env.DATABASE_URL).pathname, /^\/nodeust_matchstudy_[a-f0-9]{8}$/);
assert.ok(process.env.NODE_TRUSTED_PROXY_SECRET, 'Isolated trusted-proxy secret is required');
const out = resolve(process.env.MATCH_EVAL_OUTPUT || 'reports/match-iteration-2026-09-11/iteration-02');
mkdirSync(out, { recursive: true });
const roles = readFileSync(`${out}/roles.jsonl`, 'utf8').trim().split('\n').map(JSON.parse);
const posts = new Map(readFileSync('reports/match-study-2026-09-11/artifacts/posts.jsonl', 'utf8').trim().split('\n').map(line => {
  const post = JSON.parse(line);
  return [post.id, post];
}));
assert.equal(roles.length, 500);
assert.equal(posts.size, 3746);
const kinds = ['hall', 'goods', 'study', 'transport', 'other'];
const representatives = new Map(kinds.map(kind => {
  const role = roles.filter(row => row.high.length > 25 && row.high.some(item => item.kind === kind) && row.possible.length)
    .sort((a, b) => b.high.filter(row => row.kind === kind).length - a.high.filter(row => row.kind === kind).length)[0];
  assert.ok(role, `Missing pagination representative for ${kind}`);
  return [kind, role.studentId];
}));
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/tmp/vis/node_modules/playwright-core/index.mjs');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/home/ubuntu/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell',
  args: ['--no-sandbox'],
});
for (const name of ['browser-log.jsonl', 'browser-interactions.jsonl']) writeFileSync(`${out}/${name}`, '');
const results = [];
const interactions = [];
const started = performance.now();
let cursor = 0;
let completed = 0;
let cancelledResponseBodies = 0;

function responseMatches(response, options = {}) {
  const url = new URL(response.url());
  return url.pathname === '/api/matches' && response.request().method() === 'GET'
    && Number(url.searchParams.get('page') || 0) === (options.page || 0)
    && (url.searchParams.get('kind') || 'all') === (options.kind || 'all')
    && (url.searchParams.get('possible') === '1') === Boolean(options.possible);
}

// A route transition can cancel a fetch after its headers arrive. Consume only
// completed bodies; a cancelled predecessor must not win over the new route fetch.
function waitForJsonResponse(page, predicate) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      page.off('response', listener);
      reject(new Error('Timed out waiting for a completed matching API response'));
    }, 30000);
    const listener = async response => {
      if (!predicate(response)) return;
      try {
        if (await response.finished()) { cancelledResponseBodies++; return; }
        const body = await response.json();
        clearTimeout(timeout);
        page.off('response', listener);
        resolve({ response, body });
      } catch {
        cancelledResponseBodies++;
        // Browser response bodies disappear when their document/fetch is cancelled.
        // The replacement request must still complete within the original timeout.
      }
    };
    page.on('response', listener);
  });
}

async function checkRendered(page, body, expectedIds) {
  assert.equal(body.disabled, undefined);
  if (expectedIds) assert.deepEqual(body.items.map(row => row.id), expectedIds);
  await page.waitForFunction(items => {
    const panel = document.querySelector('.matches-panel');
    const cards = [...document.querySelectorAll('.match-result-card')];
    return panel?.getAttribute('aria-busy') === 'false' && cards.length === items.length && cards.every((card, i) =>
      card.querySelector('.match-post-preview h2')?.textContent === items[i].title
      && card.querySelector('.match-post-preview p')?.textContent === items[i].body
      && card.querySelector('.match-card-actions a')?.getAttribute('href') === `/posts/${encodeURIComponent(items[i].match.ownPostId)}/edit`);
  }, body.items);
  const observed = await page.locator('.match-result-card').evaluateAll(cards => cards.map(card => ({
    title: card.querySelector('.match-post-preview h2')?.textContent,
    body: card.querySelector('.match-post-preview p')?.textContent,
    ownHref: card.querySelector('.match-card-actions a')?.getAttribute('href'),
    confidence: card.classList.contains('match-possible') ? 'possible' : 'high',
    reasonCount: card.querySelectorAll('.match-reasons li').length,
    missingText: card.querySelector('.match-missing p')?.textContent || '',
  })));
  for (let i = 0; i < body.items.length; i++) {
    const item = body.items[i];
    const source = posts.get(item.id);
    assert.ok(source, 'Unexpected post outside the archived synthetic corpus');
    assert.equal(observed[i].title, source.payload.title);
    assert.equal(observed[i].body, source.payload.body);
    assert.equal(observed[i].confidence, item.match.confidence);
    assert.ok(observed[i].reasonCount > 0, 'Visible match must explain its reasons');
    if (item.match.missing.length) assert.ok(observed[i].missingText, 'Missing details must be visible');
  }
  if (body.items.length) assert.equal(await page.locator('.match-results-heading > span').textContent(), `${body.total} results in this view`);
  else await page.locator('.match-empty').waitFor({ state: 'visible' });
  assert.equal(await page.locator('.match-empty[role="alert"]').count(), 0);
  const layout = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth,
    overflowingCards: [...document.querySelectorAll('.match-result-card')].filter(card => {
      const rect = card.getBoundingClientRect();
      return rect.left < -1 || rect.right > innerWidth + 1;
    }).length }));
  assert.ok(layout.document <= layout.viewport + 1, `Horizontal document overflow: ${JSON.stringify(layout)}`);
  assert.equal(layout.overflowingCards, 0);
  return observed;
}

async function fetchAfter(page, action, options, expectedIds) {
  const pending = waitForJsonResponse(page, response => responseMatches(response, options));
  await action();
  const { response, body } = await pending;
  assert.equal(response.status(), 200);
  await checkRendered(page, body, expectedIds);
  return body;
}

async function checkInteractions(page, role, kind) {
  const log = { studentId: role.studentId, kind, checks: [], passed: false };
  const next = () => page.locator('.match-pagination').getByRole('button', { name: 'Next', exact: true }).click();
  let body = await fetchAfter(page, next, { page: 1 }, role.high.slice(25, 50).map(row => row.id));
  assert.equal(body.total, role.high.length);
  log.checks.push('actual-next-page');
  const filtered = role.high.filter(row => row.kind === kind);
  body = await fetchAfter(page, () => page.locator('.match-kind-field select').selectOption(kind), { kind }, filtered.slice(0, 25).map(row => row.id));
  assert.equal(body.total, filtered.length);
  assert.ok(body.items.every(row => row.match.kind === kind));
  log.checks.push('independent-category-and-page-reset');
  await page.screenshot({ path: `${out}/browser-${kind}-${role.studentId}.png`, fullPage: true });

  const detail = body.items[0];
  await page.locator('.match-result-card').first().getByRole('button', { name: 'View request', exact: true }).click();
  await page.waitForURL(`${base}/requests/${encodeURIComponent(detail.id)}`);
  await page.locator('.request-detail-page').getByText(detail.title, { exact: true }).waitFor({ state: 'visible' });
  assert.ok((await page.locator('.request-detail-page').textContent()).includes(detail.body));
  const returned = waitForJsonResponse(page, response => responseMatches(response, { kind }));
  await page.goBack();
  await checkRendered(page, (await returned).body, filtered.slice(0, 25).map(row => row.id));
  log.checks.push('detail-navigation-id-title-body-and-back');

  body = await fetchAfter(page, () => page.locator('.match-kind-field select').selectOption('all'), {}, role.high.slice(0, 25).map(row => row.id));
  body = await fetchAfter(page, () => page.locator('.match-possible-toggle input').check(), { possible: true });
  assert.equal(body.total, role.high.length + role.possible.length);
  assert.equal(body.possibleCount, role.possible.length);
  const all = [...body.items];
  let pageNumber = 0;
  while (body.hasMore) {
    body = await fetchAfter(page, next, { possible: true, page: ++pageNumber });
    all.push(...body.items);
  }
  assert.deepEqual(all.filter(row => row.match.confidence === 'high').map(row => row.id), role.high.map(row => row.id));
  assert.deepEqual(all.filter(row => row.match.confidence === 'possible').map(row => row.id), role.possible.map(row => row.id));
  assert.ok(await page.locator('.match-result-card.match-possible').count() > 0);
  await page.locator('.match-result-card.match-possible').last().scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/browser-${kind}-possible-${role.studentId}.png`, fullPage: true });
  log.checks.push('possible-toggle-actual-pagination-missing-details');
  await fetchAfter(page, () => page.locator('.match-possible-toggle input').uncheck(), {}, role.high.slice(0, 25).map(row => row.id));
  await page.locator('a[href="/explore"]:visible').first().click();
  await page.locator('.search-box input:visible').first().fill('definitely-no-synthetic-result-match-independence');
  // On mobile the matching shortcut is under Me, as in the normal product navigation.
  if (!await page.locator('a[href="/matches"]:visible').count()) {
    await page.locator('.mobile-nav a[href="/profile"]').click();
    await page.locator('a[href="/matches"]:visible').first().waitFor();
  }
  body = await fetchAfter(page, () => page.locator('a[href="/matches"]:visible').first().click(), {}, role.high.slice(0, 25).map(row => row.id));
  assert.equal(body.total, role.high.length);
  log.checks.push('explore-search-does-not-filter-matches');
  log.passed = true;
  interactions.push(log);
  appendFileSync(`${out}/browser-interactions.jsonl`, JSON.stringify(log) + '\n');
}

try {
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (cursor < roles.length) {
      const index = cursor++;
      const role = roles[index];
      const mobile = index % 2 === 0;
      const width = mobile ? 390 : 1440;
      const begin = performance.now();
      const context = await browser.newContext({
        viewport: { width, height: 900 }, hasTouch: mobile, isMobile: mobile,
        extraHTTPHeaders: { 'x-hkust-uid': role.studentId, 'x-hkust-email': `${role.studentId}@connect.ust.hk`, 'x-node-proxy-secret': process.env.NODE_TRUSTED_PROXY_SECRET },
      });
      // UI preference only; all network requests go to the real isolated server.
      await context.addInitScript(() => localStorage.setItem('node:locale', 'en'));
      const page = await context.newPage();
      page.setDefaultTimeout(30000);
      page.setDefaultNavigationTimeout(30000);
      const runtimeErrors = [];
      const httpFailures = [];
      page.on('pageerror', error => runtimeErrors.push(error.message));
      page.on('response', response => {
        if (response.status() >= 400) httpFailures.push({ path: new URL(response.url()).pathname, status: response.status() });
      });
      const result = { studentId: role.studentId, width, passed: false, runtimeErrors, httpFailures };
      try {
        const profilePromise = waitForJsonResponse(page, response => new URL(response.url()).pathname === '/api/profile');
        const matchesPromise = waitForJsonResponse(page, response => responseMatches(response));
        await page.goto(`${base}/matches`, { waitUntil: 'domcontentloaded' });
        const [profileResult, { response, body }] = await Promise.all([profilePromise, matchesPromise]);
        assert.equal(profileResult.body.profile.role, 'member');
        assert.equal(response.status(), 200);
        assert.equal(body.total, role.high.length);
        assert.equal(body.highConfidenceCount, role.high.length);
        assert.equal(body.possibleCount, role.possible.length);
        assert.equal(body.ownPostCount, role.ownIds.length);
        assert.ok(body.items.every(row => row.match.confidence === 'high'));
        assert.equal(await page.locator('.match-possible-toggle input').isChecked(), false);
        result.observed = await checkRendered(page, body, role.high.slice(0, 25).map(row => row.id));
        result.observedIds = body.items.map(row => row.id);
        result.total = body.total;
        result.version = body.version;
        for (const [kind, studentId] of representatives) if (studentId === role.studentId) await checkInteractions(page, role, kind);
        if (index < 2) await page.screenshot({ path: `${out}/browser-${width}-${role.studentId}.png`, fullPage: true });
        assert.deepEqual(runtimeErrors, []);
        assert.deepEqual(httpFailures, []);
        result.passed = true;
      } catch (error) {
        result.error = error.message;
        result.stack = error.stack;
        await page.screenshot({ path: `${out}/browser-failure-${role.studentId}.png`, fullPage: true }).catch(() => {});
        console.error(`Browser failed ${role.studentId}: ${error.message.slice(0, 240)}`);
      } finally {
        result.ms = performance.now() - begin;
        results.push(result);
        appendFileSync(`${out}/browser-log.jsonl`, JSON.stringify(result) + '\n');
        await context.close();
      }
      if (++completed % 50 === 0) console.log(`Browser verified ${completed}/500 roles (${results.filter(row => !row.passed).length} failures)`);
    }
  }));
} finally {
  await browser.close();
}
const summary = {
  roles: results.length, passed: results.filter(row => row.passed).length,
  mobile: results.filter(row => row.width === 390).length, desktop: results.filter(row => row.width === 1440).length,
  failures: results.filter(row => !row.passed).map(row => ({ studentId: row.studentId, error: row.error })),
  representativeInteractions: interactions, totalMs: performance.now() - started,
  renderedFirstPageCards: results.reduce((sum, row) => sum + (row.observed?.length || 0), 0),
  apiErrors: results.reduce((sum, row) => sum + row.httpFailures.length, 0),
  runtimeErrors: results.reduce((sum, row) => sum + row.runtimeErrors.length, 0),
  cancelledResponseBodies, versions: [...new Set(results.map(row => row.version).filter(Boolean))],
  method: 'Real authenticated isolated API; no network mocks. For every role, ordered API IDs are compared with the frozen predictions and each corresponding rendered card is checked against the archived complete title, body, own-post link and confidence; displayed totals and document/card overflow are checked. Representative detail navigation confirms the candidate ID in the actual route. Candidate IDs are not exposed as DOM attributes in this build.',
};
writeFileSync(`${out}/browser-summary.json`, JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
assert.equal(summary.failures.length, 0, 'Real-browser regressions failed');
assert.equal(interactions.length, 5, 'All five category interactions must complete');
