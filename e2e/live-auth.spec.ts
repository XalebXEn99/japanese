import { expect, test, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

async function expectSynced(page: Page) {
  const previous = page.url();
  if (!previous.endsWith('#settings')) await page.goto('/#settings');
  const status = page.locator('.sync-status');
  await expect(status).toHaveText(/Synced to your account|Sync unavailable|Sync failed/, { timeout: 30000 });
  expect(await status.innerText(), (await page.locator('.error-banner').allTextContents()).join(' ')).toBe('Synced to your account');
  if (!previous.endsWith('#settings')) await page.goto(previous);
}

test('live Better Auth UI restores sessions and syncs across browser profiles', async ({ browser }) => {
  test.skip(process.env.RUN_LIVE_AUTH !== '1', 'Opt in to creating and deleting an isolated Neon test account.');
  test.setTimeout(180000);
  config({ path: '.env.local', quiet: true });
  const suffix = randomUUID();
  const email = `kotoba-ui-${suffix}@example.test`;
  const password = `Test-${randomUUID()}!`;
  const first = await browser.newContext();
  const connectApi = async (context: typeof first) => {
    if (process.env.LIVE_AUTH_API_URL) {
      await context.route('**/api/progress', async route => {
        const response = await route.fetch({ url: `${process.env.LIVE_AUTH_API_URL}/api/progress` });
        await route.fulfill({ response });
      });
    }
  };
  await connectApi(first);
  let userId: string | undefined;
  try {
    const page = await first.newPage();
    await page.goto('/#account');
    await page.getByRole('button', { name: 'Create an account', exact: true }).click();
    await page.getByLabel('Name', { exact: true }).fill('Scoped UI test');
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    const responsePromise = page.waitForResponse(response => response.url().includes('/sign-up/email'));
    await page.getByRole('button', { name: 'Create account', exact: true }).click();
    const response = await responsePromise;
    const body: unknown = await response.json();
    if (body && typeof body === 'object' && 'user' in body && body.user && typeof body.user === 'object' && 'id' in body.user && typeof body.user.id === 'string') userId = body.user.id;
    const failure = body && typeof body === 'object' && 'message' in body ? String(body.message) : 'No error detail returned';
    expect(response.status(), failure).toBe(200);
    expect(userId).toBeTruthy();
    await expect(page.getByText(email, { exact: true })).toBeVisible();
    await expectSynced(page);
    await page.goto('/#settings');
    const saved = page.waitForResponse(response => response.url().endsWith('/api/progress') && response.request().method() === 'PUT' && response.request().postDataJSON()?.progress?.settings?.showRomaji === false);
    await page.getByLabel('Show romaji', { exact: true }).uncheck();
    expect((await saved).status()).toBe(200);
    await expectSynced(page);
    await page.reload();
    await expect(page.getByLabel('Show romaji', { exact: true })).not.toBeChecked();
    await expect(page.locator('.topbar').getByRole('button', { name: 'Account: Scoped UI test', exact: true })).toHaveText('S');
    const second = await browser.newContext();
    await connectApi(second);
    try {
      const other = await second.newPage();
      await other.goto('/#account');
      await other.getByLabel('Email', { exact: true }).fill(email);
      await other.getByLabel('Password', { exact: true }).fill(password);
      await other.locator('main').getByRole('button', { name: 'Sign in', exact: true }).click();
      await expect(other.getByText(email, { exact: true })).toBeVisible();
      await expectSynced(other);
      await expect(other.locator('.topbar').getByRole('button', { name: 'Account: Scoped UI test', exact: true })).toHaveText('S');
      await other.goto('/#settings');
      await expect(other.getByLabel('Show romaji', { exact: true })).not.toBeChecked();
      await other.goto('/#account');
      await other.getByRole('button', { name: 'Sign out', exact: true }).click();
      await expect(other.locator('.topbar').getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
      await other.goto('/#account');
      await other.getByLabel('Email', { exact: true }).fill(email);
      await other.getByLabel('Password', { exact: true }).fill('deliberately-wrong-password');
      await other.locator('main').getByRole('button', { name: 'Sign in', exact: true }).click();
      await expect(other.getByRole('alert')).toBeVisible();
    } finally { await second.close(); }
  } finally {
    await first.close();
    if (userId) {
      if (!/^[a-zA-Z0-9-]+$/.test(userId)) throw new Error('Unexpected test user ID; refusing unsafe cleanup command.');
      if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is needed to clean up scoped live-test progress.');
      const sql = neon(process.env.DATABASE_URL);
      await sql`DELETE FROM app_progress WHERE user_id = ${userId}`;
      if (process.platform === 'win32') execFileSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `neon neon-auth user delete ${userId} --branch main`], { stdio: 'pipe' });
      else execFileSync('neon', ['neon-auth', 'user', 'delete', userId, '--branch', 'main'], { stdio: 'pipe' });
    }
  }
});
