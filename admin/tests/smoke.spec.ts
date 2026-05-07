import { expect, test } from '@playwright/test';
import { mockAdminApi, signInForUi } from './fixtures';

test('public landing page renders and links unauthenticated users to sign in', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /identity has a control plane now/i })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open admin' }).first()).toHaveAttribute('href', '/login');
  await expect(page.getByRole('heading', { name: 'Applications', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Service grants', exact: true })).toBeVisible();
});

test('admin route redirects unauthenticated users to login', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Warden' })).toBeVisible();
});

test('admin dashboard renders with mocked API data', async ({ page }) => {
  await signInForUi(page);
  await mockAdminApi(page);
  await page.goto('/admin');

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.locator('#main-content').getByText('Applications', { exact: true })).toBeVisible();
  await expect(page.getByText('Human users', { exact: true })).toBeVisible();
  await expect(page.getByText('Service accounts', { exact: true })).toBeVisible();
});

test('admin navigation reaches each primary page', async ({ page }) => {
  await signInForUi(page);
  await mockAdminApi(page);
  await page.goto('/admin');

  for (const item of [
    ['Applications', /\/admin\/applications$/],
    ['Users', /\/admin\/users$/],
    ['Service Accounts', /\/admin\/service-accounts$/],
    ['API Keys', /\/admin\/api-keys$/],
    ['Audit Log', /\/admin\/audit$/],
  ] as const) {
    await page.getByRole('link', { name: item[0] }).click();
    await expect(page).toHaveURL(item[1]);
    await expect(page.getByRole('heading', { name: item[0], exact: true })).toBeVisible();
  }
});
