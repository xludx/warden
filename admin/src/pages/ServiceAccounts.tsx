import { useEffect, useState } from 'react';
import { api, type User, type Application, type ServiceGrant } from '../lib/api';

export default function ServiceAccounts() {
  const [accounts, setAccounts] = useState<User[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [appId, setAppId] = useState('');
  const [created, setCreated] = useState<{ clientId: string; clientSecret: string } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [grants, setGrants] = useState<Record<string, ServiceGrant[]>>({});
  const [addGrantFor, setAddGrantFor] = useState<string | null>(null);
  const [grantAppId, setGrantAppId] = useState('');
  const [grantScopes, setGrantScopes] = useState('');

  const load = () => {
    Promise.all([api.listServiceAccounts(), api.listApplications()])
      .then(([a, ap]) => { setAccounts(a); setApps(ap); })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await api.createServiceAccount(name, appId);
    setCreated({ clientId: result.clientId, clientSecret: result.clientSecret });
    setName('');
    setAppId('');
    load();
  };

  const toggleExpand = async (id: string) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!grants[id]) {
      const g = await api.listServiceGrants(id);
      setGrants((prev) => ({ ...prev, [id]: g }));
    }
  };

  const handleAddGrant = async (serviceUserId: string) => {
    if (!grantAppId || !grantScopes.trim()) return;
    const scopes = grantScopes.split(',').map((s) => s.trim()).filter(Boolean);
    await api.addServiceGrant(serviceUserId, grantAppId, scopes);
    const g = await api.listServiceGrants(serviceUserId);
    setGrants((prev) => ({ ...prev, [serviceUserId]: g }));
    setAddGrantFor(null);
    setGrantAppId('');
    setGrantScopes('');
  };

  const handleRemoveGrant = async (serviceUserId: string, grantId: string) => {
    await api.removeServiceGrant(serviceUserId, grantId);
    const g = await api.listServiceGrants(serviceUserId);
    setGrants((prev) => ({ ...prev, [serviceUserId]: g }));
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this service account?')) return;
    await api.deleteServiceAccount(id);
    load();
  };

  if (loading) return <p className="text-gray-500">Loading...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Service Accounts</h2>
        <button
          onClick={() => { setShowCreate(!showCreate); setCreated(null); }}
          className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-500"
        >
          {showCreate ? 'Cancel' : '+ New Service Account'}
        </button>
      </div>

      {created && (
        <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-4 mb-6">
          <p className="text-sm text-yellow-300 font-medium mb-2">Save these credentials — the secret won't be shown again.</p>
          <p className="text-xs font-mono text-gray-300">Client ID: {created.clientId}</p>
          <p className="text-xs font-mono text-gray-300">Client Secret: {created.clientSecret}</p>
        </div>
      )}

      {showCreate && (
        <form onSubmit={handleCreate} className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Service"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Application</label>
              <select
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                required
              >
                <option value="">Select...</option>
                {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
          <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-500">
            Create
          </button>
        </form>
      )}

      <div className="space-y-2">
        {accounts.map((account) => (
          <div key={account.id} className="bg-gray-900 border border-gray-800 rounded-lg">
            <div
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-800/50"
              onClick={() => toggleExpand(account.id)}
            >
              <div>
                <p className="font-medium text-white">🤖 {account.name}</p>
                <p className="text-sm text-gray-500">id: {account.id}</p>
              </div>
              <span className="text-xs text-gray-500">{new Date(account.createdAt).toLocaleDateString()}</span>
            </div>

            {expanded === account.id && (
              <div className="border-t border-gray-800 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-400">Grants</p>
                  <div className="flex gap-2">
                    <button onClick={() => { setAddGrantFor(account.id); setGrantAppId(''); }} className="text-xs text-blue-400 hover:text-blue-300">
                      + Add Grant
                    </button>
                    <button onClick={() => handleDelete(account.id)} className="text-xs text-red-400 hover:text-red-300">
                      Delete
                    </button>
                  </div>
                </div>

                {(grants[account.id] ?? []).map((g) => {
                  const targetApp = apps.find((a) => a.id === g.targetAppId);
                  return (
                    <div key={g.id} className="flex items-center justify-between bg-gray-800 rounded px-3 py-2">
                      <div>
                        <span className="text-sm text-white">{targetApp?.name ?? g.targetAppId}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {(g.scopes as string[]).map((s) => (
                          <span key={s} className="text-xs px-2 py-0.5 bg-gray-700 rounded">{s}</span>
                        ))}
                        <button onClick={() => handleRemoveGrant(account.id, g.id)} className="text-xs text-red-400 hover:text-red-300">
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
                {(grants[account.id] ?? []).length === 0 && <p className="text-sm text-gray-600">No grants</p>}

                {addGrantFor === account.id && (
                  <div className="space-y-2 bg-gray-800 rounded p-2">
                    <select
                      value={grantAppId}
                      onChange={(e) => setGrantAppId(e.target.value)}
                      className="w-full bg-gray-700 text-white text-sm rounded px-2 py-1"
                    >
                      <option value="">Target app...</option>
                      {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                    <input
                      value={grantScopes}
                      onChange={(e) => setGrantScopes(e.target.value)}
                      placeholder="Scopes (comma-separated): read:profiles, write:jobs"
                      className="w-full bg-gray-700 text-white text-sm rounded px-2 py-1"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => handleAddGrant(account.id)} className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-500">
                        Add
                      </button>
                      <button onClick={() => setAddGrantFor(null)} className="px-2 py-1 text-xs text-gray-400 hover:text-white">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {accounts.length === 0 && <p className="text-gray-500 text-sm">No service accounts yet.</p>}
      </div>
    </div>
  );
}
