import { useEffect, useState, type FormEvent } from 'react';
import { api, type ApiKey, type Application, type ServiceGrant, type User } from '../lib/api';
import { ConceptPanel, ConfirmAction, CopyButton, EmptyState, ErrorState, LoadingState, Notice, PageHeader } from '../components/ui';

type MembershipMap = Record<string, { app: Application; role: string }[]>;
type GrantMap = Record<string, ServiceGrant[]>;

type ApplicationRelationship = {
  users: number;
  keys: number;
  serviceAccounts: number;
  inboundGrants: number;
};

export default function Applications() {
  const [apps, setApps] = useState<Application[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [serviceAccounts, setServiceAccounts] = useState<User[]>([]);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [memberships, setMemberships] = useState<MembershipMap>({});
  const [serviceMemberships, setServiceMemberships] = useState<MembershipMap>({});
  const [serviceGrants, setServiceGrants] = useState<GrantMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [revealSecret, setRevealSecret] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const appList = await api.listApplications();
      setApps(appList);

      const [usersResult, keysResult, serviceAccountsResult] = await Promise.allSettled([
        api.listUsers(),
        api.listApiKeys(),
        api.listServiceAccounts(),
      ]);

      const userList = usersResult.status === 'fulfilled' ? usersResult.value : [];
      const keyList = keysResult.status === 'fulfilled' ? keysResult.value : [];
      const serviceList = serviceAccountsResult.status === 'fulfilled' ? serviceAccountsResult.value : [];

      setUsers(userList);
      setKeys(keyList);
      setServiceAccounts(serviceList);

      const userMembershipEntries = await Promise.all(userList.map(async (user) => [user.id, await api.listAllMemberships(user.id)] as const));
      const serviceMembershipEntries = await Promise.all(serviceList.map(async (account) => [account.id, await api.listAllMemberships(account.id)] as const));
      const serviceGrantEntries = await Promise.all(serviceList.map(async (account) => [account.id, await api.listServiceGrants(account.id)] as const));

      setMemberships(Object.fromEntries(userMembershipEntries));
      setServiceMemberships(Object.fromEntries(serviceMembershipEntries));
      setServiceGrants(Object.fromEntries(serviceGrantEntries));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Applications could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const relationshipFor = (app: Application): ApplicationRelationship => {
    const usersWithAccess = users.filter((user) => (memberships[user.id] ?? []).some((membership) => membership.app.id === app.id));
    const serviceOwners = serviceAccounts.filter((account) => (serviceMemberships[account.id] ?? []).some((membership) => membership.app.id === app.id));
    const inboundGrantCount = Object.values(serviceGrants).flat().filter((grant) => grant.targetAppId === app.id).length;

    return {
      users: usersWithAccess.length,
      keys: keys.filter((key) => key.appId === app.id).length,
      serviceAccounts: serviceOwners.length,
      inboundGrants: inboundGrantCount,
    };
  };

  const deleteConsequence = (app: Application, relationship: ApplicationRelationship) => {
    const affected = [
      `${relationship.users} user membership${relationship.users === 1 ? '' : 's'}`,
      `${relationship.keys} API key${relationship.keys === 1 ? '' : 's'}`,
      `${relationship.serviceAccounts} owning service account${relationship.serviceAccounts === 1 ? '' : 's'}`,
      `${relationship.inboundGrants} inbound service grant${relationship.inboundGrants === 1 ? '' : 's'}`,
    ];
    return `Delete ${app.name}? This cannot be undone. Warden will remove the application boundary and cascade through ${affected.join(', ')}. Confirm only after downstream services no longer depend on this app.`;
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.createApplication(name, slug);
      setName('');
      setSlug('');
      setShowCreate(false);
      setSuccess('Application created. Next, add memberships, issue keys, or create service grants for this boundary.');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Application could not be created.');
    } finally {
      setSaving(false);
    }
  };

  const handleRotate = async (app: Application) => {
    const result = await api.rotateSecret(app.id);
    setRevealSecret(result.id);
    setSuccess(`${app.name} has a new JWT secret. Existing tokens for this application may no longer verify.`);
    load();
  };

  const handleDelete = async (app: Application) => {
    await api.deleteApplication(app.id);
    setSuccess(`${app.name} was deleted. Its memberships, API keys, and connected service grants no longer apply.`);
    load();
  };

  if (loading) return <LoadingState>Loading application trust boundaries and connected access...</LoadingState>;

  const filteredApps = apps.filter((app) => {
    if (!search.trim()) return true;
    const query = search.toLowerCase();
    return [app.name, app.slug, app.id].some((value) => value.toLowerCase().includes(query));
  });

  return (
    <div>
      <PageHeader
        title="Applications"
        eyebrow="Trust boundaries"
        action={
          <button
            type="button"
            onClick={() => { setShowCreate(!showCreate); setSuccess(''); }}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-blue-50 hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300"
          >
            {showCreate ? 'Close form' : 'Create application'}
          </button>
        }
      >
        Each application owns a token boundary. The relationship summary shows who can use it, which keys point at it, and which machine grants depend on it.
      </PageHeader>

      <div className="space-y-4">
        {error && <ErrorState message={error} onRetry={load} />}
        {success && <Notice tone="success">{success}</Notice>}
        <ConceptPanel title="Before changing an application boundary" items={["Rotate secrets only after clients are ready", "Delete removes memberships and keys", "Check service grants before removal"]}>
          The relationship counts below are the blast radius. Use them before rotating or deleting an application so you know which users, keys, and machine paths will be affected.
        </ConceptPanel>

        <div className="grid gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search applications by name, slug, or ID"
            aria-label="Search applications by name, slug, or ID"
            className="min-h-10 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} className="min-h-10 rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300">
              Clear search
            </button>
          )}
        </div>

        <p className="text-xs text-slate-400">Showing {filteredApps.length} of {apps.length} application boundaries.</p>

        {showCreate && (
          <form onSubmit={handleCreate} className="rounded-xl border border-slate-800 bg-slate-900 p-4" noValidate>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="app-name" className="mb-1 block text-sm text-slate-400">Name</label>
                <input
                  id="app-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="app-slug" className="mb-1 block text-sm text-slate-400">Slug</label>
                <input
                  id="app-slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="my-app"
                  pattern="[a-z0-9-]+"
                  aria-describedby="app-slug-help"
                  className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <p id="app-slug-help" className="mt-1 text-xs text-slate-400">Use lowercase letters, numbers, and hyphens.</p>
              </div>
            </div>
            <button type="submit" disabled={saving} className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-blue-50 hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300 disabled:opacity-60">
              {saving ? 'Creating application...' : 'Create application'}
            </button>
          </form>
        )}

        {apps.length === 0 ? (
          <EmptyState title="No applications yet" action={<button type="button" onClick={() => setShowCreate(true)} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-blue-50 hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300">Create application</button>}>
            Create the first trust boundary before issuing keys or granting service access.
          </EmptyState>
        ) : filteredApps.length === 0 ? (
          <EmptyState title="No applications match this search">
            Search by application name, slug, or ID. Clear the search to return to all boundaries.
          </EmptyState>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
            {filteredApps.map((app) => {
              const relationship = relationshipFor(app);
              return (
                <article key={app.id} className="border-b border-slate-800 p-4 last:border-b-0">
                  <div className="grid gap-4 xl:grid-cols-[minmax(220px,0.7fr)_minmax(360px,1fr)_auto] xl:items-start">
                    <div className="min-w-0">
                      <h3 className="font-medium text-slate-50">{app.name}</h3>
                      <p className="mt-1 break-all text-sm text-slate-400">slug: {app.slug}</p>
                      <p className="break-all text-sm text-slate-400">id: {app.id}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <CopyButton value={app.id} label="Copy ID" />
                        <CopyButton value={app.slug} label="Copy slug" />
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-2" aria-label={`Connected access for ${app.name}`}>
                      <RelationshipStat label="User memberships" value={relationship.users} help="People with a role" />
                      <RelationshipStat label="API keys" value={relationship.keys} help="Scoped credentials" />
                      <RelationshipStat label="Service accounts" value={relationship.serviceAccounts} help="Machine owners" />
                      <RelationshipStat label="Inbound grants" value={relationship.inboundGrants} help="Machine targets" />
                    </div>

                    <div className="flex flex-wrap gap-2 xl:justify-end">
                      {app.slug === 'warden' ? (
                        <span className="rounded-md border border-blue-500/40 bg-blue-500/10 px-3 py-2 text-sm font-medium text-blue-100">
                          Protected control plane
                        </span>
                      ) : (
                        <>
                          <ConfirmAction
                            label="Rotate secret"
                            confirmLabel="Rotate JWT secret"
                            tone="warning"
                            consequence={`Rotate the JWT secret for ${app.name}? Existing tokens signed with the current secret may stop working immediately. Confirm only if token verifiers and clients are ready to use the new secret.`}
                            onConfirm={() => handleRotate(app)}
                          />
                          <ConfirmAction
                            label="Delete"
                            confirmLabel="Delete application"
                            consequence={deleteConsequence(app, relationship)}
                            onConfirm={() => handleDelete(app)}
                          />
                        </>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 border-t border-slate-800 pt-3">
                    <button
                      type="button"
                      onClick={() => setRevealSecret(revealSecret === app.id ? null : app.id)}
                      className="rounded px-2 py-1 text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300"
                      aria-expanded={revealSecret === app.id}
                    >
                      {revealSecret === app.id ? 'Hide JWT secret' : 'Reveal JWT secret'}
                    </button>
                    {revealSecret === app.id && (
                      <p className="mt-2 break-all rounded-md bg-slate-800 p-3 font-mono text-xs text-amber-200">
                        {app.jwtSecret}
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function RelationshipStat({ label, value, help }: { label: string; value: number; help: string }) {
  return (
    <section className="min-w-0 rounded-lg bg-slate-950 px-3 py-2" aria-label={`${label}: ${value}`}>
      <p className="truncate text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-100">{value}</p>
      <p className="mt-1 truncate text-xs text-slate-400">{help}</p>
    </section>
  );
}
