import type { Page } from '@playwright/test';

export async function mockAdminApi(page: Page) {
  await page.route('/api/admin/applications', async (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({ json: { success: true, data: application } });
    }
    return route.fulfill({ json: { success: true, data: [application] } });
  });

  await page.route('/api/admin/users', async (route) => {
    return route.fulfill({ json: { success: true, data: [humanUser, serviceUser] } });
  });

  await page.route('/api/admin/users/*/memberships', async (route) => {
    return route.fulfill({ json: { success: true, data: [{ app: application, role: 'admin' }] } });
  });

  await page.route('/api/admin/service-accounts', async (route) => {
    return route.fulfill({ json: { success: true, data: [serviceUser] } });
  });

  await page.route('/api/admin/service-accounts/*/grants', async (route) => {
    return route.fulfill({ json: { success: true, data: [grant] } });
  });

  await page.route('/api/admin/api-keys', async (route) => {
    return route.fulfill({ json: { success: true, data: [apiKey] } });
  });

  await page.route('/api/admin/audit**', async (route) => {
    return route.fulfill({ json: { success: true, data: { events: [auditEvent], total: 1 } } });
  });
}

export async function signInForUi(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('warden_token', 'test-token');
  });
}

const application = {
  id: 'app_warden',
  name: 'Warden Admin',
  slug: 'warden',
  jwtSecret: 'test-secret',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const humanUser = {
  id: 'usr_alex',
  email: 'alex@example.com',
  name: 'Alex App Owner',
  avatarUrl: null,
  type: 'human',
  createdAt: '2026-01-02T00:00:00.000Z',
};

const serviceUser = {
  id: 'svc_billing',
  email: null,
  name: 'Billing Worker',
  avatarUrl: null,
  type: 'service',
  createdAt: '2026-01-03T00:00:00.000Z',
};

const grant = {
  id: 'grant_1',
  serviceUserId: 'svc_billing',
  targetAppId: 'app_warden',
  scopes: ['read:profiles', 'write:jobs'],
  createdAt: '2026-01-04T00:00:00.000Z',
};

const apiKey = {
  id: 'key_1',
  userId: 'usr_alex',
  appId: 'app_warden',
  name: 'Local development key',
  prefix: 'wrd_dev',
  createdAt: '2026-01-05T00:00:00.000Z',
  lastUsedAt: null,
};

const auditEvent = {
  id: 'evt_1',
  action: 'application.created',
  actorId: 'usr_alex',
  actorType: 'human',
  actorName: 'Alex App Owner',
  targetType: 'application',
  targetId: 'app_warden',
  targetName: 'Warden Admin',
  appId: 'app_warden',
  metadata: null,
  ipAddress: '127.0.0.1',
  createdAt: '2026-01-06T00:00:00.000Z',
};
