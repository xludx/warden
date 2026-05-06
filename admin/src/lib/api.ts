const TOKEN_KEY = 'warden_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(path, { ...options, headers });

  if (res.status === 401) {
    clearToken();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error || 'Request failed');
  }
  return json.data as T;
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>(`/api/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email, password, appId: 'warden' }),
    }),

  me: () => request<User>(`/api/auth/me`),

  // Applications
  listApplications: () => request<Application[]>(`/api/admin/applications`),
  getApplication: (id: string) => request<Application>(`/api/admin/applications/${id}`),
  createApplication: (name: string, slug: string) =>
    request<Application>(`/api/admin/applications`, {
      method: 'POST',
      body: JSON.stringify({ name, slug }),
    }),
  deleteApplication: (id: string) =>
    request<void>(`/api/admin/applications/${id}`, { method: 'DELETE' }),
  rotateSecret: (id: string) =>
    request<Application>(`/api/admin/applications/${id}/rotate-secret`, { method: 'POST' }),

  // Users
  listUsers: () => request<User[]>(`/api/admin/users`),
  getUser: (id: string) => request<User>(`/api/admin/users/${id}`),
  deleteUser: (id: string) =>
    request<void>(`/api/admin/users/${id}`, { method: 'DELETE' }),
  addMembership: (userId: string, appId: string, role: string) =>
    request<void>(`/api/admin/users/${userId}/memberships`, {
      method: 'POST',
      body: JSON.stringify({ appId, role }),
    }),
  removeMembership: (userId: string, appId: string) =>
    request<void>(`/api/admin/users/${userId}/memberships`, {
      method: 'DELETE',
      body: JSON.stringify({ appId }),
    }),
  listUserMemberships: (userId: string) =>
    request<{ app: Application; role: string }[]>(`/api/admin/users/${userId}/memberships`),

  // Service Accounts
  listServiceAccounts: () => request<User[]>(`/api/admin/service-accounts`),
  createServiceAccount: (name: string, appId: string) =>
    request<{ user: User; clientId: string; clientSecret: string }>(`/api/admin/service-accounts`, {
      method: 'POST',
      body: JSON.stringify({ name, appId }),
    }),
  deleteServiceAccount: (id: string) =>
    request<void>(`/api/admin/service-accounts/${id}`, { method: 'DELETE' }),

  // Service Grants
  listServiceGrants: (serviceUserId: string) =>
    request<ServiceGrant[]>(`/api/admin/service-accounts/${serviceUserId}/grants`),
  addServiceGrant: (serviceUserId: string, targetAppId: string, scopes: string[]) =>
    request<ServiceGrant>(`/api/admin/service-accounts/${serviceUserId}/grants`, {
      method: 'POST',
      body: JSON.stringify({ targetAppId, scopes }),
    }),
  removeServiceGrant: (serviceUserId: string, grantId: string) =>
    request<void>(`/api/admin/service-accounts/${serviceUserId}/grants/${grantId}`, { method: 'DELETE' }),

  // API Keys
  listApiKeys: () => request<ApiKey[]>(`/api/admin/api-keys`),
  deleteApiKey: (id: string) =>
    request<void>(`/api/admin/api-keys/${id}`, { method: 'DELETE' }),
};

// Types
export type User = {
  id: string;
  email: string | null;
  name: string;
  avatarUrl: string | null;
  type: 'human' | 'service';
  createdAt: string;
};

export type Application = {
  id: string;
  name: string;
  slug: string;
  jwtSecret: string;
  createdAt: string;
};

export type ServiceGrant = {
  id: string;
  serviceUserId: string;
  targetAppId: string;
  scopes: string[];
  createdAt: string;
};

export type ApiKey = {
  id: string;
  userId: string;
  appId: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
};
