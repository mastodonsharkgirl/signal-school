import { expect, test } from '@playwright/test';

import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { markdownToHtml } from 'satteri';

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

test('standalone Workroom fields fit phone, tablet and desktop widths', async ({ page }) => {
  await page.goto('/');
  await page.locator('astro-island:not([ssr])').first().waitFor();
  await page.getByRole('button', { name: /open workroom/i }).click();
  const [workroomBox, briefGridBox] = await Promise.all([
    page.locator('.workroom').boundingBox(),
    page.locator('.workroom-grid').boundingBox(),
  ]);
  expect(workroomBox).not.toBeNull();
  expect(briefGridBox).not.toBeNull();
  expect(briefGridBox!.width).toBeGreaterThan(workroomBox!.width * 0.9);
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth, `course overflow at ${width}px`).toBeLessThanOrEqual(width);
    for (const field of await page.locator('#prompt-lab textarea:visible').all()) {
      const box = await field.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    }
  }
  await page.setViewportSize({ width: 320, height: 900 });
  const stageButtons = page.locator('.workroom-stages button');
  const [firstStage, secondStage, thirdStage] = await Promise.all([
    stageButtons.nth(0).boundingBox(),
    stageButtons.nth(1).boundingBox(),
    stageButtons.nth(2).boundingBox(),
  ]);
  expect(firstStage).not.toBeNull();
  expect(secondStage).not.toBeNull();
  expect(thirdStage).not.toBeNull();
  expect(Math.abs(firstStage!.y - secondStage!.y)).toBeLessThanOrEqual(1);
  expect(thirdStage!.y).toBeGreaterThan(firstStage!.y);
});

test('Signal School awards lesson XP once and resets local progress', async ({ page }) => {
  await page.goto('/');
  await page.locator('astro-island:not([ssr])').first().waitFor();
  await page.getByRole('button', { name: /open guided lessons/i }).click();
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

test('Signal School Workroom does not submit a request', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (!['document', 'script', 'stylesheet', 'font', 'image'].includes(request.resourceType()))
      requests.push(request.url());
  });
  await page.goto('/');
  await page.locator('astro-island:not([ssr])').first().waitFor();
  await page.getByRole('button', { name: /open workroom/i }).click();
  await page
    .getByRole('textbox', { name: 'Task', exact: true })
    .fill('Draft a short project update.');
  await page.getByRole('button', { name: '2. Build prompt' }).click();
  await expect(page.locator('pre[aria-label="Prompt to use"]')).toContainText('Draft a short project update.');
  expect(requests).toEqual([]);
});

test('Signal School exports browser-entered source text as literal Markdown data', async ({ page }) => {
  await page.goto('/');
  await page.locator('astro-island:not([ssr])').first().waitFor();
  await page.getByRole('button', { name: /open workroom/i }).click();
  await page.getByRole('textbox', { name: 'SUP-01 source title' }).fill('# BROWSER-FORGED-HEADING\n<a href="https://example.invalid/">forged link</a>\n``````');
  await page.getByRole('button', { name: '4. Download handoff' }).click();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Markdown handoff' }).click();
  const downloadedPath = await (await downloadPromise).path();
  expect(downloadedPath).not.toBeNull();
  const markdown = readFileSync(downloadedPath!, 'utf8');
  const rendered = markdownToHtml(markdown).html;

  expect(markdown).toContain('# BROWSER-FORGED-HEADING');
  expect(rendered).not.toContain('<h1>BROWSER-FORGED-HEADING</h1>');
  expect(rendered).not.toContain('<a href="https://example.invalid/"');
});

test('Signal School workspace rail moves learners between named work areas', async ({ page }) => {
  await page.goto('/');
  await page.locator('astro-island:not([ssr])').first().waitFor();

  const lab = page.getByRole('button', { name: /open workroom/i });
  await lab.click();
  await expect(lab).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#prompt-lab')).toHaveAttribute('data-workspace-active', 'true');

  const challenge = page.getByRole('button', { name: /open final challenge/i });
  await challenge.click();
  await expect(challenge).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#final-challenge')).toHaveAttribute('data-workspace-active', 'true');
});

