import { useEffect, useState } from 'react';
import { api, type Application } from '../lib/api';

export default function Applications() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [revealSecret, setRevealSecret] = useState<string | null>(null);

  const load = () => {
    api.listApplications().then(setApps).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.createApplication(name, slug);
    setName('');
    setSlug('');
    setShowCreate(false);
    load();
  };

  const handleRotate = async (id: string) => {
    if (!confirm('Rotating the JWT secret will invalidate all active tokens. Continue?')) return;
    const app = await api.rotateSecret(id);
    setRevealSecret(app.id);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this application? This will cascade-delete all memberships and API keys.')) return;
    await api.deleteApplication(id);
    load();
  };

  if (loading) return <p className="text-gray-500">Loading...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Applications</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-500"
        >
          {showCreate ? 'Cancel' : '+ New Application'}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Slug</label>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="my-app"
                pattern="[a-z0-9-]+"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                required
              />
            </div>
          </div>
          <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-500">
            Create
          </button>
        </form>
      )}

      <div className="space-y-3">
        {apps.map((app) => (
          <div key={app.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-medium text-white">{app.name}</h3>
                <p className="text-sm text-gray-500">slug: {app.slug}</p>
                <p className="text-sm text-gray-500">id: {app.id}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleRotate(app.id)}
                  className="px-2 py-1 text-xs bg-yellow-900/30 text-yellow-400 border border-yellow-800 rounded hover:bg-yellow-900/50"
                >
                  Rotate Secret
                </button>
                <button
                  onClick={() => handleDelete(app.id)}
                  className="px-2 py-1 text-xs bg-red-900/30 text-red-400 border border-red-800 rounded hover:bg-red-900/50"
                >
                  Delete
                </button>
              </div>
            </div>
            <div className="mt-3">
              <button
                onClick={() => setRevealSecret(revealSecret === app.id ? null : app.id)}
                className="text-xs text-gray-500 hover:text-gray-300"
              >
                {revealSecret === app.id ? 'Hide' : 'Reveal'} JWT Secret
              </button>
              {revealSecret === app.id && (
                <p className="mt-1 text-xs font-mono text-yellow-300 bg-gray-800 p-2 rounded break-all">
                  {app.jwtSecret}
                </p>
              )}
            </div>
          </div>
        ))}
        {apps.length === 0 && <p className="text-gray-500 text-sm">No applications yet.</p>}
      </div>
    </div>
  );
}
