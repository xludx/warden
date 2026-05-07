import { useEffect, useState, type FormEvent } from 'react';
import { api, type User, type Application, type ServiceGrant } from '../lib/api';
import { ConceptPanel, ConfirmAction, CopyButton, EmptyState, ErrorState, LoadingState, Notice, PageHeader } from '../components/ui';

type MembershipMap = Record<string, { app: Application; role: string }[]>;

export default function ServiceAccounts() {
  const [accounts, setAccounts] = useState<User[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [ownership, setOwnership] = useState<MembershipMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [appId, setAppId] = useState('');
  const [created, setCreated] = useState<{ clientId: string; clientSecret: string } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [grants, setGrants] = useState<Record<string, ServiceGrant[]>>({});
  const [addGrantFor, setAddGrantFor] = useState<string | null>(null);
  const [grantAppId, setGrantAppId] = useState('');
  const [grantScopes, setGrantScopes] = useState('');
  const [search, setSearch] = useState('');
  const [filterSourceAppId, setFilterSourceAppId] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [a, ap] = await Promise.all([api.listServiceAccounts(), api.listApplications()]);
      setAccounts(a);
      setApps(ap);
      const ownershipEntries = await Promise.all(a.map(async (account) => [account.id, await api.listAllMemberships(account.id)] as const));
      setOwnership(Object.fromEntries(ownershipEntries));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Service accounts could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const result = await api.createServiceAccount(name, appId);
      const owningApp = apps.find((app) => app.id === appId);
      setCreated({ clientId: result.clientId, clientSecret: result.clientSecret });
      setSuccess(`Service account created${owningApp ? ` for ${owningApp.name}` : ''}. Save the client secret now, then add grants only for the target applications this machine should reach.`);
      setName('');
      setAppId('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Service account could not be created.');
    }
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
    const targetApp = apps.find((app) => app.id === grantAppId);
    setSuccess(`Service grant added${targetApp ? ` for ${targetApp.name}` : ''}. The account can request only the listed scopes for that target application.`);
  };

  const handleRemoveGrant = async (serviceUserId: string, grantId: string) => {
    await api.removeServiceGrant(serviceUserId, grantId);
    const g = await api.listServiceGrants(serviceUserId);
    setGrants((prev) => ({ ...prev, [serviceUserId]: g }));
    setSuccess('Service grant removed. Future client-credentials requests for that target application and scope set will be denied.');
  };

  const handleDelete = async (account: User) => {
    await api.deleteServiceAccount(account.id);
    setSuccess(`${account.name} was deleted. Machine clients using that identity can no longer authenticate.`);
    load();
  };

  if (loading) return <LoadingState>Loading service accounts and grants...</LoadingState>;

  const filteredAccounts = accounts.filter((account) => {
    const owningApps = ownership[account.id] ?? [];
    if (search.trim()) {
      const query = search.toLowerCase();
      const values = [account.name, account.id, ...owningApps.flatMap((membership) => [membership.app.name, membership.app.slug])];
      if (!values.some((value) => value.toLowerCase().includes(query))) return false;
    }
    if (filterSourceAppId && !owningApps.some((membership) => membership.app.id === filterSourceAppId)) return false;
    return true;
  });

  return (
    <div>
      <PageHeader title="Service Accounts" eyebrow="Machine access" action={<button type="button" onClick={() => { setShowCreate(!showCreate); setCreated(null); }} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-blue-50 hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300">{showCreate ? 'Close form' : 'Create service account'}</button>}>
        Service accounts belong to one source application. Grants name the target applications and scopes that machine identity can request.
      </PageHeader>

      <div className="space-y-4">
        {error && <ErrorState message={error} onRetry={load} />}
        {success && <Notice tone="success">{success}</Notice>}
        <ConceptPanel title="Before changing machine access" items={["Source app owns the identity", "Target app receives scoped requests", "Removing a grant denies future tokens"]}>
          Service account changes affect backends, workers, and scheduled jobs. Confirm the source application, target application, and scopes before adding or removing a grant.
        </ConceptPanel>
        {created && (
          <Notice tone="warning" title="Save these credentials now">
            <p>The client secret will not be shown again.</p>
            <p className="mt-2 break-all font-mono text-xs">Client ID: {created.clientId}</p>
            <p className="break-all font-mono text-xs">Client Secret: {created.clientSecret}</p>
          </Notice>
        )}

        <div className="grid gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 md:grid-cols-[minmax(0,1fr)_240px_auto]">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search service accounts by name, source app, or ID"
            aria-label="Search service accounts by name, source application, or ID"
            className="min-h-10 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select value={filterSourceAppId} onChange={(event) => setFilterSourceAppId(event.target.value)} className="min-h-10 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" aria-label="Filter service accounts by source application">
            <option value="">All source applications</option>
            {apps.map((app) => <option key={app.id} value={app.id}>{app.name}</option>)}
          </select>
          {(search || filterSourceAppId) && (
            <button type="button" onClick={() => { setSearch(''); setFilterSourceAppId(''); }} className="min-h-10 rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300">
              Clear filters
            </button>
          )}
        </div>

        <p className="text-xs text-slate-400">Showing {filteredAccounts.length} of {accounts.length} service accounts.</p>

        {showCreate && (
          <form onSubmit={handleCreate} className="rounded-xl border border-slate-800 bg-slate-900 p-4" noValidate>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="service-name" className="mb-1 block text-sm text-slate-400">Name</label>
                <input id="service-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Billing worker" className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label htmlFor="service-app" className="mb-1 block text-sm text-slate-400">Owning application</label>
                <select id="service-app" value={appId} onChange={(e) => setAppId(e.target.value)} className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                  <option value="">Select application</option>
                  {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            </div>
            <button type="submit" className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-blue-50 hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300">Create service account</button>
          </form>
        )}

        {accounts.length === 0 ? (
          <EmptyState title="No service accounts yet" action={<button type="button" onClick={() => setShowCreate(true)} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-blue-50 hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300">Create service account</button>}>
            Create one when a backend, scheduled job, or worker needs machine-to-machine access.
          </EmptyState>
        ) : filteredAccounts.length === 0 ? (
          <EmptyState title="No service accounts match these filters">
            Search by service account, source application, or ID. Clear filters to return to all machine identities.
          </EmptyState>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
            {filteredAccounts.map((account) => {
              const isExpanded = expanded === account.id;
              const owningApps = ownership[account.id] ?? [];
              const grantCount = grants[account.id]?.length;
              return (
                <article key={account.id} className="border-b border-slate-800 last:border-b-0">
                  <button type="button" className="grid w-full gap-4 p-4 text-left hover:bg-slate-800/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-blue-300 md:grid-cols-[minmax(0,1fr)_auto] md:items-start" onClick={() => toggleExpand(account.id)} aria-expanded={isExpanded} aria-controls={`service-${account.id}-grants`}>
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-slate-50">{account.name}</span>
                      <span className="block break-all text-sm text-slate-400">id: {account.id}</span>
                      <span className="mt-2 flex flex-wrap gap-2">
                        {owningApps.length > 0 ? owningApps.map((membership) => (
                          <span key={membership.app.id} className="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-300">Source: {membership.app.name}</span>
                        )) : <span className="rounded-md bg-amber-950/40 px-2 py-1 text-xs text-amber-200">No source application recorded</span>}
                        {grantCount !== undefined && <span className="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-300">{grantCount} target grant{grantCount === 1 ? '' : 's'}</span>}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-slate-400">{new Date(account.createdAt).toLocaleDateString()}</span>
                  </button>

                  {isExpanded && (
                    <div id={`service-${account.id}-grants`} className="border-t border-slate-800 p-4">
                      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-slate-400">Source: {owningApps.map((membership) => membership.app.name).join(', ') || 'No source app recorded'}. Grants below are the target applications this machine can request.</p>
                        <div className="flex gap-2">
                          <CopyButton value={account.id} label="Copy ID" />
                          <button type="button" onClick={() => { setAddGrantFor(account.id); setGrantAppId(''); }} className="rounded px-2 py-1 text-xs font-medium text-blue-300 hover:bg-blue-950/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300">Add grant</button>
                          <ConfirmAction label="Delete" confirmLabel="Delete service account" consequence={`Delete ${account.name}? This cannot be undone. Machine clients using this identity will no longer authenticate, and ${grants[account.id]?.length ?? 0} target grant${(grants[account.id]?.length ?? 0) === 1 ? '' : 's'} will be removed.`} onConfirm={() => handleDelete(account)} />
                        </div>
                      </div>

                      <div className="space-y-2">
                        {(grants[account.id] ?? []).map((g) => {
                          const targetApp = apps.find((a) => a.id === g.targetAppId);
                          return (
                            <div key={g.id} className="flex flex-col gap-3 rounded-lg bg-slate-800 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                              <span className="text-sm text-slate-50">Target: {targetApp?.name ?? g.targetAppId}</span>
                              <div className="flex flex-wrap items-center gap-2">
                                {g.scopes.map((s) => <span key={s} className="rounded-md bg-slate-700 px-2 py-1 text-xs text-slate-200">{s}</span>)}
                                <ConfirmAction label="Remove" confirmLabel="Remove grant" consequence={`Remove this grant from ${account.name}? New client-credentials requests for ${targetApp?.name ?? 'this target application'} with these scopes will be denied immediately.`} onConfirm={() => handleRemoveGrant(account.id, g.id)} />
                              </div>
                            </div>
                          );
                        })}
                        {(grants[account.id] ?? []).length === 0 && <p className="text-sm text-slate-400">No grants. Add one to authorize access to a target application.</p>}
                      </div>

                      {addGrantFor === account.id && (
                        <div className="mt-3 grid gap-2 rounded-lg bg-slate-800 p-3 md:grid-cols-[220px_minmax(0,1fr)_auto_auto]">
                          <select value={grantAppId} onChange={(e) => setGrantAppId(e.target.value)} className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" aria-label="Target application">
                            <option value="">Target application</option>
                            {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                          </select>
                          <input value={grantScopes} onChange={(e) => setGrantScopes(e.target.value)} placeholder="read:profiles, write:jobs" className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500" aria-label="Scopes separated by commas" />
                          <button type="button" onClick={() => handleAddGrant(account.id)} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-blue-50 hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300">Add</button>
                          <button type="button" onClick={() => setAddGrantFor(null)} className="rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300">Cancel</button>
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