test('Signal School keeps own-work state through workspace navigation and clears it only on explicit reset', async ({ page }) => {
  await page.goto('/');
  await page.locator('astro-island:not([ssr])').first().waitFor();
  await page.getByRole('button', { name: /open workroom/i }).click();
  await page.getByRole('button', { name: 'Start your own work' }).click();
  const task = page.getByRole('textbox', { name: 'Task', exact: true });
  await task.fill('Prepare a handoff for an incident review.');

  await page.getByRole('button', { name: /open guided lessons/i }).click();
  await page.getByRole('button', { name: /open workroom/i }).click();
  await expect(task).toHaveValue('Prepare a handoff for an incident review.');

  await page.getByRole('button', { name: /reset course/i }).click();
  await page.getByRole('dialog', { name: /reset the course/i }).getByRole('button', { name: /continue: reset the course/i }).click();
  await page.getByRole('button', { name: /open workroom/i }).click();
  await expect(task).toHaveValue('');
});

test('Signal School captures selected source evidence and archives a reviewed revision after a draft edit', async ({ page }) => {
  await page.goto('/');
  await page.locator('astro-island:not([ssr])').first().waitFor();
  await page.getByRole('button', { name: /open workroom/i }).click();
  await page.getByRole('button', { name: '3. Check draft' }).click();

  const draft = page.getByRole('textbox', { name: 'Draft to check' });
  await draft.selectText();
  await page.getByRole('button', { name: 'Capture selected draft text' }).click();
  const evidence = page.getByRole('textbox', { name: 'SUP-05 evidence text' });
  await evidence.selectText();
  await page.getByRole('button', { name: 'Add selected SUP-05 excerpt' }).click();
  await page.getByRole('textbox', { name: 'Claim in your own words' }).fill('The draft treats a sample test as full approval.');
  await page.getByRole('combobox', { name: 'Your finding' }).selectOption('not-established');
  await page.getByRole('textbox', { name: 'Why this finding' }).fill('The source says the sample check is not a supplier-quality approval.');
  await page.getByRole('button', { name: 'Save this claim check' }).click();
  await expect(page.locator('.recorded-reviews')).toContainText('not-established');

  await page.locator('.authored-reference summary').click();
  await expect(page.locator('.authored-reference')).toContainText('A limited sample test is useful evidence');
  await draft.fill(`${await draft.inputValue()} A local follow-up is needed.`);
  await page.getByRole('button', { name: '4. Download handoff' }).click();
  await expect(page.locator('.snapshot-history > details')).toHaveCount(1);
  await expect(page.locator('.snapshot-history')).toContainText('Exact draft');
  await expect(page.locator('.workroom-status').getByText('More checks needed', { exact: true })).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download JSON handoff' }).click();
  const download = await downloadPromise;
  const downloadedPath = await download.path();
  expect(downloadedPath).not.toBeNull();
  const json = readFileSync(downloadedPath!, 'utf8');
  const pack = JSON.parse(json) as { schema: string; state: { priorSnapshots: Array<{ content: { draft: string } }> } };
  expect(pack.schema).toBe('signal-school-review-pack');
  expect(new TextEncoder().encode(json).byteLength).toBeLessThanOrEqual(300_000);
  expect(pack.state.priorSnapshots[0]?.content.draft).toContain('full quality approval is complete');

  await page.locator('.import-pack input').setInputFiles({
    name: 'round-trip-review-pack.json',
    mimeType: 'application/json',
    buffer: Buffer.from(json),
  });
  await page.getByRole('dialog', { name: /replace this workroom/i }).getByRole('button', { name: /continue: open the json handoff/i }).click();
  await expect(page.locator('.workroom-notice')).toContainText('JSON handoff opened');
});

