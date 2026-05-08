import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { api, setToken, getToken } from '../lib/api';

type AuthorizeInfo = {
  clientId: string;
  appName: string;
  redirectUri: string;
};

export default function Authorize() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [info, setInfo] = useState<AuthorizeInfo | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const clientId = searchParams.get('client_id') ?? '';
  const redirectUri = searchParams.get('redirect_uri') ?? '';
  const state = searchParams.get('state') ?? '';

  useEffect(() => {
    if (!clientId || !redirectUri || !state) {
      setError('Missing required parameters: client_id, redirect_uri, and state');
      setLoading(false);
      return;
    }

    fetch(`/api/auth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setInfo(data.data);
        } else {
          setError(data.error ?? 'Authorization request could not be validated');
        }
      })
      .catch(() => setError('Could not reach Warden'))
      .finally(() => setLoading(false));
  }, [clientId, redirectUri, state]);

  const handleConfirm = async () => {
    const token = getToken();
    if (!token) {
      // Redirect to login, then come back here
      navigate(`/login?redirect=/authorize?${searchParams.toString()}`);
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/auth/authorize/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ client_id: clientId, redirect_uri: redirectUri, state }),
      });
      const data = await res.json();
      if (data.success) {
        window.location.href = data.data.redirectUrl;
      } else {
        setError(data.error ?? 'Authorization could not be completed');
      }
    } catch {
      setError('Authorization request failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoginAndConfirm = async (loginToken: string) => {
    setToken(loginToken);
    navigate(`/authorize?${searchParams.toString()}`, { replace: true });
    // Component re-renders, handleConfirm will be available
    window.location.reload();
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
        <p className="text-slate-400">Validating authorization request...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
        <div className="w-full max-w-md rounded-xl border border-red-800 bg-red-950/40 p-6 text-center">
          <p className="text-lg text-red-200">{error}</p>
          <p className="mt-2 text-sm text-slate-400">Return to the application and try again.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <img src="/warden-cat-no-bg.png" alt="Warden logo" className="mx-auto h-16 w-16 rounded-sm object-cover" />
          <h1 className="mt-3 text-xl font-semibold text-slate-50">Authorize access</h1>
          <p className="mt-1 text-sm text-slate-400">
            <strong className="text-slate-200">{info?.appName}</strong> wants to verify your identity
          </p>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-900 p-6">
          {!getToken() ? (
            <div className="text-center">
              <p className="mb-4 text-sm text-slate-300">Sign in to continue to {info?.appName}</p>
              <a
                href={`/login?redirect=/authorize?${searchParams.toString()}`}
                className="inline-block w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-blue-50 hover:bg-blue-500 text-center"
              >
                Sign in
              </a>
            </div>
          ) : (
            <div className="text-center">
              <p className="mb-1 text-sm text-slate-300">Signed in as</p>
              <p className="text-sm font-medium text-slate-50">You</p>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={submitting}
                className="mt-6 w-full rounded-md bg-green-600 px-4 py-2.5 text-sm font-medium text-green-50 hover:bg-green-500 disabled:opacity-60"
              >
                {submitting ? 'Authorizing...' : `Continue as you → ${info?.appName}`}
              </button>
              <div className="mt-4">
                <Link to="/logout" className="text-xs text-slate-400 hover:text-slate-200 underline">Use a different account</Link>
              </div>
            </div>
          )}
        </div>

        {info && (
          <p className="mt-4 text-center text-xs text-slate-500">
            Redirecting to <span className="text-slate-400">{info.redirectUri}</span>
          </p>
        )}
      </div>
    </main>
  );
}
