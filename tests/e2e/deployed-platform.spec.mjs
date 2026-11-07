import { test, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

class BlockedScenario extends Error {}

const runId = `${Date.now().toString(36)}${randomBytes(3).toString('hex')}`.slice(-12);
const makeAccount = (suffix) => ({
  username: `e2e_${suffix}_${runId}`.slice(0, 32),
  email: `sector-nine-e2e-${suffix}-${runId}@example.test`,
  password: `E2E!${randomBytes(18).toString('base64url')}a7`,
});

const accountA = makeAccount('a');
const accountB = makeAccount('b');
const secretValues = [accountA.password, accountB.password, accountA.email, accountB.email];

const redact = (value) => {
  let text = String(value || 'Unknown browser failure');
  for (const secret of secretValues) text = text.split(secret).join('[REDACTED]');
  return text
    .replace(/(authorization|cookie|token|password)(\s*[:=]\s*)[^\s,;]+/gi, '$1$2[REDACTED]')
    .replace(/([?&](?:token|code|state|session)=[^&\s]+)/gi, '[REDACTED_QUERY]')
    .slice(0, 1200);
};

const safePath = (rawUrl) => {
  try {
    const parsed = new URL(rawUrl);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return 'unparseable-url';
  }
};

const slug = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 72);

async function register(page, account) {
  await page.goto('/');
  await page.getByRole('tab', { name: 'REGISTER' }).click();
  await page.locator('#register-username').fill(account.username);
  await page.locator('#register-email').fill(account.email);
  await page.locator('#register-password').fill(account.password);
  await page.locator('#confirm-password').fill(account.password);
  await page.locator('#terms').check();
  const responsePromise = page.waitForResponse((response) => response.url().includes('/auth/signup') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'REQUEST ACCESS' }).click();
  const response = await responsePromise;
  expect(response.status(), 'Registration API must create the dedicated test account').toBe(201);
  await expect(page.getByRole('heading', { name: 'STEAM VERIFICATION' })).toBeVisible();
  await page.goto('/hub');
  await expect(page.getByRole('button', { name: 'Open account menu' })).toBeVisible();
}

async function login(page, email, password) {
  await page.goto('/');
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  const responsePromise = page.waitForResponse((response) => response.url().includes('/auth/signin') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'CONNECT TO FACILITY' }).click();
  const response = await responsePromise;
  expect(response.status(), 'Login API must accept the dedicated account').toBe(200);
  await expect(page.getByRole('button', { name: 'Open account menu' })).toBeVisible();
}

async function openConfigurationGroup(page, name) {
  const summary = page.locator('summary').filter({ hasText: name }).first();
  await expect(summary).toBeVisible();
  const details = summary.locator('xpath=..');
  if (!(await details.evaluate((node) => node.open))) await summary.click();
  await expect(details).toHaveAttribute('open', '');
  return details;
}

async function openSecureComms(page) {
  const input = page.getByPlaceholder('Type message...');
  if (await input.isVisible().catch(() => false)) return;
  const openButton = page.getByRole('button', { name: 'Open secure communications' });
  if (await openButton.isVisible().catch(() => false)) await openButton.click();
  await expect(page.getByText('SECURE COMMS', { exact: true }).last()).toBeVisible();
}

async function startChatWith(page, username) {
  await openSecureComms(page);
  await page.getByRole('tab', { name: /^FRIENDS/ }).click();
  const name = page.getByText(username, { exact: true }).last();
  await expect(name).toBeVisible();
  const row = name.locator('xpath=ancestor::div[contains(@class,"rounded") and contains(@class,"border")][1]');
  await row.locator('button').last().click();
  await expect(page.getByPlaceholder('Type message...')).toBeVisible();
}

async function closeSecureComms(page) {
  const panel = page.locator('div.fixed.bottom-4.right-4').filter({ hasText: 'SECURE COMMS' });
  if (!(await panel.isVisible().catch(() => false))) return;
  await panel.locator('button').nth(1).click();
  await expect(page.getByRole('button', { name: 'Open secure communications' })).toBeVisible();
}

function observePage(page, label, diagnostics) {
  page.on('pageerror', (error) => diagnostics.consoleErrors.push({ page: label, kind: 'pageerror', message: redact(error.message) }));
  page.on('console', (message) => {
    if (message.type() === 'error') diagnostics.consoleErrors.push({ page: label, kind: 'console', message: redact(message.text()) });
  });
  page.on('requestfailed', (request) => diagnostics.networkErrors.push({
    page: label,
    method: request.method(),
    status: 'FAILED',
    url: safePath(request.url()),
    reason: redact(request.failure()?.errorText || 'request failed'),
  }));
  page.on('response', (response) => {
    if (response.status() >= 400) diagnostics.networkErrors.push({
      page: label,
      method: response.request().method(),
      status: response.status(),
      url: safePath(response.url()),
    });
  });
}

