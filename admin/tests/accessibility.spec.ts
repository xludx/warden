import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockAdminApi, signInForUi } from './fixtures';

async function expectNoAxeViolations(pageName: string, page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page }).analyze();

  expect(results.violations, `${pageName} should have no axe violations`).toEqual([]);
}

test('landing page has no automated accessibility violations', async ({ page }) => {
  await page.goto('/');
  await expectNoAxeViolations('Landing page', page);
});

test('login page has no automated accessibility violations', async ({ page }) => {
  await page.goto('/login');
  await expectNoAxeViolations('Login page', page);
});

test('admin pages have no automated accessibility violations', async ({ page }) => {
  await signInForUi(page);
  await mockAdminApi(page);

  for (const path of ['/admin', '/admin/applications', '/admin/users', '/admin/service-accounts', '/admin/api-keys', '/admin/audit']) {
    await page.goto(path);
    await expect(page.getByRole('main')).toBeVisible();
    await expectNoAxeViolations(path, page);
  }
});
