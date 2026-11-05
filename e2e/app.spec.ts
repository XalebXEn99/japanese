import { expect, test } from '@playwright/test';

test('kana, quizzes, flashcards and persistent guest progress', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start with kana' }).click();
  await expect(page.getByRole('heading', { name: 'Kana', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Practise \d+ kana$/ }).click();
  await page.getByRole('button', { name: 'Multiple choice' }).click();
  await expect(page.getByText('Question 1 / 20')).toBeVisible();
  await page.locator('.choices button').first().click();
  await expect(page.locator('.feedback')).toBeVisible();
  await page.getByRole('button', { name: 'Next question' }).click();
  await expect(page.getByText('Question 2 / 20')).toBeVisible();
  await page.getByRole('button', { name: 'Exit quiz' }).click();
  await page.getByRole('button', { name: /^Practise \d+ kana$/ }).click();
  await page.getByRole('button', { name: 'Flashcards', exact: false }).click();
  await page.getByRole('button', { name: 'Reveal flashcard answer' }).click();
  await page.getByRole('button', { name: 'Good', exact: true }).click();
  await page.getByRole('button', { name: 'Finish session' }).click();
  await page.reload();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('kotoba-progress-v1:guest') || '{}'));
  expect(stored.stats.answers).toBe(2);
  expect(Object.keys(stored.cards)).toHaveLength(1);
});

test('every JLPT level has searchable libraries and meaningful grammar', async ({ page }) => {
  await page.goto('/#vocabulary');
  for (const level of ['N5', 'N4', 'N3', 'N2', 'N1']) {
    await page.getByLabel('Study level', { exact: true }).selectOption(level);
    await expect(page.locator('.item-card').first()).toBeVisible();
  }
  await page.getByRole('link', { name: 'Grammar', exact: false }).click();
  await expect(page.locator('.grammar-lesson').first()).toBeVisible();
  await page.locator('.grammar-lesson summary').first().click();
  await expect(page.locator('.grammar-lesson[open] .example').first()).toBeVisible();
});

test('unit gating enforces 80 percent and handwriting models load', async ({ page }) => {
  await page.goto('/#course');
  await expect(page.locator('.unit').first()).toBeVisible();
  await expect(page.locator('.unit').nth(1).getByRole('button', { name: 'Locked' })).toBeDisabled();
  const firstId = await page.evaluate(async () => {
    const data = await fetch('/data/N5.json').then(r => r.json());
    const first = data.vocabulary[0];
    return `N5-vocab-${first.id}`;
  });
  await page.evaluate(id => {
    const key = 'kotoba-progress-v1:guest';
    const data = JSON.parse(localStorage.getItem(key)!);
    data.units[id] = { score: 80, passed: true, updatedAt: Date.now() };
    localStorage.setItem(key, JSON.stringify(data));
  }, firstId);
  await page.reload();
  await expect(page.locator('.unit').nth(1).getByRole('button', { name: 'Unit test' })).toBeEnabled();
  await page.goto('/#kanji');
  await page.locator('.word-button').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.model path').first()).toBeAttached();
  await expect(page.getByText(/strokes\. Draw each stroke/)).toBeVisible();
});

test('mobile layout keeps navigation and quiz controls reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Continue learning' })).toBeVisible();
  await expect(page.getByRole('navigation')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('real unit tests require at least 80 percent, including after reload', async ({ page }) => {
  test.setTimeout(90000);
  await page.goto('/#course');
  await expect(page.locator('.unit').first()).toBeVisible();
  const readings = await page.evaluate(async () => {
    const data = await fetch('/data/N5.json').then(response => response.json());
    return Object.fromEntries(data.vocabulary.map((word: { word: string; reading: string; meanings: string[] }) => [word.word, { reading: word.reading, meaning: word.meanings[0] }]));
  });
  for (const target of [11, 12]) {
    await page.locator('.unit').first().getByRole('button', { name: /Unit test|Retake test/ }).click();
    for (let index = 0; index < 15; index++) {
      const prompt = await page.locator('.quiz-prompt').innerText();
      const meaningQuestion = prompt.startsWith('What does ');
      const word = meaningQuestion ? prompt.slice(10, -6) : prompt.replace(/^Read /, '');
      const reading = meaningQuestion ? readings[word]?.meaning : readings[word]?.reading;
      expect(reading).toBeTruthy();
      if (index < target) await page.locator('.choices').getByRole('button', { name: reading, exact: true }).click();
      else {
        const choices = page.locator('.choices button');
        const texts = await choices.allTextContents();
        await choices.nth(texts.findIndex(text => text !== reading)).click();
      }
      await page.getByRole('button', { name: index === 14 ? 'See results' : 'Next question' }).click();
    }
    await expect(page.locator('.result-score')).toHaveText(target === 11 ? '73%' : '80%');
    await page.getByRole('button', { name: 'Continue studying' }).click();
    await page.reload();
    if (target === 11) await expect(page.locator('.unit').nth(1).getByRole('button', { name: 'Locked' })).toBeDisabled();
    else await expect(page.locator('.unit').nth(1).getByRole('button', { name: 'Unit test' })).toBeEnabled();
  }
});

test('typed kana readings accept romaji and strokes are automatically scored', async ({ page }) => {
  await page.goto('/#kana');
  await page.getByRole('button', { name: /^Practise \d+ kana$/ }).click();
  await page.getByRole('button', { name: 'Type your answer' }).click();
  const character = (await page.locator('.quiz-prompt').innerText()).replace(/^Read /, '');
  const romaji = await page.evaluate(async ch => {
    const kana = await fetch('/data/kana.json').then(response => response.json());
    return kana.find((entry: { character: string }) => entry.character === ch).romaji;
  }, character);
  await page.getByLabel('Your answer').fill(romaji.toUpperCase());
  await page.getByRole('button', { name: 'Check answer' }).click();
  await expect(page.getByRole('heading', { name: 'Correct!', exact: true })).toBeVisible();
  await page.goto('/#kanji');
  await page.getByRole('searchbox').fill('一');
  await page.getByRole('button', { name: '一', exact: true }).click();
  await expect(page.locator('.model path').first()).toBeAttached();
  const strokes = await page.locator('.model path').evaluateAll(paths => paths.map(node => {
    const path = node as SVGPathElement;
    return Array.from({ length: 25 }, (_, i) => {
      const point = path.getPointAtLength(path.getTotalLength() * i / 24);
      return { x: point.x, y: point.y };
    });
  }));
  const box = await page.locator('svg[aria-label^="Drawing pad"]').boundingBox();
  expect(box).toBeTruthy();
  for (const stroke of strokes) {
    await page.mouse.move(box!.x + stroke[0].x / 109 * box!.width, box!.y + stroke[0].y / 109 * box!.height);
    await page.mouse.down();
    for (const point of stroke.slice(1)) await page.mouse.move(box!.x + point.x / 109 * box!.width, box!.y + point.y / 109 * box!.height);
    await page.mouse.up();
  }
  await page.getByRole('button', { name: 'Check writing' }).click();
  await expect(page.getByText('Good match.', { exact: false })).toBeVisible();
});