test('Signal School gives an unfinished claim check an explicit handoff choice', async ({ page }) => {
  await page.goto('/');
  await page.locator('astro-island:not([ssr])').first().waitFor();
  await page.getByRole('button', { name: '3. Check draft' }).click();

  const draft = page.getByRole('textbox', { name: 'Draft to check' });
  await draft.selectText();
  await page.getByRole('button', { name: 'Capture selected draft text' }).click();
  const evidence = page.getByRole('textbox', { name: 'SUP-05 evidence text' });
  await evidence.selectText();
  await page.getByRole('button', { name: 'Add selected SUP-05 excerpt' }).click();
  const claim = page.getByRole('textbox', { name: 'Claim in your own words' });
  await claim.fill('UNSAVED: the sample does not approve the supplier.');
  await page.getByRole('combobox', { name: 'Your finding' }).selectOption('not-established');
  await page.getByRole('textbox', { name: 'Why this finding' }).fill('UNSAVED: the source says the sample is limited.');

  await page.getByRole('button', { name: '4. Download handoff' }).click();
  await expect(page.locator('.unfinished-review-status')).toHaveText('1 unfinished claim check');
  await page.getByRole('button', { name: 'Download JSON handoff' }).click();
  const dialog = page.getByRole('dialog', { name: /unfinished claim check/i });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Return to check' }).click();
  await expect(claim).toHaveValue('UNSAVED: the sample does not approve the supplier.');
});

test('Signal School saves an unfinished claim check before exporting the current JSON handoff', async ({ page }) => {
  await page.goto('/');
  await page.locator('astro-island:not([ssr])').first().waitFor();
  await page.getByRole('button', { name: '3. Check draft' }).click();

  const draft = page.getByRole('textbox', { name: 'Draft to check' });
  await draft.selectText();
  await page.getByRole('button', { name: 'Capture selected draft text' }).click();
  const evidence = page.getByRole('textbox', { name: 'SUP-05 evidence text' });
  await evidence.selectText();
  await page.getByRole('button', { name: 'Add selected SUP-05 excerpt' }).click();
  await page.getByRole('textbox', { name: 'Claim in your own words' }).fill('SAVED: the sample does not approve the supplier.');
  await page.getByRole('combobox', { name: 'Your finding' }).selectOption('not-established');
  await page.getByRole('textbox', { name: 'Why this finding' }).fill('SAVED: the source says the sample is limited.');

  await page.getByRole('button', { name: '4. Download handoff' }).click();
  await page.getByRole('button', { name: 'Download JSON handoff' }).click();
  const dialog = page.getByRole('dialog', { name: /unfinished claim check/i });
  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Save claim check and download' }).click();
  const downloadedPath = await (await downloadPromise).path();
  expect(downloadedPath).not.toBeNull();
  const pack = JSON.parse(readFileSync(downloadedPath!, 'utf8')) as { state: { reviews: Array<{ claim: string }> } };
  expect(pack.state.reviews.map((review) => review.claim)).toContain('SAVED: the sample does not approve the supplier.');
  await page.getByRole('button', { name: '3. Check draft' }).click();
  await expect(page.getByText('SAVED: the sample does not approve the supplier.')).toBeVisible();
});

test('Signal School cancels a practice-case replacement without losing own work', async ({ page }) => {
  await page.goto('/');
  await page.locator('astro-island:not([ssr])').first().waitFor();
  await page.getByRole('button', { name: 'Start your own work' }).click();
  const task = page.getByRole('textbox', { name: 'Task', exact: true });
  await task.fill('Preserve this incident handoff.');

  const changeCase = page.locator('.case-launch summary');
  await changeCase.click();
  const releaseCase = page.getByRole('button', { name: 'Release readiness update' });
  await releaseCase.click();
  const dialog = page.getByRole('dialog', { name: /replace this workroom/i });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(task).toHaveValue('Preserve this incident handoff.');
  await expect(releaseCase).toBeFocused();
});

test('Signal School keeps meaningful work when a new blank Workroom or clear action is cancelled', async ({ page }) => {
  await page.goto('/');
  await page.locator('astro-island:not([ssr])').first().waitFor();
  const task = page.getByRole('textbox', { name: 'Task', exact: true });
  await task.fill('Keep the supplier decision request.');

  await page.getByRole('button', { name: 'Start your own work' }).click();
  const replaceDialog = page.getByRole('dialog', { name: /replace this workroom/i });
  await expect(replaceDialog).toBeVisible();
  await replaceDialog.getByRole('button', { name: 'Keep editing' }).click();
  await expect(task).toHaveValue('Keep the supplier decision request.');

  await page.getByRole('button', { name: '4. Download handoff' }).click();
  await page.getByRole('button', { name: 'Clear workroom' }).click();
  await expect(replaceDialog).toBeVisible();
  await replaceDialog.getByRole('button', { name: 'Keep editing' }).click();
  await page.getByRole('button', { name: '1. Request & sources' }).click();
  await expect(task).toHaveValue('Keep the supplier decision request.');
});

