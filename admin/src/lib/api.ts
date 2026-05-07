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

type ApiResponse = { success?: boolean; data?: unknown; error?: string; requestId?: string };
type RequestOptions = RequestInit & { action?: string };

function errorMessageFor(status: number, action: string, serverError?: string, requestId?: string): string {
  const reference = requestId ? ` Reference: ${requestId}.` : '';

  if (status === 400) return `${action} could not be completed. ${serverError || 'Check the fields and try again.'}${reference}`;
  if (status === 403) return `${action} was blocked. Your account does not have permission for this operation.${reference}`;
  if (status === 404) return `${action} could not find the record. It may have already been removed.${reference}`;
  if (status === 409) return `${action} conflicts with an existing record. ${serverError || 'Review the values and try again.'}${reference}`;
  if (status === 429) return `${action} was rate limited. Wait a moment, then try again.${reference}`;
  if (status >= 500) return `${action} failed on the server. Check the API logs${requestId ? ` for request ${requestId}` : ' for the failing request'}.`;
  return `${action} did not finish. ${serverError || `The server returned ${status}.`}${reference}`;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { action = 'This request', ...fetchOptions } = options;
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(path, { ...fetchOptions, headers });
  } catch {
    throw new Error(`${action} could not reach the Warden API. Check your connection and confirm the API service is running.`);
  }

  if (res.status === 401) {
    clearToken();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  const text = await res.text();
  const trimmed = text.trim();
  let json: ApiResponse | null = null;
  const requestId = res.headers.get('x-request-id') ?? undefined;

  if (trimmed && trimmed !== 'undefined') {
    try {
      json = JSON.parse(trimmed) as ApiResponse;
    } catch {
      const fallback = res.ok
        ? `${action} returned a response Warden could not read.`
        : `${action} failed because Warden could not read the server response. Check the API logs${requestId ? ` for request ${requestId}` : ' for the failing request'}.`;
      throw new Error(fallback);
    }
  }

  if (!res.ok) {
    throw new Error(errorMessageFor(res.status, action, json?.error, json?.requestId ?? requestId));
  }

  if (!json) {
    return undefined as T;
  }

  if (!json.success) {
    throw new Error(json.error || `${action} did not finish.`);
  }
  return json.data as T;
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>(`/api/auth/login`, {
      action: 'Sign in',
      method: 'POST',
      body: JSON.stringify({ email, password, appId: 'warden' }),
    }),

  me: () => request<User>(`/api/auth/me`, { action: 'Load your session' }),

  // Applications
  listApplications: () => request<Application[]>(`/api/admin/applications`, { action: 'Load applications' }),
  getApplication: (id: string) => request<Application>(`/api/admin/applications/${id}`, { action: 'Load application details' }),
  createApplication: (name: string, slug: string) =>
    request<Application>(`/api/admin/applications`, {
      action: 'Create application',
      method: 'POST',
      body: JSON.stringify({ name, slug }),
    }),
  deleteApplication: (id: string) =>
    request<void>(`/api/admin/applications/${id}`, { action: 'Delete application', method: 'DELETE' }),
  rotateSecret: (id: string) =>
    request<Application>(`/api/admin/applications/${id}/rotate-secret`, { action: 'Rotate application secret', method: 'POST' }),

  // Users
  listUsers: () => request<User[]>(`/api/admin/users`, { action: 'Load users' }),
  listAllMemberships: (userId: string) =>
    request<{ app: Application; role: string }[]>(`/api/admin/users/${userId}/memberships`, { action: 'Load user memberships' }),
  getUser: (id: string) => request<User>(`/api/admin/users/${id}`, { action: 'Load user details' }),
  deleteUser: (id: string) =>
    request<void>(`/api/admin/users/${id}`, { action: 'Delete user', method: 'DELETE' }),
  addMembership: (userId: string, appId: string, role: string) =>
    request<void>(`/api/admin/users/${userId}/memberships`, {
      action: 'Add membership',
      method: 'POST',
      body: JSON.stringify({ appId, role }),
    }),
  removeMembership: (userId: string, appId: string) =>
    request<void>(`/api/admin/users/${userId}/memberships`, {
      action: 'Remove membership',
      method: 'DELETE',
      body: JSON.stringify({ appId }),
    }),
  listUserMemberships: (userId: string) =>
    request<{ app: Application; role: string }[]>(`/api/admin/users/${userId}/memberships`, { action: 'Load user memberships' }),

  // Service Accounts
  listServiceAccounts: () => request<User[]>(`/api/admin/service-accounts`, { action: 'Load service accounts' }),
  createServiceAccount: (name: string, appId: string) =>
    request<{ user: User; clientId: string; clientSecret: string }>(`/api/admin/service-accounts`, {
      action: 'Create service account',
      method: 'POST',
      body: JSON.stringify({ name, appId }),
    }),
  deleteServiceAccount: (id: string) =>
    request<void>(`/api/admin/service-accounts/${id}`, { action: 'Delete service account', method: 'DELETE' }),

  // Service Grants
  listServiceGrants: (serviceUserId: string) =>
    request<ServiceGrant[]>(`/api/admin/service-accounts/${serviceUserId}/grants`, { action: 'Load service grants' }),
  addServiceGrant: (serviceUserId: string, targetAppId: string, scopes: string[]) =>
    request<ServiceGrant>(`/api/admin/service-accounts/${serviceUserId}/grants`, {
      action: 'Add service grant',
      method: 'POST',
      body: JSON.stringify({ targetAppId, scopes }),
    }),
  removeServiceGrant: (serviceUserId: string, grantId: string) =>
    request<void>(`/api/admin/service-accounts/${serviceUserId}/grants/${grantId}`, { action: 'Remove service grant', method: 'DELETE' }),

  // API Keys
  listApiKeys: () => request<ApiKey[]>(`/api/admin/api-keys`, { action: 'Load API keys' }),
  deleteApiKey: (id: string) =>
    request<void>(`/api/admin/api-keys/${id}`, { action: 'Revoke API key', method: 'DELETE' }),

  // Audit
  listAudit: (params?: { limit?: number; offset?: number; action?: string; actorId?: string; targetType?: string; appId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.offset) qs.set('offset', String(params.offset));
    if (params?.action) qs.set('action', params.action);
    if (params?.actorId) qs.set('actorId', params.actorId);
    if (params?.targetType) qs.set('targetType', params.targetType);
    if (params?.appId) qs.set('appId', params.appId);
    const query = qs.toString();
    return request<{ events: AuditEvent[]; total: number }>(`/api/admin/audit${query ? `?${query}` : ''}`, { action: 'Load audit events' });
  },
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

export type AuditEvent = {
  id: string;
  action: string;
  actorId: string | null;
  actorType: string | null;
  actorName: string | null;
  targetType: string | null;
  targetId: string | null;
  targetName: string | null;
  appId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
};
