import { expect, test } from '@playwright/test';

test('header branding, themes, scene rotation and sound controls', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('化');
  await expect(page.getByRole('link', { name: '化 Home' })).toBeVisible();
  await expect(page.getByRole('navigation')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'seasonal');
  await expect(page.locator('.scenery-layer.visible')).toHaveCSS('background-image', /scenery/);
  await expect(page.getByText('A steady path. No streak pressure.', { exact: true })).toHaveCount(0);
  await expect(page.locator('.topbar .sync-status')).toHaveCount(0);
  const themes = page.getByRole('group', { name: 'Appearance' });
  await themes.getByRole('radio', { name: 'Light', exact: true }).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('.seasonal-background')).toHaveCount(0);
  await themes.getByRole('radio', { name: 'Dark', exact: true }).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(themes.getByRole('radio', { name: 'Dark', exact: true })).toBeChecked();
  await themes.getByRole('radio', { name: 'Dark', exact: true }).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(themes.getByRole('radio', { name: 'Seasonal', exact: true })).toBeChecked();
  const firstScene = await page.locator('.scenery-layer.visible').getAttribute('style');
  const footer = page.getByRole('contentinfo');
  await expect(footer).toHaveCSS('position', 'fixed');
  await expect(footer.getByRole('link', { name: 'Sources & licenses' })).toBeVisible();
  await expect(page.locator('main .scenery-controls')).toHaveCount(0);
  await expect(footer.getByRole('button', { name: 'Next scene' }).locator('svg')).toHaveCount(1);
  await footer.getByRole('button', { name: 'Next scene' }).click();
  await expect.poll(async () => page.locator('.scenery-layer.visible').getAttribute('style')).not.toBe(firstScene);
  await page.getByRole('button', { name: 'Pause scenery slideshow' }).click();
  await expect(page.getByRole('button', { name: 'Resume scenery slideshow' })).toBeVisible();
  await page.getByLabel('Ambient sound settings').click();
  await page.getByRole('slider', { name: 'Volume', exact: true }).fill('0.45');
  await expect(page.getByRole('slider', { name: 'Volume', exact: true })).toHaveAttribute('aria-valuetext', '45 percent');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mute', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Mute', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
});

test('Settings appearance controls stay in sync with the header and persist', async ({ page }) => {
  await page.goto('/#settings');
  const settings = page.locator('.appearance-settings').getByRole('group', { name: 'Appearance' });
  const header = page.locator('.topbar').getByRole('group', { name: 'Appearance' });
  await settings.getByRole('radio', { name: 'Dark', exact: true }).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(header.getByRole('radio', { name: 'Dark', exact: true })).toBeChecked();
  await page.reload();
  await expect(settings.getByRole('radio', { name: 'Dark', exact: true })).toBeChecked();
  await settings.getByRole('radio', { name: 'Light', exact: true }).focus();
  await page.keyboard.press('Space');
  await expect(header.getByRole('radio', { name: 'Light', exact: true })).toBeChecked();
  await header.getByRole('radio', { name: 'Seasonal', exact: true }).check();
  await expect(settings.getByRole('radio', { name: 'Seasonal', exact: true })).toBeChecked();
  await expect(page.getByRole('contentinfo').getByRole('group', { name: 'Seasonal scenery' })).toBeVisible();
});

test('account dialogs are centered on desktop and mobile and close with Escape', async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 320, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/#account');
    const dialog = page.getByRole('dialog', { name: 'Welcome back', exact: true });
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(Math.abs(box!.x + box!.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(box!.y + box!.height / 2 - viewport.height / 2)).toBeLessThanOrEqual(1);
    await expect(dialog.getByLabel('Email', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.hero')).toBeVisible();
  }
});

test('daily answers persist once and appear in review insights', async ({ page }) => {
  await page.goto('/');
  const challenge = page.locator('.daily-challenge');
  await expect(challenge.getByRole('heading', { level: 2 })).toBeVisible();
  await expect(challenge.locator('.daily-level')).toHaveText('N5');
  await expect(challenge.locator('.daily-level')).not.toContainText('·');
  await challenge.getByLabel('Multiple choice', { exact: true }).check();
  await expect(challenge.locator('.choices button').first()).toBeVisible();
  await challenge.locator('.choices button').first().click();
  await expect(challenge.locator('.feedback')).toBeVisible();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('kotoba-progress-v1:guest') || '{}'));
  expect(Object.keys(stored.challenges)).toHaveLength(1);
  const outcome = Object.values(stored.challenges)[0] as { topic: string };
  await expect(challenge.locator('.feedback')).toContainText(outcome.topic);
  expect(stored.stats.answers).toBe(1);
  await page.reload();
  await expect(challenge.locator('.feedback')).toBeVisible();
  expect(await challenge.locator('.choices button').count()).toBe(0);
  await page.getByRole('link', { name: 'Reviews', exact: false }).click();
  await expect(page.getByRole('heading', { name: 'Insights' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Practice answers over the last 14 local calendar days' })).toBeVisible();
  await expect(page.getByText('Daily challenges completed', { exact: true })).toBeVisible();
});

test('small screens keep the top header and content within the viewport', async ({ page }) => {
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await expect(page.locator('.hero')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const footer = await page.getByRole('contentinfo').boundingBox();
    expect(footer).not.toBeNull();
    expect(Math.abs(footer!.y + footer!.height - 844)).toBeLessThanOrEqual(1);
    const next = await page.getByRole('button', { name: 'Next scene' }).boundingBox();
    expect(next?.width).toBeGreaterThanOrEqual(44);
    expect(next?.height).toBeGreaterThanOrEqual(44);
    await page.getByRole('link', { name: 'Reviews', exact: false }).click();
    await expect(page.locator('.review-insights')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
