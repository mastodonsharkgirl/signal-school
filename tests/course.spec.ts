import { expect, test } from '@playwright/test';

import { readFileSync } from 'node:fs';

test.beforeEach(async ({ page }) => {
  const policy = readFileSync('dist/_headers', 'utf8').match(/Content-Security-Policy: (.+)/)?.[1];
  if (!policy) throw new Error('Built CSP is missing');
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), 'content-security-policy': policy },
    });
  });
});

async function tabTo(
  page: import('@playwright/test').Page,
  locator: import('@playwright/test').Locator,
) {
  for (let index = 0; index < 80; index += 1) {
    if (await locator.evaluate((element) => element === document.activeElement)) {
      await expect(locator).toBeFocused();
      return;
    }
    await page.keyboard.press('Tab');
  }
  throw new Error('Keyboard Tab traversal did not reach the intended challenge control.');
}

test('standalone course prompt fields fit phone, tablet and desktop widths', async ({ page }) => {
  await page.goto('/');
  await page.locator('astro-island:not([ssr])').first().waitFor();
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth, `course overflow at ${width}px`).toBeLessThanOrEqual(width);
    for (const field of await page.locator('.lab-grid textarea').all()) {
      const box = await field.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    }
  }
});

test('Signal School awards lesson XP once and resets local progress', async ({ page }) => {
  await page.goto('/');
  await page.locator('astro-island:not([ssr])').first().waitFor();
  for (const select of await page.locator('.decision-grid select').all())
    await select.selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Check my choices' }).click();
  await expect(page.getByText(/Exercise complete/)).toBeVisible();
  await expect(page.getByText('60 XP', { exact: true })).toBeVisible();
  for (const select of await page.locator('.decision-grid select').all())
    await select.selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Check my choices' }).click();
  await expect(page.getByText(/Exercise complete/)).toBeVisible();
  await page.getByRole('button', { name: /reset course/i }).click();
  await expect(page.getByText('0 XP', { exact: true })).toBeVisible();
});

test('Signal School prompt lab does not submit a request', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (!['document', 'script', 'stylesheet', 'font', 'image'].includes(request.resourceType()))
      requests.push(request.url());
  });
  await page.goto('/');
  await page.locator('astro-island:not([ssr])').first().waitFor();
  await page
    .getByRole('textbox', { name: 'Task', exact: true })
    .fill('Draft a short project update.');
  await expect(page.locator('pre')).toContainText('Draft a short project update.');
  expect(requests).toEqual([]);
});

test('Signal School rejects incomplete workshop exercise attempts', async ({ page }) => {
  await page.goto('/');
  await page.locator('astro-island:not([ssr])').first().waitFor();
  await expect(page.getByRole('button', { name: 'Check this case' })).toBeDisabled();

  await page.getByRole('button', { name: 'Check my choices' }).click();
  await expect(
    page.locator('.coaching').filter({ hasText: /choose what to write, who it is for/i }),
  ).toBeVisible();

  await page
    .locator('.signal-progress')
    .getByRole('button')
    .filter({ hasText: 'Give useful details' })
    .click();
  for (const box of await page.locator('.fact-picker input[type="checkbox"]').all())
    await box.check();
  await page.getByRole('button', { name: 'Check selected details' }).click();
  await expect(page.getByText(/leave out the poster/i)).toBeVisible();

  await page
    .locator('.signal-progress')
    .getByRole('button')
    .filter({ hasText: 'Put it in order' })
    .click();
  await page.getByRole('button', { name: 'Check order' }).click();
  await expect(page.getByText(/put the unconfirmed details last/i)).toBeVisible();

  await page
    .locator('.signal-progress')
    .getByRole('button')
    .filter({ hasText: 'Check the facts' })
    .click();
  await page.getByRole('button', { name: 'Check the facts', exact: true }).click();
  await expect(page.getByText(/claim the notes do not support/i)).toBeVisible();

  await page
    .locator('.signal-progress')
    .getByRole('button')
    .filter({ hasText: 'Compare two answers' })
    .click();
  await page.getByRole('button', { name: 'Check my comparison' }).click();
  await expect(page.getByText(/confident answer can still be wrong/i)).toBeVisible();

  await page
    .locator('.signal-progress')
    .getByRole('button')
    .filter({ hasText: 'Spot hidden instructions' })
    .click();
  await page.getByRole('button', { name: 'Check my decision' }).click();
  await expect(page.getByText(/find the line that changes the task/i)).toBeVisible();
});

