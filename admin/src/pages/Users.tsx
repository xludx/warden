import { useEffect, useState } from 'react';
import { api, type User, type Application } from '../lib/api';
import { ConceptPanel, ConfirmAction, EmptyState, ErrorState, LoadingState, Notice, PageHeader } from '../components/ui';

type MembershipMap = Record<string, { app: Application; role: string }[]>;

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [memberships, setMemberships] = useState<MembershipMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [filterAppId, setFilterAppId] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [addMemberFor, setAddMemberFor] = useState<string | null>(null);
  const [addAppId, setAddAppId] = useState('');
  const [addRole, setAddRole] = useState('viewer');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [u, a] = await Promise.all([api.listUsers(), api.listApplications()]);
      setUsers(u);
      setApps(a);
      const m: MembershipMap = {};
      await Promise.all(u.map(async (user) => { m[user.id] = await api.listAllMemberships(user.id); }));
      setMemberships(m);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Users could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAddMembership = async (userId: string) => {
    if (!addAppId) return;
    await api.addMembership(userId, addAppId, addRole);
    const m = await api.listAllMemberships(userId);
    setMemberships((prev) => ({ ...prev, [userId]: m }));
    setAddMemberFor(null);
    setAddAppId('');
    const app = apps.find((application) => application.id === addAppId);
    setSuccess(`Membership added${app ? ` for ${app.name}` : ''}. The user now has the selected role in that application.`);
  };

  const handleRemoveMembership = async (userId: string, appId: string) => {
    await api.removeMembership(userId, appId);
    const m = await api.listAllMemberships(userId);
    setMemberships((prev) => ({ ...prev, [userId]: m }));
    const app = apps.find((application) => application.id === appId);
    setSuccess(`Membership removed${app ? ` from ${app.name}` : ''}. Access through that application role is no longer granted.`);
  };

  const handleDelete = async (user: User) => {
    await api.deleteUser(user.id);
    setSuccess(`${user.name} was deleted. Their memberships and user-owned access records no longer apply.`);
    load();
  };

  const filtered = users.filter((user) => {
    if (search) {
      const q = search.toLowerCase();
      if (!user.name.toLowerCase().includes(q) && !(user.email ?? '').toLowerCase().includes(q)) return false;
    }
    if (filterAppId) {
      const userMemberships = memberships[user.id] ?? [];
      if (!userMemberships.some((m) => m.app.id === filterAppId)) return false;
      if (filterRole && !userMemberships.some((m) => m.app.id === filterAppId && m.role === filterRole)) return false;
    }
    return true;
  });

  if (loading) return <LoadingState>Loading users and memberships...</LoadingState>;

  return (
    <div>
      <PageHeader title="Users" eyebrow="People and roles">
        Users are global identities. Memberships decide which application each person can access and which role applies there.
      </PageHeader>

      <div className="space-y-4">
        {error && <ErrorState message={error} onRetry={load} />}
        {success && <Notice tone="success">{success}</Notice>}
        <ConceptPanel title="Before changing user access" items={["Membership changes one app", "Deleting removes the identity", "Roles take effect immediately"]}>
          Add or remove memberships when a person's access changes for one application. Delete the user only when the identity should be removed from Warden entirely.
        </ConceptPanel>

        <div className="grid gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 lg:grid-cols-[minmax(0,1fr)_220px_160px_auto]">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email"
            aria-label="Search users by name or email"
            className="min-h-10 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select value={filterAppId} onChange={(e) => { setFilterAppId(e.target.value); setFilterRole(''); }} className="min-h-10 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" aria-label="Filter by application">
            <option value="">All applications</option>
            {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} disabled={!filterAppId} className="min-h-10 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50" aria-label="Filter by role">
            <option value="">All roles</option>
            <option value="admin">Admin</option>
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
          </select>
          {(search || filterAppId || filterRole) && (
            <button type="button" onClick={() => { setSearch(''); setFilterAppId(''); setFilterRole(''); }} className="min-h-10 rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300">
              Clear filters
            </button>
          )}
        </div>

        <p className="text-xs text-slate-400">{filtered.length} of {users.length} users</p>

        {filtered.length === 0 ? (
          <EmptyState title={users.length === 0 ? 'No users yet' : 'No users match these filters'}>
            {users.length === 0 ? 'Users appear after registration or provisioning. Memberships will show which application each person can access.' : 'Adjust search or filters to widen the user list.'}
          </EmptyState>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
            {filtered.map((user) => {
              const isExpanded = expanded === user.id;
              return (
                <article key={user.id} className="border-b border-slate-800 last:border-b-0">
                  <button type="button" className="flex w-full items-center justify-between gap-4 p-4 text-left hover:bg-slate-800/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-blue-300" onClick={() => setExpanded(isExpanded ? null : user.id)} aria-expanded={isExpanded} aria-controls={`user-${user.id}-memberships`}>
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-700 text-sm text-slate-100" aria-hidden="true">{user.name.charAt(0).toUpperCase()}</span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-slate-50">{user.name}</span>
                        <span className="block truncate text-sm text-slate-400">{user.email ?? 'No email recorded'}</span>
                      </span>
                    </span>
                    <span className="hidden flex-wrap justify-end gap-2 md:flex">
                      {(memberships[user.id] ?? []).slice(0, 3).map((m) => <span key={m.app.id} className="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-400">{m.app.slug} <span className="text-slate-400">{m.role}</span></span>)}
                    </span>
                  </button>

                  {isExpanded && (
                    <div id={`user-${user.id}-memberships`} className="border-t border-slate-800 p-4">
                      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-slate-400">Memberships define access for this user.</p>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => { setAddMemberFor(user.id); setAddAppId(''); }} className="rounded px-2 py-1 text-xs font-medium text-blue-300 hover:bg-blue-950/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300">Add membership</button>
                          <ConfirmAction label="Delete user" confirmLabel="Delete user" consequence={`Delete ${user.name}? This cannot be undone. Warden will remove this identity and ${memberships[user.id]?.length ?? 0} membership${(memberships[user.id]?.length ?? 0) === 1 ? '' : 's'} tied to the user.`} onConfirm={() => handleDelete(user)} />
                        </div>
                      </div>

                      <div className="space-y-2">
                        {(memberships[user.id] ?? []).map((m) => (
                          <div key={m.app.id} className="flex flex-col gap-3 rounded-lg bg-slate-800 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <span className="block truncate text-sm text-slate-50">{m.app.name}</span>
                              <span className="text-xs text-slate-400">{m.app.slug}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="rounded-md bg-slate-700 px-2 py-1 text-xs text-slate-200">{m.role}</span>
                              <ConfirmAction label="Remove" confirmLabel="Remove membership" consequence={`Remove ${user.name} from ${m.app.name}? Access through the ${m.role} role stops immediately, but the user remains in Warden and other application memberships stay unchanged.`} onConfirm={() => handleRemoveMembership(user.id, m.app.id)} />
                            </div>
                          </div>
                        ))}
                        {(memberships[user.id] ?? []).length === 0 && <p className="text-sm text-slate-400">No memberships. Add one to grant application access.</p>}
                      </div>

                      {addMemberFor === user.id && (
                        <div className="mt-3 grid gap-2 rounded-lg bg-slate-800 p-3 sm:grid-cols-[minmax(0,1fr)_160px_auto_auto]">
                          <select value={addAppId} onChange={(e) => setAddAppId(e.target.value)} className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" aria-label="Application for new membership">
                            <option value="">Select application</option>
                            {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                          </select>
                          <select value={addRole} onChange={(e) => setAddRole(e.target.value)} className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" aria-label="Role for new membership">
                            <option value="viewer">Viewer</option>
                            <option value="editor">Editor</option>
                            <option value="admin">Admin</option>
                          </select>
                          <button type="button" onClick={() => handleAddMembership(user.id)} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-blue-50 hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300">Add</button>
                          <button type="button" onClick={() => setAddMemberFor(null)} className="rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300">Cancel</button>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