test('deployed Sector Nine user journeys', async ({ browser }, testInfo) => {
  test.slow();
  const baseURL = process.env.PLAYWRIGHT_BASE_URL;
  const backendURL = process.env.SECTOR_NINE_BACKEND_URL;
  if (!baseURL || !backendURL) throw new Error('Railway URLs were not resolved by the controlled E2E runner.');

  const diagnostics = { consoleErrors: [], networkErrors: [] };
  const results = [];
  const screenshots = [];
  let contextA;
  let contextB;
  let pageA;
  let pageB;
  let accountsReady = false;
  let friendshipReady = false;

  const pagesForFailure = () => [pageA, pageB].filter((page) => page && !page.isClosed());
  const runScenario = async (name, operation) => {
    const started = Date.now();
    try {
      await test.step(name, operation);
      results.push({ name, status: 'passed', durationMs: Date.now() - started });
    } catch (error) {
      const status = error instanceof BlockedScenario ? 'blocked' : 'failed';
      const entry = { name, status, durationMs: Date.now() - started, reason: redact(error instanceof Error ? error.message : error) };
      results.push(entry);
      if (status === 'failed') {
        for (const [index, page] of pagesForFailure().entries()) {
          const screenshotPath = testInfo.outputPath(`${slug(name)}-${index + 1}.png`);
          await page.screenshot({ path: screenshotPath, fullPage: true, animations: 'disabled' }).catch(() => undefined);
          screenshots.push(path.relative(process.cwd(), screenshotPath));
        }
      }
    }
  };

  try {
    await runScenario('Unauthenticated protected routes and admin rejection', async () => {
      const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      observePage(page, 'public', diagnostics);
      await page.goto('/configuration');
      await expect(page).toHaveURL(new RegExp(`${baseURL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/?$`));
      await expect(page.getByRole('tab', { name: 'CONNECT' })).toBeVisible();
      await page.goto('/admin');
      await expect(page).toHaveURL(new RegExp(`${baseURL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/?$`));
      await context.close();
    });

    await runScenario('Registration and session restoration for two dedicated accounts', async () => {
      contextA = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } });
      contextB = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } });
      pageA = await contextA.newPage();
      pageB = await contextB.newPage();
      observePage(pageA, 'account-a', diagnostics);
      observePage(pageB, 'account-b', diagnostics);
      await register(pageA, accountA);
      await register(pageB, accountB);
      await pageA.reload();
      await expect(pageA.getByRole('button', { name: 'Open account menu' })).toBeVisible();
      await pageB.reload();
      await expect(pageB.getByRole('button', { name: 'Open account menu' })).toBeVisible();
      accountsReady = true;
    });

    await runScenario('Profile loading, settings persistence, stats and match history', async () => {
      if (!accountsReady) throw new BlockedScenario('Dedicated account registration did not complete.');
      const biography = `Playwright persistence check ${runId}`;
      await pageA.goto('/configuration');
      const accountGroup = await openConfigurationGroup(pageA, 'ACCOUNT AND PROFILE');
      await accountGroup.getByLabel('Biography').fill(biography);
      await accountGroup.getByRole('button', { name: 'SAVE CHANGES' }).click();
      await expect(pageA.getByRole('status')).toContainText('Account settings saved');
      await pageA.reload();
      const restoredGroup = await openConfigurationGroup(pageA, 'ACCOUNT AND PROFILE');
      await expect(restoredGroup.getByLabel('Biography')).toHaveValue(biography);
      await pageA.goto('/profile');
      await expect(pageA.getByRole('heading', { name: 'PERSONNEL PROFILE' })).toBeVisible();
      await expect(pageA.getByText(biography)).toBeVisible();
      await expect(pageA.getByText('MISSION HISTORY')).toBeVisible();
      await expect(pageA.getByText(/NO MATCH HISTORY AVAILABLE|VICTORY|DEFEAT/).first()).toBeVisible();
    });

    await runScenario('Primary navigation and empty/loading states', async () => {
      if (!accountsReady) throw new BlockedScenario('Dedicated account registration did not complete.');
      await pageA.goto('/hub');
      for (const [label, route] of [['MATCHMAKING', '/matchmaking'], ['STATS', '/stats'], ['TOURNAMENTS', '/tournaments'], ['SHOP', '/store'], ['HUB', '/hub']]) {
        await pageA.getByRole('link', { name: label, exact: true }).click();
        await expect(pageA).toHaveURL(new RegExp(`${route}$`));
      }
      await pageA.goto('/notifications');
      await expect(pageA.getByText(/You are all caught up\.|No notifications have arrived yet\.|UNREAD \(/).first()).toBeVisible();
    });

    await runScenario('Player discovery and friend request synchronization', async () => {
      if (!accountsReady) throw new BlockedScenario('Dedicated account registration did not complete.');
      await pageA.goto('/configuration');
      const friendsA = await openConfigurationGroup(pageA, 'FRIENDS');
      await friendsA.getByRole('tab', { name: 'FIND PLAYERS' }).click();
      await friendsA.getByLabel('Search registered players').fill(accountB.username);
      await expect(friendsA.getByText(accountB.username, { exact: true })).toBeVisible();
      await friendsA.getByRole('button', { name: 'ADD FRIEND' }).click();
      await expect(friendsA.getByRole('button', { name: 'CANCEL REQUEST' })).toBeVisible();
      await friendsA.getByRole('tab', { name: /^SENT/ }).click();
      await expect(friendsA.getByText(accountB.username, { exact: true })).toBeVisible();
      await expect(friendsA.getByText('REQUEST SENT')).toBeVisible();

      await pageB.goto('/configuration');
      const friendsB = await openConfigurationGroup(pageB, 'FRIENDS');
      await friendsB.getByRole('tab', { name: /^RECEIVED/ }).click();
      await expect(friendsB.getByText(accountA.username, { exact: true })).toBeVisible();

      await pageB.goto('/notifications');
      await expect(pageB.getByText('Friend Request', { exact: true })).toBeVisible();
      await pageB.getByRole('button', { name: 'ACCEPT', exact: true }).click();
      await expect(pageB.getByText('Friend request accepted')).toBeVisible();

      await pageA.goto('/configuration');
      const synchronizedFriends = await openConfigurationGroup(pageA, 'FRIENDS');
      await synchronizedFriends.getByRole('tab', { name: /^FRIENDS/ }).click();
      await expect(synchronizedFriends.getByText(accountB.username, { exact: true })).toBeVisible();
      friendshipReady = true;
    });

    await runScenario('Notification unread counter, mark-read action and player profile navigation', async () => {
      if (!friendshipReady) throw new BlockedScenario('Friendship was not established.');
      await pageA.goto('/hub');
      await pageA.getByRole('button', { name: 'Notifications' }).click();
      await expect(pageA.getByText('RECENT NOTIFICATIONS')).toBeVisible();
      await pageA.keyboard.press('Escape');
      await pageA.goto('/notifications');
      await expect(pageA.getByText('Friend Request Accepted', { exact: true })).toBeVisible();
      const markAll = pageA.getByRole('button', { name: /MARK ALL READ|READ ALL/ });
      await expect(markAll).toBeEnabled();
      await markAll.click();
      await expect(markAll).toBeDisabled();

      await pageA.goto('/players');
      await pageA.getByLabel('Search players').fill(accountB.username);
      await expect(pageA.getByText(`@${accountB.username}`, { exact: true })).toBeVisible();
      await pageA.getByRole('button', { name: 'VIEW PROFILE' }).first().click();
      await expect(pageA.getByRole('heading', { name: accountB.username })).toBeVisible();
      await expect(pageA.getByText('FRIENDS', { exact: true })).toBeVisible();
    });

    await runScenario('Secure Comms two-session delivery, unread state and reconnection', async () => {
      if (!friendshipReady) throw new BlockedScenario('Friendship was not established.');
      const message = `secure-comms-${runId}`;
      await pageA.goto('/hub');
      await pageB.goto('/hub');
      await startChatWith(pageA, accountB.username);
      await pageA.getByPlaceholder('Type message...').fill(message);
      await pageA.getByPlaceholder('Type message...').press('Enter');
      await expect(pageA.getByText(message, { exact: true })).toBeVisible();

      await openSecureComms(pageB);
      await pageB.getByRole('tab', { name: /^CHATS/ }).click();
      const room = pageB.getByText(accountA.username, { exact: true }).last();
      await expect(room, 'Incoming chat room should arrive through authenticated real-time updates').toBeVisible({ timeout: 20_000 });
      await room.click();
      await expect(pageB.getByText(message, { exact: true })).toBeVisible();
      await closeSecureComms(pageB);
      await pageB.reload();
      await openSecureComms(pageB);
      await pageB.getByText(accountA.username, { exact: true }).last().click();
      await expect(pageB.getByText(message, { exact: true })).toBeVisible();
      await closeSecureComms(pageA);
      await closeSecureComms(pageB);
    });

    await runScenario('Party create, invite, accept, synchronization, leave and disband', async () => {
      if (!friendshipReady) throw new BlockedScenario('Friendship was not established.');
      await pageA.goto('/matchmaking');
      await pageA.getByRole('button', { name: 'CREATE PARTY' }).click();
      await expect(pageA.getByRole('button', { name: /PARTY 1/ })).toBeVisible();
      await pageA.getByRole('button', { name: /PARTY 1/ }).click();
      await pageA.getByRole('button', { name: 'INVITE FRIENDS' }).click();
      await pageA.getByPlaceholder('Search friends...').fill(accountB.username);
      await pageA.getByRole('button', { name: 'INVITE', exact: true }).click();
      await expect(pageA.getByText('INVITED', { exact: true })).toBeVisible();

      await pageB.goto('/matchmaking');
      const inviteToggle = pageB.getByRole('button', { name: /PARTY INVITE/ });
      await expect(inviteToggle).toBeVisible({ timeout: 20_000 });
      await inviteToggle.click();
      await pageB.getByRole('button', { name: 'ACCEPT', exact: true }).click();
      await expect(pageB.getByRole('button', { name: /PARTY 2/ })).toBeVisible();
      if (!(await pageB.getByRole('button', { name: 'LEAVE' }).isVisible().catch(() => false))) {
        await pageB.getByRole('button', { name: /PARTY 2/ }).click();
      }
      await pageB.getByRole('button', { name: 'LEAVE' }).click();
      await expect(pageB.getByRole('button', { name: 'CREATE PARTY' })).toBeVisible();

      await pageA.reload();
      await expect(pageA.getByRole('button', { name: /PARTY 1/ })).toBeVisible();
      await pageA.getByRole('button', { name: /PARTY 1/ }).click();
      await pageA.getByRole('button', { name: 'DISBAND' }).click();
      await expect(pageA.getByRole('button', { name: 'CREATE PARTY' })).toBeVisible();
    });

    await runScenario('Matchmaking availability and Steam queue validation', async () => {
      if (!accountsReady) throw new BlockedScenario('Dedicated account registration did not complete.');
      await pageA.goto('/matchmaking');
      await pageA.getByRole('tab', { name: 'MODS' }).click();
      const oneVsOne = pageA.getByText(/Adrenaline Gamer 6\.6.*1v1/).first().locator('xpath=ancestor::div[contains(@class,"border-2")][1]');
      const twoVsTwo = pageA.getByText(/Adrenaline Gamer 6\.6.*2v2/).first().locator('xpath=ancestor::div[contains(@class,"border-2")][1]');
      await expect(oneVsOne).toContainText('AVAILABLE');
      await expect(twoVsTwo).toContainText('UNAVAILABLE');
      await expect(twoVsTwo).toContainText('four-player Host Agent orchestration');

      await pageA.goto('/configuration');
      const accountGroup = await openConfigurationGroup(pageA, 'ACCOUNT AND PROFILE');
      await accountGroup.getByLabel('Game to play').click();
      const csOption = pageA.getByRole('option', { name: /Counter-Strike 1\.6.*Unavailable/ });
      await expect(csOption).toHaveAttribute('data-disabled', '');
      await pageA.keyboard.press('Escape');

      await pageA.goto('/matchmaking');
      await pageA.getByRole('tab', { name: 'MAPS' }).click();
      const mapCheckboxes = pageA.getByRole('checkbox');
      expect(await mapCheckboxes.count()).toBeGreaterThanOrEqual(5);
      for (let index = 0; index < 5; index += 1) await mapCheckboxes.nth(index).locator('xpath=..').click();
      const findMatch = pageA.getByRole('button', { name: 'FIND MATCH' });
      await expect(findMatch).toBeEnabled();
      await findMatch.click();
      await expect(pageA.getByText('Steam Account Required', { exact: true })).toBeVisible();
      await expect(pageA.getByText(/Connect Steam in Account Settings/)).toBeVisible();
    });

    await runScenario('Authenticated non-admin rejection and optional admin read-only UI', async () => {
      if (!accountsReady) throw new BlockedScenario('Dedicated account registration did not complete.');
      await pageA.goto('/admin');
      await expect(pageA).toHaveURL(/\/hub$/);

      const adminEmail = process.env.E2E_ADMIN_EMAIL;
      const adminPassword = process.env.E2E_ADMIN_PASSWORD;
      if (!adminEmail || !adminPassword) throw new BlockedScenario('No authorized dedicated admin credentials were supplied through E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD.');
      const adminContext = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } });
      const adminPage = await adminContext.newPage();
      observePage(adminPage, 'admin', diagnostics);
      try {
        await login(adminPage, adminEmail, adminPassword);
        await adminPage.goto('/admin');
        await expect(adminPage.locator('.admin-root')).toBeVisible();
      } finally {
        await adminContext.close();
      }
    });

    await runScenario('Friend removal and block/unblock ownership-safe cleanup', async () => {
      if (!friendshipReady) throw new BlockedScenario('Friendship was not established.');
      await pageA.goto('/players');
      await pageA.getByLabel('Search players').fill(accountB.username);
      await expect(pageA.getByText(`@${accountB.username}`, { exact: true })).toBeVisible();
      await pageA.getByRole('button', { name: 'VIEW PROFILE' }).first().click();
      await pageA.getByRole('button', { name: 'REMOVE', exact: true }).click();
      await pageA.getByRole('button', { name: 'REMOVE', exact: true }).last().click();
      await expect(pageA.getByRole('button', { name: 'ADD FRIEND' })).toBeVisible();
      await pageA.getByRole('button', { name: 'BLOCK', exact: true }).click();
      await pageA.getByRole('button', { name: 'BLOCK', exact: true }).last().click();
      await expect(pageA.getByRole('button', { name: 'UNBLOCK PLAYER' })).toBeVisible();
      await pageA.getByRole('button', { name: 'UNBLOCK PLAYER' }).click();
      await expect(pageA.getByRole('button', { name: 'ADD FRIEND' })).toBeVisible();
      friendshipReady = false;
    });

    await runScenario('Logout, protected redirect, login and refresh-token restoration', async () => {
      if (!accountsReady) throw new BlockedScenario('Dedicated account registration did not complete.');
      await pageA.goto('/hub');
      await pageA.getByRole('button', { name: 'Open account menu' }).click();
      await pageA.getByText('DISCONNECT', { exact: true }).click();
      await expect(pageA.getByRole('tab', { name: 'CONNECT' })).toBeVisible();
      await pageA.goto('/configuration');
      await expect(pageA.getByRole('tab', { name: 'CONNECT' })).toBeVisible();
      await login(pageA, accountA.email, accountA.password);
      await pageA.goto('/hub');
      await pageA.reload();
      await expect(pageA.getByRole('button', { name: 'Open account menu' })).toBeVisible();
    });

    await runScenario('Console errors and failed network request review', async () => {
      const unexpectedConsole = diagnostics.consoleErrors.filter((item) => !/Failed to load resource.*403/i.test(item.message));
      const severeNetwork = diagnostics.networkErrors.filter((item) => item.status === 'FAILED' || Number(item.status) >= 500);
      expect(unexpectedConsole, `Unexpected browser console errors: ${JSON.stringify(unexpectedConsole)}`).toEqual([]);
      expect(severeNetwork, `Failed or server-error requests: ${JSON.stringify(severeNetwork)}`).toEqual([]);
    });
  } finally {
    await contextA?.close().catch(() => undefined);
    await contextB?.close().catch(() => undefined);

    const summary = {
      generatedAt: new Date().toISOString(),
      deployment: {
        project: 'extraordinary-nature',
        environment: 'production',
        frontend: safePath(baseURL),
        backend: safePath(backendURL),
        commit: process.env.SECTOR_NINE_DEPLOYED_COMMIT || 'unknown',
      },
      totals: {
        executed: results.length,
        passed: results.filter((item) => item.status === 'passed').length,
        failed: results.filter((item) => item.status === 'failed').length,
        blocked: results.filter((item) => item.status === 'blocked').length,
      },
      scenarios: results,
      diagnostics: {
        consoleErrors: diagnostics.consoleErrors,
        networkErrors: diagnostics.networkErrors,
      },
      artifacts: {
        screenshots,
        authenticatedTraces: 'disabled to prevent session-cookie and credential capture',
      },
      testData: {
        accountCount: 2,
        credentialsRecorded: false,
        cleanup: 'Only the test-owned friendship, party and block relationship were removed. Dedicated accounts were retained because no safe user self-delete flow exists.',
      },
    };
    await mkdir(path.join(process.cwd(), 'test-results'), { recursive: true });
    const summaryPath = path.join(process.cwd(), 'test-results', 'e2e-summary.json');
    await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
    await testInfo.attach('sanitized-e2e-summary', { body: Buffer.from(JSON.stringify(summary, null, 2)), contentType: 'application/json' });
  }

  const failures = results.filter((item) => item.status === 'failed');
  expect(failures, `${failures.length} browser scenario(s) failed. See test-results/e2e-summary.json.`).toEqual([]);
});
