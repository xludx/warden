import { expect, test, type Page } from '@playwright/test';
import { signInForUi } from './fixtures';

const existingApplication = {
  id: 'app_existing',
  name: 'Existing App',
  slug: 'existing',
  jwtSecret: 'existing-secret',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const createdApplication = {
  id: 'app_created',
  name: 'Billing API',
  slug: 'billing-api',
  jwtSecret: 'created-secret',
  createdAt: '2026-01-02T00:00:00.000Z',
};

async function mockRelationshipEndpoints(page: Page) {
  await page.route('/api/admin/users', async (route) => route.fulfill({ json: { success: true, data: [] } }));
  await page.route('/api/admin/api-keys', async (route) => route.fulfill({ json: { success: true, data: [] } }));
  await page.route('/api/admin/service-accounts', async (route) => route.fulfill({ json: { success: true, data: [] } }));
  await page.route('/api/admin/users/*/memberships', async (route) => route.fulfill({ json: { success: true, data: [] } }));
  await page.route('/api/admin/service-accounts/*/grants', async (route) => route.fulfill({ json: { success: true, data: [] } }));
}

test('creates an application and shows success feedback', async ({ page }) => {
  await signInForUi(page);
  await mockRelationshipEndpoints(page);

  let applications = [existingApplication];
  await page.route('/api/admin/applications', async (route) => {
    if (route.request().method() === 'POST') {
      applications = [...applications, createdApplication];
      return route.fulfill({ json: { success: true, data: createdApplication } });
    }
    return route.fulfill({ json: { success: true, data: applications } });
  });

  await page.goto('/admin/applications');
  await page.getByRole('button', { name: 'Create application' }).click();
  await page.locator('form').getByLabel('Name').fill('Billing API');
  await page.locator('form').getByLabel('Slug').fill('billing-api');
  await page.getByRole('button', { name: 'Create application' }).click();

  await expect(page.getByText('Application created.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Billing API' })).toBeVisible();
  await expect(page.getByText(/Unexpected token/)).toHaveCount(0);
});

test('deletes an application and shows success feedback', async ({ page }) => {
  await signInForUi(page);
  await mockRelationshipEndpoints(page);

  let applications = [existingApplication];
  await page.route('/api/admin/applications', async (route) => {
    return route.fulfill({ json: { success: true, data: applications } });
  });
  await page.route('/api/admin/applications/app_existing', async (route) => {
    if (route.request().method() === 'DELETE') {
      applications = [];
      return route.fulfill({ json: { success: true, data: { deleted: true } } });
    }
    return route.fulfill({ json: { success: true, data: existingApplication } });
  });

  await page.goto('/admin/applications');
  await page.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Delete application' }).click();

  await expect(page.getByText('Existing App was deleted. Its memberships, API keys, and connected service grants no longer apply.')).toBeVisible();
  await expect(page.getByText(/Unexpected token/)).toHaveCount(0);
});

test('create application handles malformed server errors without JSON parse text', async ({ page }) => {
  await signInForUi(page);
  await mockRelationshipEndpoints(page);

  await page.route('/api/admin/applications', async (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({ status: 500, contentType: 'text/plain', body: 'undefined' });
    }
    return route.fulfill({ json: { success: true, data: [] } });
  });

  await page.goto('/admin/applications');
  await page.locator('header').getByRole('button', { name: 'Create application' }).click();
  await page.locator('form').getByLabel('Name').fill('Broken App');
  await page.locator('form').getByLabel('Slug').fill('broken-app');
  await page.locator('form').getByRole('button', { name: 'Create application' }).click();

  await expect(page.getByText('Create application failed on the server. Check the API logs for the failing request.')).toBeVisible();
  await expect(page.getByText(/Unexpected token/)).toHaveCount(0);
  await expect(page.getByText(/not valid JSON/)).toHaveCount(0);
});

test('delete application handles malformed server errors without JSON parse text', async ({ page }) => {
  await signInForUi(page);
  await mockRelationshipEndpoints(page);

  await page.route('/api/admin/applications', async (route) => {
    return route.fulfill({ json: { success: true, data: [existingApplication] } });
  });
  await page.route('/api/admin/applications/app_existing', async (route) => {
    if (route.request().method() === 'DELETE') {
      return route.fulfill({ status: 500, contentType: 'text/plain', body: 'undefined' });
    }
    return route.fulfill({ json: { success: true, data: existingApplication } });
  });

  await page.goto('/admin/applications');
  await page.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Delete application' }).click();

  await expect(page.getByText('Delete application failed on the server. Check the API logs for the failing request.')).toBeVisible();
  await expect(page.getByText(/Unexpected token/)).toHaveCount(0);
  await expect(page.getByText(/not valid JSON/)).toHaveCount(0);
});
