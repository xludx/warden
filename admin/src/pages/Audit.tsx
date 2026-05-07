import { useEffect, useState } from 'react';
import { api, type AuditEvent, type Application } from '../lib/api';
import { ConceptPanel, EmptyState, ErrorState, LoadingState, PageHeader } from '../components/ui';

const ACTION_LABELS: Record<string, string> = {
  'user.registered': 'User registered',
  'user.login': 'User logged in',
  'user.login_failed': 'Login failed',
  'user.deleted': 'User deleted',
  'application.created': 'Application created',
  'application.deleted': 'Application deleted',
  'application.secret_rotated': 'Secret rotated',
  'membership.added': 'Membership added',
  'membership.removed': 'Membership removed',
  'api_key.created': 'API key created',
  'api_key.revoked': 'API key revoked',
  'api_key.verified': 'API key verified',
  'service_account.created': 'Service account created',
  'service_account.deleted': 'Service account deleted',
  'service_grant.added': 'Grant added',
  'service_grant.removed': 'Grant removed',
  'token.client_credentials': 'Client credentials token',
  'oauth.started': 'OAuth flow started',
  'oauth.callback': 'OAuth callback',
  'passkey.registered': 'Passkey registered',
  'passkey.authenticated': 'Passkey auth',
};

const PAGE_SIZE = 50;