test('Signal School requires a correct final challenge and reset clears it', async ({ page }) => {
  await page.goto('/');
  await page.locator('astro-island:not([ssr])').first().waitFor();
  const selectedCaseContrast = await page
    .locator('.case-selector button[aria-pressed="true"]')
    .evaluate((element) => {
      const style = getComputedStyle(element);
      const luminance = (color: string) => {
        const channels = color
          .match(/[\d.]+/g)!
          .slice(0, 3)
          .map(Number);
        const linear = channels.map((channel) => {
          const value = channel / 255;
          return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        });
        return linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722;
      };
      const foreground = luminance(style.color);
      const background = luminance(style.backgroundColor);
      return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
    });
  expect(selectedCaseContrast).toBeGreaterThanOrEqual(4.5);
  for (const select of await page.locator('.decision-grid select').all())
    await select.selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Check my choices' }).click();
  await page
    .locator('.signal-progress')
    .getByRole('button')
    .filter({ hasText: 'Give useful details' })
    .click();
  for (const index of [0, 1, 2, 3]) await page.getByRole('checkbox').nth(index).check();
  await page.getByRole('button', { name: 'Check selected details' }).click();
  await page
    .locator('.signal-progress')
    .getByRole('button')
    .filter({ hasText: 'Put it in order' })
    .click();
  await page.getByRole('button', { name: 'Move schedule up' }).click();
  await page.getByRole('button', { name: 'Move bring up' }).click();
  await page.getByRole('button', { name: 'Check order' }).click();
  await page
    .locator('.signal-progress')
    .getByRole('button')
    .filter({ hasText: 'Check the facts' })
    .click();
  for (const select of await page.locator('.evidence-grid select').all())
    await select.selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Check the facts', exact: true }).click();
  await expect(page.getByText(/claim the notes do not support/i)).toBeVisible();
  await page.locator('.evidence-grid select').nth(1).selectOption('Not established');
  await page.locator('.evidence-grid select').nth(2).selectOption('Contradicted');
  await page.getByRole('button', { name: 'Check the facts', exact: true }).click();
  await expect(page.getByText(/Exercise complete/)).toBeVisible();
  await page
    .locator('.signal-progress')
    .getByRole('button')
    .filter({ hasText: 'Spot hidden instructions' })
    .click();
  for (const select of await page.locator('.decision-grid select').all())
    await select.selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Check my decision' }).click();
  await page
    .locator('.signal-progress')
    .getByRole('button')
    .filter({ hasText: 'Compare two answers' })
    .click();
  for (const index of [0, 2, 4, 7, 9, 11])
    await page.locator('.rubric-question button').nth(index).click();
  await page.getByRole('button', { name: 'Draft A', exact: true }).click();
  await page.getByRole('button', { name: 'Check my comparison' }).click();
  const finalChallenge = page.locator('.final-challenge');
  const firstStatus = finalChallenge.locator('.claim-card').first().getByRole('combobox');
  await tabTo(page, firstStatus);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await tabTo(page, page.getByRole('button', { name: 'Check this case' }));
  await page.keyboard.press('Enter');
  await expect(finalChallenge.locator('.transfer-summary')).toBeFocused();
  await expect(
    finalChallenge
      .locator('.transfer-feedback')
      .filter({ hasText: /Choose a judgment/i })
      .first(),
  ).toBeVisible();
  const claims = finalChallenge.locator('.claim-card');
  await tabTo(page, claims.nth(0).getByRole('checkbox', { name: 'S2' }));
  await page.keyboard.press('Space');
  await tabTo(page, claims.nth(1).getByRole('combobox'));
  await page.keyboard.press('ArrowDown');
  await tabTo(page, claims.nth(1).getByRole('checkbox', { name: 'S2' }));
  await page.keyboard.press('Space');
  await tabTo(page, claims.nth(2).getByRole('combobox'));
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await tabTo(page, claims.nth(2).getByRole('checkbox', { name: 'S3' }));
  await page.keyboard.press('Space');
  await tabTo(page, finalChallenge.getByRole('radio').first());
  await page.keyboard.press('Space');
  await tabTo(page, finalChallenge.locator('.handoff-card').getByRole('checkbox', { name: 'B' }));
  await page.keyboard.press('Space');
  await tabTo(page, page.getByRole('button', { name: 'Check this case' }));
  await page.keyboard.press('Enter');
  await expect(page.getByText(/Final challenge complete · 80 XP earned/i)).toBeVisible();
  await expect(page.getByText('440 XP', { exact: true })).toBeVisible();
  await claims.nth(0).getByRole('combobox').selectOption('supported');
  await expect(finalChallenge.locator('.transfer-feedback')).toHaveCount(0);
  await page.getByRole('button', { name: 'Exhibition schedule' }).click();
  await expect(page.getByText(/Case changed. Start with the new sources/i)).toBeVisible();
  await expect(finalChallenge.getByRole('checkbox', { name: 'S1' }).first()).not.toBeChecked();
  await finalChallenge
    .getByRole('combobox', { name: /Doors open at 11:00/i })
    .selectOption('sources-disagree');
  await finalChallenge.getByRole('checkbox', { name: /Doors open at 11:00.*S1/i }).check();
  await finalChallenge.getByRole('checkbox', { name: /Doors open at 11:00.*S2/i }).check();
  await finalChallenge.getByRole('combobox', { name: /East Gallery/i }).selectOption('supported');
  await finalChallenge.getByRole('checkbox', { name: /East Gallery.*S1/i }).check();
  await finalChallenge
    .getByRole('combobox', { name: /receive lunch/i })
    .selectOption('not-established');
  await finalChallenge.getByRole('checkbox', { name: /receive lunch.*S3/i }).check();
  await finalChallenge.getByRole('radio', { name: /internal note listing East Gallery/i }).check();
  await finalChallenge.getByRole('checkbox', { name: /Handoff evidence: cite B/i }).check();
  await page.getByRole('button', { name: 'Check this case' }).click();
  await expect(page.getByText(/already earned the final challenge XP/i)).toBeVisible();
  await expect(page.getByText('440 XP', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('0 XP', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /reset course/i }).click();
  await expect(page.getByText(/6 exercises remain/i)).toBeVisible();
});
