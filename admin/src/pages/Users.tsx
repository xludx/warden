import { useEffect, useState } from 'react';
import { api, type User, type Application } from '../lib/api';

type MembershipMap = Record<string, { app: Application; role: string }[]>;

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [memberships, setMemberships] = useState<MembershipMap>({});
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [filterAppId, setFilterAppId] = useState('');
  const [filterRole, setFilterRole] = useState('');

  // Expand / actions
  const [expanded, setExpanded] = useState<string | null>(null);
  const [addMemberFor, setAddMemberFor] = useState<string | null>(null);
  const [addAppId, setAddAppId] = useState('');
  const [addRole, setAddRole] = useState('viewer');

  const load = async () => {
    const [u, a] = await Promise.all([api.listUsers(), api.listApplications()]);
    setUsers(u);
    setApps(a);

    // Load memberships for all users so we can filter
    const m: MembershipMap = {};
    await Promise.all(
      u.map(async (user) => {
        m[user.id] = await api.listAllMemberships(user.id);
      }),
    );
    setMemberships(m);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleExpand = (userId: string) => {
    setExpanded(expanded === userId ? null : userId);
  };

  const handleAddMembership = async (userId: string) => {
    if (!addAppId) return;
    await api.addMembership(userId, addAppId, addRole);
    const m = await api.listAllMemberships(userId);
    setMemberships((prev) => ({ ...prev, [userId]: m }));
    setAddMemberFor(null);
    setAddAppId('');
  };

  const handleRemoveMembership = async (userId: string, appId: string) => {
    await api.removeMembership(userId, appId);
    const m = await api.listAllMemberships(userId);
    setMemberships((prev) => ({ ...prev, [userId]: m }));
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this user?')) return;
    await api.deleteUser(id);
    load();
  };

  // Filtering
  const filtered = users.filter((user) => {
    // Search by name or email
    if (search) {
      const q = search.toLowerCase();
      const matchesName = user.name.toLowerCase().includes(q);
      const matchesEmail = (user.email ?? '').toLowerCase().includes(q);
      if (!matchesName && !matchesEmail) return false;
    }

    // Filter by application
    if (filterAppId) {
      const userMemberships = memberships[user.id] ?? [];
      const hasApp = userMemberships.some((m) => m.app.id === filterAppId);
      if (!hasApp) return false;

      // Filter by role within that app
      if (filterRole) {
        const hasRole = userMemberships.some(
          (m) => m.app.id === filterAppId && m.role === filterRole,
        );
        if (!hasRole) return false;
      }
    }

    return true;
  });

  // Reset role filter when app changes
  const handleAppFilterChange = (appId: string) => {
    setFilterAppId(appId);
    setFilterRole('');
  };

  if (loading) return <p className="text-gray-500">Loading...</p>;

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Users</h2>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
        <select
          value={filterAppId}
          onChange={(e) => handleAppFilterChange(e.target.value)}
          className="px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-white"
        >
          <option value="">All applications</option>
          {apps.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        {filterAppId && (
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-white"
          >
            <option value="">All roles</option>
            <option value="admin">Admin</option>
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
          </select>
        )}
        {(search || filterAppId || filterRole) && (
          <button
            onClick={() => { setSearch(''); setFilterAppId(''); setFilterRole(''); }}
            className="text-xs text-gray-400 hover:text-white"
          >
            Clear
          </button>
        )}
      </div>

      <p className="text-xs text-gray-500 mb-3">{filtered.length} of {users.length} users</p>

      {/* User list */}
      <div className="space-y-2">
        {filtered.map((user) => (
          <div key={user.id} className="bg-gray-900 border border-gray-800 rounded-lg">
            <div
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-800/50"
              onClick={() => toggleExpand(user.id)}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-sm">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-white">{user.name}</p>
                  <p className="text-sm text-gray-500">{user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {(memberships[user.id] ?? []).map((m) => (
                  <span key={m.app.id} className="text-xs px-2 py-0.5 bg-gray-800 rounded text-gray-400">
                    {m.app.slug} <span className="text-gray-500">{m.role}</span>
                  </span>
                ))}
                <span className="text-xs text-gray-500">{new Date(user.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            {expanded === user.id && (
              <div className="border-t border-gray-800 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-400">Memberships</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setAddMemberFor(user.id); setAddAppId(''); }}
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      + Add
                    </button>
                    <button
                      onClick={() => handleDelete(user.id)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Delete user
                    </button>
                  </div>
                </div>

                {(memberships[user.id] ?? []).map((m) => (
                  <div key={m.app.id} className="flex items-center justify-between bg-gray-800 rounded px-3 py-2">
                    <div>
                      <span className="text-sm text-white">{m.app.name}</span>
                      <span className="text-xs text-gray-500 ml-2">({m.app.slug})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 bg-gray-700 rounded">{m.role}</span>
                      <button
                        onClick={() => handleRemoveMembership(user.id, m.app.id)}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
                {(memberships[user.id] ?? []).length === 0 && (
                  <p className="text-sm text-gray-600">No memberships</p>
                )}

                {addMemberFor === user.id && (
                  <div className="flex items-center gap-2 bg-gray-800 rounded p-2">
                    <select
                      value={addAppId}
                      onChange={(e) => setAddAppId(e.target.value)}
                      className="bg-gray-700 text-white text-sm rounded px-2 py-1"
                    >
                      <option value="">Select app...</option>
                      {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                    <select
                      value={addRole}
                      onChange={(e) => setAddRole(e.target.value)}
                      className="bg-gray-700 text-white text-sm rounded px-2 py-1"
                    >
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button
                      onClick={() => handleAddMembership(user.id)}
                      className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-500"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => setAddMemberFor(null)}
                      className="px-2 py-1 text-xs text-gray-400 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-gray-500 text-sm">{users.length === 0 ? 'No users yet.' : 'No users match filters.'}</p>
        )}
      </div>
    </div>
  );
}