export default function Audit() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [filterAction, setFilterAction] = useState('');
  const [filterAppId, setFilterAppId] = useState('');
  const [filterTargetType, setFilterTargetType] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.listAudit({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        action: filterAction || undefined,
        appId: filterAppId || undefined,
        targetType: filterTargetType || undefined,
      });
      setEvents(result.events);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Audit events could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { api.listApplications().then(setApps); }, []);
  useEffect(() => { load(); }, [page, filterAction, filterAppId, filterTargetType]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasFilters = filterAction || filterAppId || filterTargetType;

  return (
    <div>
      <PageHeader title="Audit Log" eyebrow="Access history">
        Review access changes, credential events, and authentication activity. Use the filters to answer who changed access, which application was affected, and what kind of credential or grant moved.
      </PageHeader>

      <div className="space-y-4">
        <ConceptPanel title="How to read audit events" items={["Actor is who did it", "Target is what changed", "Details show IDs and metadata"]}>
          Start with the action label, then read across the row: time, category, actor, target, and source IP. Expand an event when you need exact IDs or metadata for an investigation.
        </ConceptPanel>

        <div className="grid gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 lg:grid-cols-[220px_220px_220px_auto]">
          <select value={filterAction} onChange={(e) => { setFilterAction(e.target.value); setPage(0); }} className="min-h-10 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" aria-label="Filter by action">
            <option value="">All actions</option>
            {Object.entries(ACTION_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          <select value={filterAppId} onChange={(e) => { setFilterAppId(e.target.value); setPage(0); }} className="min-h-10 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" aria-label="Filter by application">
            <option value="">All applications</option>
            {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select value={filterTargetType} onChange={(e) => { setFilterTargetType(e.target.value); setPage(0); }} className="min-h-10 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" aria-label="Filter by target type">
            <option value="">All target types</option>
            <option value="user">User</option>
            <option value="application">Application</option>
            <option value="membership">Membership</option>
            <option value="api_key">API Key</option>
            <option value="service_grant">Service Grant</option>
          </select>
          {hasFilters && <button type="button" onClick={() => { setFilterAction(''); setFilterAppId(''); setFilterTargetType(''); setPage(0); }} className="min-h-10 rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300">Clear filters</button>}
        </div>

        <p className="text-xs text-slate-400">{total} events</p>
        {error && <ErrorState message={error} onRetry={load} />}
        {loading ? (
          <LoadingState>Loading audit events...</LoadingState>
        ) : events.length === 0 ? (
          <EmptyState title="No audit events found">
            {hasFilters ? 'Adjust filters to widen the event history.' : 'Access changes, credential events, and authentication activity will appear here.'}
          </EmptyState>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
            {events.map((event) => {
              const isExpanded = expanded === event.id;
              return (
                <article key={event.id} className="border-b border-slate-800 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setExpanded(isExpanded ? null : event.id)}
                    aria-expanded={isExpanded}
                    aria-controls={`audit-${event.id}-details`}
                    className="grid w-full gap-3 px-4 py-4 text-left hover:bg-slate-800/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-blue-300 lg:grid-cols-[180px_150px_minmax(0,1fr)_150px_100px]"
                  >
                    <time className="text-sm text-slate-400" dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time>
                    <span className="flex items-center gap-2">
                      <CategoryBadge action={event.action} />
                      <RiskBadge action={event.action} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-100">{ACTION_LABELS[event.action] ?? event.action}</span>
                      <span className="mt-1 block truncate text-sm text-slate-400">{summary(event)}</span>
                    </span>
                    <span className="truncate text-sm text-slate-400">{event.actorName ?? event.actorType ?? 'System'}</span>
                    <span className="text-xs text-slate-400">{event.ipAddress ?? 'No IP'}</span>
                  </button>

                  {isExpanded && (
                    <div id={`audit-${event.id}-details`} className="grid gap-3 border-t border-slate-800 bg-slate-950 px-4 py-4 text-sm md:grid-cols-2 lg:grid-cols-4">
                      <Detail label="Actor" value={event.actorName ?? event.actorId ?? 'System'} />
                      <Detail label="Target" value={event.targetName ?? event.targetId ?? event.targetType ?? 'No target'} />
                      <Detail label="Application ID" value={event.appId ?? 'No application'} />
                      <Detail label="Event ID" value={event.id} mono />
                      {event.metadata && (
                        <div className="md:col-span-2 lg:col-span-4">
                          <p className="text-xs uppercase tracking-[0.08em] text-slate-400">Metadata</p>
                          <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-300">{JSON.stringify(event.metadata, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <nav className="flex items-center gap-3" aria-label="Audit pagination">
            <button type="button" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="rounded-md bg-slate-800 px-3 py-2 text-sm text-slate-50 hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300 disabled:opacity-30">Previous page</button>
            <span className="text-sm text-slate-400">Page {page + 1} of {totalPages}</span>
            <button type="button" onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="rounded-md bg-slate-800 px-3 py-2 text-sm text-slate-50 hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300 disabled:opacity-30">Next page</button>
          </nav>
        )}
      </div>
    </div>
  );
}

function summary(event: AuditEvent) {
  const actor = event.actorName ?? event.actorType ?? 'System';
  const target = event.targetName ?? event.targetType ?? 'the target';
  return `${actor} changed ${target}`;
}

function category(action: string) {
  if (action.includes('api_key') || action.includes('token') || action.includes('secret')) return 'Credential';
  if (action.includes('grant') || action.includes('membership')) return 'Access';
  if (action.includes('login') || action.includes('oauth') || action.includes('passkey')) return 'Auth';
  if (action.includes('application')) return 'Application';
  if (action.includes('service_account')) return 'Service';
  return 'User';
}

function risk(action: string) {
  if (action.includes('deleted') || action.includes('revoked') || action.includes('removed') || action.includes('secret_rotated') || action.includes('login_failed')) return 'Review';
  if (action.includes('created') || action.includes('added') || action.includes('registered')) return 'Change';
  return 'Info';
}

function CategoryBadge({ action }: { action: string }) {
  return <span className="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-300">{category(action)}</span>;
}

function RiskBadge({ action }: { action: string }) {
  const label = risk(action);
  const className = label === 'Review'
    ? 'border-amber-800 bg-amber-950/50 text-amber-100'
    : label === 'Change'
      ? 'border-blue-900 bg-blue-950/50 text-blue-100'
      : 'border-slate-700 bg-slate-900 text-slate-300';
  return <span className={`rounded-md border px-2 py-1 text-xs ${className}`}>{label}</span>;
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-xs uppercase tracking-[0.08em] text-slate-400">{label}</p>
      <p className={`mt-1 break-all text-slate-200 ${mono ? 'font-mono text-xs' : 'text-sm'}`}>{value}</p>
    </div>
  );
}
