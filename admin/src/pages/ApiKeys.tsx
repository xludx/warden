import { useEffect, useState } from 'react';
import { api, type ApiKey, type User, type Application } from '../lib/api';

export default function ApiKeys() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    Promise.all([api.listApiKeys(), api.listUsers(), api.listApplications()])
      .then(([k, u, a]) => { setKeys(k); setUsers(u); setApps(a); })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Revoke this API key?')) return;
    await api.deleteApiKey(id);
    load();
  };

  if (loading) return <p className="text-gray-500">Loading...</p>;

  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
  const appMap = Object.fromEntries(apps.map((a) => [a.id, a]));

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">API Keys</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-800">
            <th className="pb-2">Prefix</th>
            <th className="pb-2">Name</th>
            <th className="pb-2">User</th>
            <th className="pb-2">App</th>
            <th className="pb-2">Last Used</th>
            <th className="pb-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {keys.map((key) => (
            <tr key={key.id} className="hover:bg-gray-900/50">
              <td className="py-2 font-mono text-xs text-gray-400">{key.prefix}...</td>
              <td className="py-2 text-white">{key.name}</td>
              <td className="py-2 text-gray-400">{userMap[key.userId]?.name ?? key.userId}</td>
              <td className="py-2 text-gray-400">{appMap[key.appId]?.name ?? key.appId}</td>
              <td className="py-2 text-gray-500">
                {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : 'Never'}
              </td>
              <td className="py-2">
                <button
                  onClick={() => handleDelete(key.id)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Revoke
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {keys.length === 0 && <p className="text-gray-500 text-sm mt-4">No API keys yet.</p>}
    </div>
  );
}
