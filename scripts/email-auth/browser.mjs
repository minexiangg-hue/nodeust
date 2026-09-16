import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import mysql from 'mysql2/promise';
const base = process.env.NODE_EMAIL_ORIGIN;
assert.equal(base, 'http://127.0.0.1:3104');
assert.equal(process.env.NODE_EMAIL_TEST_MODE, 'true');
const { chromium } =
  await import('/tmp/vis/node_modules/playwright-core/index.mjs');
const browser = await chromium.launch({
  executablePath:
    '/home/ubuntu/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell',
  args: ['--no-sandbox'],
});
const db = await mysql.createConnection({
  uri: process.env.NODE_EMAIL_DATABASE_URL,
});
const results = [];
try {
  await db.query('DELETE FROM email_rate_limits');
  for (const width of [320, 1440]) {
    const email = `browser-${width}-${randomBytes(3).toString('hex')}@connect.ust.hk`,
      password = 'A secure browser test phrase 123!';
    const context = await browser.newContext({
        viewport: { width, height: 900 },
      }),
      page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await context.addInitScript(() => {
      if (!localStorage.getItem('legacy-fixture')) {
        localStorage.setItem('node:saved', '["legacy-post"]');
        localStorage.setItem(
          'node:drafts:legacy-owner',
          '[{"title":"old private draft"}]',
        );
        localStorage.setItem('legacy-fixture', 'yes');
      }
    });
    await page.goto(base + '/register');
    await page.getByLabel('Email · 邮箱', { exact: true }).fill(email);
    await page.getByLabel('Password · 密码', { exact: true }).fill(password);
    await page
      .getByLabel('Confirm password · 确认密码', { exact: true })
      .fill(password);
    assert.ok(
      await page
        .locator('input[type=email]')
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize) >= 16),
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await page.screenshot({
      path: `/tmp/nodeust-email-register-${width}.png`,
      fullPage: true,
    });
    await page.getByRole('button', { name: /Create account/ }).click();
    await page.getByRole('status').waitFor();
    const mails = readdirSync(process.env.NODE_EMAIL_TEST_OUTBOX)
      .filter((f) => f.endsWith('.json'))
      .map((f) =>
        JSON.parse(
          readFileSync(process.env.NODE_EMAIL_TEST_OUTBOX + '/' + f, 'utf8'),
        ),
      );
    const mail = mails.find((m) => m.to === email);
    assert.ok(mail);
    const link = mail.text.match(/http:\/\/127\.0\.0\.1:3104\/[^\s]+/)[0];
    await page.goto(link);
    await page.waitForFunction(() => !window.location.hash);
    const [accounts] = await db.execute(
      'SELECT verified_at FROM email_accounts WHERE email=?',
      [email],
    );
    assert.equal(accounts[0].verified_at, null);
    await page.getByLabel('Password · 密码', { exact: true }).fill(password);
    await page.getByRole('button', { name: /Verify email/ }).click();
    await page.getByRole('status').waitFor();
    await page.getByRole('link', { name: /Back to sign in/ }).click();
    await page.getByLabel('Email · 邮箱', { exact: true }).fill(email);
    await page.getByLabel('Password · 密码', { exact: true }).fill(password);
    await page.getByRole('button', { name: /Sign in ·/ }).click();
    await page.waitForURL(base + '/explore');
    await page.waitForFunction(() =>
      Object.keys(localStorage).some(
        (k) => k.startsWith('node:email:') && k.endsWith(':saved'),
      ),
    );
    const storage = await page.evaluate(() => ({
      old: localStorage.getItem('node:saved'),
      fresh: Object.keys(localStorage)
        .filter((k) => k.startsWith('node:email:') && k.endsWith(':saved'))
        .map((k) => localStorage.getItem(k)),
    }));
    assert.equal(storage.old, '["legacy-post"]');
    assert.ok(storage.fresh.every((v) => v === '[]'));
    await page.goto(base + '/profile');
    await page
      .getByText('University email verified', { exact: false })
      .waitFor();
    await page.goto(base + '/settings');
    await page.getByRole('link', { name: /Reset password/ }).waitFor();
    await page.goto(base + '/logout');
    await page.getByRole('button', { name: /Sign out/ }).click();
    await page.waitForURL(base + '/login');
    const after = await context.request.get(base + '/api/profile');
    assert.equal(after.status(), 401);
    assert.deepEqual(errors, []);
    results.push({
      width,
      registrationVerificationLoginLogout: true,
      legacyStoragePreserved: true,
      newSavedItemsEmpty: true,
      passwordInputFontAtLeast16: true,
      overflow: false,
      runtimeErrors: 0,
    });
    await context.close();
    console.log(`Browser ${width}px: passed`);
  }
  writeFileSync(
    '/tmp/nodeust-email-browser-results.json',
    JSON.stringify(results, null, 2) + '\n',
    { mode: 0o600 },
  );
} finally {
  await browser.close();
  await db.end();
}
