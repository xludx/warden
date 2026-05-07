import { useEffect, useState } from 'react';
import { api, type ApiKey, type User, type Application } from '../lib/api';
import { ConceptPanel, ConfirmAction, CopyButton, EmptyState, ErrorState, LoadingState, Notice, PageHeader } from '../components/ui';

export default function ApiKeys() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [filterAppId, setFilterAppId] = useState('');
  const [filterUserId, setFilterUserId] = useState('');
  const [filterUsage, setFilterUsage] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    Promise.all([api.listApiKeys(), api.listUsers(), api.listApplications()])
      .then(([k, u, a]) => { setKeys(k); setUsers(u); setApps(a); })
      .catch((err) => setError(err instanceof Error ? err.message : 'API keys could not be loaded.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleDelete = async (key: ApiKey) => {
    await api.deleteApiKey(key.id);
    const owner = users.find((user) => user.id === key.userId);
    const app = apps.find((application) => application.id === key.appId);
    setSuccess(`${key.name} was revoked${owner && app ? ` for ${owner.name} on ${app.name}` : ''}. Clients using this key can no longer authenticate.`);
    load();
  };

  if (loading) return <LoadingState>Loading issued API keys...</LoadingState>;

  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
  const appMap = Object.fromEntries(apps.map((a) => [a.id, a]));
  const filteredKeys = keys.filter((key) => {
    const owner = userMap[key.userId];
    const app = appMap[key.appId];
    if (search.trim()) {
      const query = search.toLowerCase();
      const values = [key.name, key.prefix, key.id, owner?.name, owner?.email ?? '', app?.name, app?.slug];
      if (!values.some((value) => value?.toLowerCase().includes(query))) return false;
    }
    if (filterAppId && key.appId !== filterAppId) return false;
    if (filterUserId && key.userId !== filterUserId) return false;
    if (filterUsage === 'unused' && key.lastUsedAt) return false;
    if (filterUsage === 'used' && !key.lastUsedAt) return false;
    return true;
  });

  return (
    <div>
      <PageHeader title="API Keys" eyebrow="Scoped credentials">
        Each key belongs to one user and one application. Use the owner and application columns to verify the access path before revoking a credential.
      </PageHeader>

      <div className="space-y-4">
        {error && <ErrorState message={error} onRetry={load} />}
        {success && <Notice tone="success">{success}</Notice>}
        <ConceptPanel title="Before revoking an API key" items={["Confirm the owner", "Confirm the application", "Check the last-used time"]}>
          Revocation is immediate. Use the prefix, owner, application, and last-used time to make sure you are ending the right access path before clients start failing authentication.
        </ConceptPanel>

        <div className="grid gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 lg:grid-cols-[minmax(0,1fr)_220px_220px_160px_auto]">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search keys, owners, apps, or prefixes"
            aria-label="Search API keys by name, owner, application, or prefix"
            className="min-h-10 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select value={filterAppId} onChange={(event) => setFilterAppId(event.target.value)} className="min-h-10 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" aria-label="Filter API keys by application">
            <option value="">All applications</option>
            {apps.map((app) => <option key={app.id} value={app.id}>{app.name}</option>)}
          </select>
          <select value={filterUserId} onChange={(event) => setFilterUserId(event.target.value)} className="min-h-10 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" aria-label="Filter API keys by owner">
            <option value="">All owners</option>
            {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
          </select>
          <select value={filterUsage} onChange={(event) => setFilterUsage(event.target.value)} className="min-h-10 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" aria-label="Filter API keys by usage">
            <option value="">Any usage</option>
            <option value="unused">Never used</option>
            <option value="used">Used before</option>
          </select>
          {(search || filterAppId || filterUserId || filterUsage) && (
            <button type="button" onClick={() => { setSearch(''); setFilterAppId(''); setFilterUserId(''); setFilterUsage(''); }} className="min-h-10 rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300">
              Clear filters
            </button>
          )}
        </div>

        <p className="text-xs text-slate-400">Showing {filteredKeys.length} of {keys.length} API keys.</p>

        {keys.length === 0 ? (
          <EmptyState title="No API keys yet">
            Keys appear here after they are issued for users and applications. Revocation history will be visible in the audit log.
          </EmptyState>
        ) : filteredKeys.length === 0 ? (
          <EmptyState title="No API keys match these filters">
            Adjust the owner, application, usage, or search filters to widen the key list.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
            <div className="border-b border-slate-800 px-4 py-3 text-sm text-slate-400">
              Showing {filteredKeys.length} key{filteredKeys.length === 1 ? '' : 's'} across {new Set(filteredKeys.map((key) => key.appId)).size} {new Set(filteredKeys.map((key) => key.appId)).size === 1 ? 'application boundary' : 'application boundaries'}.
            </div>
            <table className="w-full min-w-[760px] text-sm">
              <caption className="sr-only">Issued API keys</caption>
              <thead>
                <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-[0.08em] text-slate-400">
                  <th scope="col" className="px-4 py-3">Prefix</th>
                  <th scope="col" className="px-4 py-3">Name</th>
                  <th scope="col" className="px-4 py-3">User</th>
                  <th scope="col" className="px-4 py-3">Application</th>
                  <th scope="col" className="px-4 py-3">Last used</th>
                  <th scope="col" className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredKeys.map((key) => (
                  <tr key={key.id} className="hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-400">{key.prefix}...</span>
                        <CopyButton value={key.id} label="Copy ID" />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-50">{key.name}</td>
                    <td className="px-4 py-3 text-slate-400">{userMap[key.userId]?.name ?? key.userId}</td>
                    <td className="px-4 py-3 text-slate-400">{appMap[key.appId]?.name ?? key.appId}</td>
                    <td className="px-4 py-3 text-slate-400">{key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : 'Never'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end">
                        <ConfirmAction label="Revoke" confirmLabel="Revoke API key" consequence={`Revoke ${key.name} for ${userMap[key.userId]?.name ?? 'this user'} on ${appMap[key.appId]?.name ?? 'this application'}? This cannot be undone. Requests signed with this key will fail immediately, so confirm the prefix and owner before revoking.`} onConfirm={() => handleDelete(key)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