test('Signal School cancels a valid JSON replacement and an explicit course reset', async ({ page }) => {
  await page.goto('/');
  await page.locator('astro-island:not([ssr])').first().waitFor();
  await page.getByRole('button', { name: '4. Download handoff' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download JSON handoff' }).click();
  const sourcePath = await (await downloadPromise).path();
  expect(sourcePath).not.toBeNull();
  const json = readFileSync(sourcePath!, 'utf8');

  await page.getByRole('button', { name: 'Start your own work' }).click();
  const task = page.getByRole('textbox', { name: 'Task', exact: true });
  await task.fill('Keep this own-work request.');
  await page.getByRole('button', { name: '4. Download handoff' }).click();
  await page.locator('.import-pack input').setInputFiles({
    name: 'valid-handoff.json',
    mimeType: 'application/json',
    buffer: Buffer.from(json),
  });
  const importDialog = page.getByRole('dialog', { name: /replace this workroom/i });
  await expect(importDialog).toBeVisible();
  await importDialog.getByRole('button', { name: 'Keep editing' }).click();
  await page.getByRole('button', { name: '1. Request & sources' }).click();
  await expect(task).toHaveValue('Keep this own-work request.');

  const reset = page.getByRole('button', { name: /reset course/i });
  await reset.click();
  const resetDialog = page.getByRole('dialog', { name: /reset the course/i });
  await expect(resetDialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(task).toHaveValue('Keep this own-work request.');
  await expect(reset).toBeFocused();
});

test('Signal School declines an oversized JSON file before reading it', async ({ page }) => {
  await page.goto('/');
  await page.locator('astro-island:not([ssr])').first().waitFor();
  await page.getByRole('button', { name: '4. Download handoff' }).click();
  await page.evaluate(() => {
    const original = File.prototype.text;
    const target = window as typeof window & { __signalOversizedFileRead?: boolean };
    target.__signalOversizedFileRead = false;
    File.prototype.text = function () {
      target.__signalOversizedFileRead = true;
      return original.call(this);
    };
  });
  await page.locator('.import-pack input').setInputFiles({
    name: 'too-large-review-pack.json',
    mimeType: 'application/json',
    buffer: Buffer.alloc(300_001, 120),
  });
  await expect(page.locator('.workroom-notice')).toContainText('too large');
  await expect.poll(() => page.evaluate(() => (window as typeof window & { __signalOversizedFileRead?: boolean }).__signalOversizedFileRead)).toBe(false);
});

test('Signal School keeps every workspace within a 768px tablet viewport', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/');
  await page.locator('astro-island:not([ssr])').first().waitFor();
  for (const workspace of [/open guided lessons/i, /open workroom/i, /open final challenge/i]) {
    await page.getByRole('button', { name: workspace }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(768);
  }
});

test('Signal School shows the scenario before a reachable first lesson control on phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('astro-island:not([ssr])').first().waitFor();
  await page.getByRole('button', { name: /open guided lessons/i }).click();
  const scenario = page.locator('.scenario-card');
  const firstControl = page.locator('.decision-grid select').first();
  const [scenarioBox, controlBox] = await Promise.all([scenario.boundingBox(), firstControl.boundingBox()]);
  expect(scenarioBox).not.toBeNull();
  expect(controlBox).not.toBeNull();
  expect(scenarioBox!.y).toBeLessThan(controlBox!.y);
  expect(controlBox!.y).toBeLessThanOrEqual(700);
});

test('Signal School brings the compact Workroom action into view on a phone and opens its draft check', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('astro-island:not([ssr])').first().waitFor();

  await page.getByRole('button', { name: /open guided lessons/i }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole('button', { name: /open workroom/i }).click();

  await expect(page.locator('#lab-title')).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(40);
  const checkDraft = page.getByRole('button', { name: 'Check loaded draft' });
  const task = page.getByRole('textbox', { name: 'Task', exact: true });
  const [checkDraftBox, taskBox] = await Promise.all([checkDraft.boundingBox(), task.boundingBox()]);
  expect(checkDraftBox).not.toBeNull();
  expect(taskBox).not.toBeNull();
  expect(checkDraftBox!.y).toBeLessThan(700);
  expect(Math.min(checkDraftBox!.y, taskBox!.y)).toBeLessThan(700);

  await checkDraft.click();
  await expect(page.getByRole('textbox', { name: 'Draft to check' })).toBeFocused();
});

test('Signal School moves focus into the workspace and next lesson', async ({ page }) => {
  await page.goto('/');
  await page.locator('astro-island:not([ssr])').first().waitFor();
  await page.getByRole('button', { name: /open workroom/i }).click();
  await expect(page.locator('#lab-title')).toBeFocused();
  await page.getByRole('button', { name: /open guided lessons/i }).click();
  for (const select of await page.locator('.decision-grid select').all())
    await select.selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Check my choices' }).click();
  await page.getByRole('button', { name: /next exercise/i }).click();
  await expect(page.locator('#lesson-title')).toBeFocused();
});

test('Signal School uses instant workspace scrolling for reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('astro-island:not([ssr])').first().waitFor();
  await page.evaluate(() => {
    Element.prototype.scrollIntoView = function (options?: ScrollIntoViewOptions) {
      this.setAttribute('data-scroll-behavior', options?.behavior ?? 'missing');
    };
  });
  await page.getByRole('button', { name: /open workroom/i }).click();
  await expect(page.locator('#prompt-lab')).toHaveAttribute('data-scroll-behavior', 'auto');
});

test('Signal School keeps enlarged Workroom text within the viewport', async ({ page }) => {
  await page.goto('/');
  await page.locator('astro-island:not([ssr])').first().waitFor();
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await page.getByRole('button', { name: /open workroom/i }).click();
    const overflow = await page.evaluate((viewportWidth) => Array.from(document.querySelectorAll<HTMLElement>('body *'))
      .map((element) => ({
        tag: element.tagName,
        className: element.className,
        text: (element.textContent ?? '').trim().slice(0, 80),
        width: Math.ceil(element.getBoundingClientRect().width),
        scrollWidth: element.scrollWidth,
        display: getComputedStyle(element).display,
        minWidth: getComputedStyle(element).minWidth,
        parent: element.parentElement?.className ?? '',
        right: Math.ceil(element.getBoundingClientRect().right),
      }))
      .filter((element) => element.right > viewportWidth + 1)
      .slice(0, 8), width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), JSON.stringify(overflow)).toBeLessThanOrEqual(width);
  }

  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.getByRole('button', { name: '4. Download handoff' }).click();
    const geometry = await page.locator('.import-pack').evaluate((element) => {
      const input = element.querySelector('input')!;
      const labelBox = element.getBoundingClientRect();
      const inputBox = input.getBoundingClientRect();
      return {
        labelWidth: element.clientWidth,
        labelScrollWidth: element.scrollWidth,
        inputWidth: input.clientWidth,
        inputScrollWidth: input.scrollWidth,
        labelRight: labelBox.right,
        inputRight: inputBox.right,
      };
    });
    expect(geometry.labelScrollWidth).toBeLessThanOrEqual(geometry.labelWidth + 1);
    expect(geometry.inputScrollWidth).toBeLessThanOrEqual(geometry.inputWidth + 1);
    expect(geometry.labelRight).toBeLessThanOrEqual(width + 1);
    expect(geometry.inputRight).toBeLessThanOrEqual(width + 1);
  }
});

