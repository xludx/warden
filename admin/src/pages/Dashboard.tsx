import { useEffect, useState } from 'react';
import { api, type User, type Application } from '../lib/api';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../components/ui';

export default function Dashboard() {
  const [users, setUsers] = useState<User[]>([]);
  const [serviceAccounts, setServiceAccounts] = useState<User[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    Promise.all([api.listUsers(), api.listServiceAccounts(), api.listApplications()])
      .then(([u, s, a]) => {
        setUsers(u);
        setServiceAccounts(s);
        setApps(a);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Dashboard data could not be loaded.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading) return <LoadingState>Loading the control plane summary...</LoadingState>;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const protectedApps = apps.filter((app) => app.slug === 'warden').length;
  const appCopy = apps.length === 1 ? 'application boundary' : 'application boundaries';

  return (
    <div>
      <PageHeader title="Dashboard" eyebrow="Admin overview">
        Review Warden as a map of relationships before changing access. Applications set the boundary, users and service accounts attach to it, and credentials inherit that scope.
      </PageHeader>

      {apps.length === 0 && users.length === 0 && serviceAccounts.length === 0 ? (
        <EmptyState title="No control plane records yet">
          Create an application first. It becomes the trust boundary that users, API keys, service accounts, and audit events connect to.
        </EmptyState>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <section className="rounded-xl border border-slate-800 bg-slate-900 p-5" aria-labelledby="footprint-heading">
            <div className="flex flex-col gap-2 border-b border-slate-800 pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 id="footprint-heading" className="text-lg font-semibold text-slate-50">Control-plane footprint</h3>
                <p className="mt-1 text-sm leading-6 text-slate-400">{apps.length} {appCopy} currently organize human and machine access.</p>
              </div>
              {protectedApps > 0 && <span className="rounded-md border border-blue-500/40 bg-blue-500/10 px-3 py-2 text-sm font-medium text-blue-100">Warden app protected</span>}
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <Summary label="Applications" value={apps.length} detail="Token boundaries" />
              <Summary label="Human users" value={users.length} detail="People with roles" />
              <Summary label="Service accounts" value={serviceAccounts.length} detail="Machine identities" />
            </div>
          </section>

          <aside className="rounded-xl border border-slate-800 bg-slate-900 p-5" aria-labelledby="checks-heading">
            <h3 id="checks-heading" className="text-lg font-semibold text-slate-50">Operational checks</h3>
            <p className="mt-1 text-sm leading-6 text-slate-400">Use these routes when you need to validate blast radius before a change.</p>
            <ol className="mt-5 space-y-4 text-sm">
              <CheckItem title="Before deleting an app" body="Open Applications and review memberships, keys, service accounts, and inbound grants." />
              <CheckItem title="Before revoking a key" body="Open API Keys and confirm the owner, application boundary, and last-used time." />
              <CheckItem title="Before changing machine access" body="Open Service Accounts and compare source applications with target grants." />
            </ol>
          </aside>
        </div>
      )}
    </div>
  );
}

function Summary({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-slate-950 px-4 py-3">
      <p className="text-sm text-slate-300">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-50">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-400">{detail}</p>
    </div>
  );
}

function CheckItem({ title, body }: { title: string; body: string }) {
  return (
    <li className="grid gap-1 border-t border-slate-800 pt-4 first:border-t-0 first:pt-0">
      <p className="font-medium text-slate-100">{title}</p>
      <p className="leading-6 text-slate-400">{body}</p>
    </li>
  );
}
