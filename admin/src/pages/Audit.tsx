import { useEffect, useState } from 'react';
import { api, type AuditEvent, type Application } from '../lib/api';

const ACTION_LABELS: Record<string, string> = {
  'user.registered': '👤 User registered',
  'user.login': '🔑 User logged in',
  'user.login_failed': '🚫 Login failed',
  'user.deleted': '🗑️ User deleted',
  'application.created': '📦 Application created',
  'application.deleted': '🗑️ Application deleted',
  'application.secret_rotated': '🔄 Secret rotated',
  'membership.added': '➕ Membership added',
  'membership.removed': '➖ Membership removed',
  'api_key.created': '🗝️ API key created',
  'api_key.revoked': '🚫 API key revoked',
  'api_key.verified': '✅ API key verified',
  'service_account.created': '🤖 Service account created',
  'service_account.deleted': '🗑️ Service account deleted',
  'service_grant.added': '🔗 Grant added',
  'service_grant.removed': '✂️ Grant removed',
  'token.client_credentials': '🎫 Client credentials token',
  'oauth.started': '🔗 OAuth flow started',
  'oauth.callback': '✅ OAuth callback',
  'passkey.registered': '🔐 Passkey registered',
  'passkey.authenticated': '🔓 Passkey auth',
};

const PAGE_SIZE = 50;

export default function Audit() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  // Filters
  const [filterAction, setFilterAction] = useState('');
  const [filterAppId, setFilterAppId] = useState('');
  const [filterTargetType, setFilterTargetType] = useState('');

  const load = async () => {
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api.listApplications().then(setApps);
  }, []);

  useEffect(() => { load(); }, [page, filterAction, filterAppId, filterTargetType]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const clearFilters = () => {
    setFilterAction('');
    setFilterAppId('');
    setFilterTargetType('');
    setPage(0);
  };

  const hasFilters = filterAction || filterAppId || filterTargetType;

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Audit Log</h2>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <select
          value={filterAction}
          onChange={(e) => { setFilterAction(e.target.value); setPage(0); }}
          className="px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-white"
        >
          <option value="">All actions</option>
          {Object.entries(ACTION_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <select
          value={filterAppId}
          onChange={(e) => { setFilterAppId(e.target.value); setPage(0); }}
          className="px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-white"
        >
          <option value="">All applications</option>
          {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select
          value={filterTargetType}
          onChange={(e) => { setFilterTargetType(e.target.value); setPage(0); }}
          className="px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-white"
        >
          <option value="">All target types</option>
          <option value="user">User</option>
          <option value="application">Application</option>
          <option value="membership">Membership</option>
          <option value="api_key">API Key</option>
          <option value="service_grant">Service Grant</option>
        </select>
        {hasFilters && (
          <button onClick={clearFilters} className="text-xs text-gray-400 hover:text-white">Clear</button>
        )}
      </div>

      <p className="text-xs text-gray-500 mb-3">{total} events</p>

      {/* Events */}
      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <div className="space-y-1">
          {events.map((event) => (
            <div key={event.id} className="flex items-start gap-3 py-2.5 px-3 bg-gray-900/50 border-b border-gray-800/50 rounded">
              <div className="text-sm shrink-0 w-48">
                <span className="text-gray-500">{new Date(event.createdAt).toLocaleString()}</span>
              </div>
              <div className="text-sm w-48 shrink-0">
                <span className="text-white">{ACTION_LABELS[event.action] ?? event.action}</span>
              </div>
              <div className="text-sm flex-1 min-w-0">
                {event.actorName && (
                  <span className="text-gray-400">by <span className="text-gray-300">{event.actorName}</span></span>
                )}
                {event.targetName && (
                  <span className="text-gray-500"> → <span className="text-gray-300">{event.targetName}</span></span>
                )}
                {event.targetType && !event.targetName && (
                  <span className="text-gray-500"> → <span className="text-gray-400">{event.targetType}</span></span>
                )}
              </div>
              <div className="text-xs text-gray-600 shrink-0">
                {event.ipAddress && <span>{event.ipAddress}</span>}
              </div>
            </div>
          ))}
          {events.length === 0 && <p className="text-gray-500 text-sm mt-4">No events found.</p>}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 text-sm bg-gray-800 rounded text-white disabled:opacity-30 hover:bg-gray-700"
          >
            ← Previous
          </button>
          <span className="text-sm text-gray-500">Page {page + 1} of {totalPages}</span>
          <button
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1.5 text-sm bg-gray-800 rounded text-white disabled:opacity-30 hover:bg-gray-700"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