test('Signal School gives a static outline instead of inert controls without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.getByText(/workroom needs javascript/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Check my choices' })).toHaveCount(0);
  await context.close();
});

test('Signal School clears displayed lesson feedback when a learner changes their answer', async ({ page }) => {
  await page.goto('/');
  await page.locator('astro-island:not([ssr])').first().waitFor();
  await page.getByRole('button', { name: /open guided lessons/i }).click();
  for (const select of await page.locator('.decision-grid select').all())
    await select.selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Check my choices' }).click();
  await expect(page.locator('.coaching')).toBeVisible();

  await page.locator('.decision-grid select').first().selectOption({ index: 2 });
  await expect(page.locator('.coaching')).toHaveCount(0);
  await expect(page.getByText('60 XP', { exact: true })).toBeVisible();
});

test('Signal School clears success feedback after edits in every multi-control lesson', async ({ page }) => {
  await page.goto('/');
  await page.locator('astro-island:not([ssr])').first().waitFor();
  await page.getByRole('button', { name: /open guided lessons/i }).click();
  const lesson = (name: string) => page.locator('.signal-progress').getByRole('button').filter({ hasText: name });

  await lesson('Give useful details').click();
  for (const index of [0, 1, 2, 3]) await page.getByRole('checkbox').nth(index).check();
  await page.getByRole('button', { name: 'Check selected details' }).click();
  await expect(page.locator('.coaching.good')).toBeVisible();
  await page.getByRole('checkbox').first().uncheck();
  await expect(page.locator('.coaching')).toHaveCount(0);
  await expect(page.getByText('60 XP', { exact: true })).toBeVisible();

  await lesson('Put it in order').click();
  await page.getByRole('button', { name: 'Move schedule up' }).click();
  await page.getByRole('button', { name: 'Move bring up' }).click();
  await page.getByRole('button', { name: 'Check order' }).click();
  await expect(page.locator('.coaching.good')).toBeVisible();
  await page.getByRole('button', { name: 'Move pending up' }).click();
  await expect(page.locator('.coaching')).toHaveCount(0);
  await expect(page.getByText('120 XP', { exact: true })).toBeVisible();

  await lesson('Check the facts').click();
  for (const select of await page.locator('.evidence-grid select').all()) await select.selectOption({ index: 1 });
  await page.locator('.evidence-grid select').nth(1).selectOption('Not established');
  await page.locator('.evidence-grid select').nth(2).selectOption('Contradicted');
  await page.getByRole('button', { name: 'Check the facts', exact: true }).click();
  await expect(page.locator('.coaching.good')).toBeVisible();
  await page.locator('.evidence-grid select').first().selectOption('Not established');
  await expect(page.locator('.coaching')).toHaveCount(0);
  await expect(page.getByText('180 XP', { exact: true })).toBeVisible();

  await lesson('Spot hidden instructions').click();
  for (const select of await page.locator('.decision-grid select').all()) await select.selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Check my decision' }).click();
  await expect(page.locator('.coaching.good')).toBeVisible();
  await page.locator('.decision-grid select').first().selectOption({ index: 2 });
  await expect(page.locator('.coaching')).toHaveCount(0);
  await expect(page.getByText('240 XP', { exact: true })).toBeVisible();

  await lesson('Compare two answers').click();
  for (const index of [0, 2, 4, 7, 9, 11]) await page.locator('.rubric-question button').nth(index).click();
  await page.getByRole('button', { name: 'Draft A', exact: true }).click();
  await page.getByRole('button', { name: 'Check my comparison' }).click();
  await expect(page.locator('.coaching.good')).toBeVisible();
  await page.locator('.rubric-question button').nth(1).click();
  await expect(page.locator('.coaching')).toHaveCount(0);
  await expect(page.getByText('300 XP', { exact: true })).toBeVisible();
});

test('Signal School rejects incomplete workshop exercise attempts', async ({ page }) => {
  await page.goto('/');
  await page.locator('astro-island:not([ssr])').first().waitFor();
  await page.getByRole('button', { name: /open final challenge/i }).click();
  await expect(page.getByRole('button', { name: 'Check this case' })).toBeDisabled();
  await page.getByRole('button', { name: /open guided lessons/i }).click();

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
  await page.getByRole('button', { name: /open final challenge/i }).click();
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
  await page.getByRole('button', { name: /open guided lessons/i }).click();
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
  await page.getByRole('button', { name: /open final challenge/i }).click();
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
  await page.getByRole('button', { name: /open final challenge/i }).click();
  await expect(page.getByText(/6 exercises remain/i)).toBeVisible();
});
