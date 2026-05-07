import { Link } from 'react-router-dom';
import { getToken } from '../lib/api';

const capabilities = [
  ['Applications', 'Each product surface gets its own token boundary and signing secret.'],
  ['Memberships', 'People stay global while roles stay local to one application.'],
  ['API keys', 'Long-lived credentials point to one owner and one boundary.'],
  ['Service grants', 'Machine identities request named scopes across target apps.'],
  ['Audit history', 'Every access change leaves a trail for review.'],
];

const controlPaths = [
  ['Human user', 'membership', 'Application'],
  ['Service account', 'grant + scope', 'Target app'],
  ['API key', 'owner + prefix', 'Application'],
];

export default function Landing() {
  const adminPath = getToken() ? '/admin' : '/login';

  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="absolute inset-0 -z-0 bg-[radial-gradient(circle_at_12%_8%,rgba(186,230,253,0.16),transparent_24%),radial-gradient(circle_at_84%_12%,rgba(59,130,246,0.14),transparent_28%),linear-gradient(135deg,rgba(59,130,246,0.08),transparent_42%)]" />
      <div className="absolute inset-x-0 top-0 -z-0 h-56 bg-[linear-gradient(rgba(96,165,250,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(96,165,250,0.07)_1px,transparent_1px)] bg-[size:36px_36px] opacity-60" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-6 sm:px-8 lg:px-10">
        <nav className="flex items-center justify-between border-b border-slate-700/30 pb-5" aria-label="Public navigation">
          <Link to="/" className="flex items-center gap-3 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-300">
            <img src="/warden-cat-no-bg.png" alt="Warden logo" className="h-9 w-9 rounded-sm object-cover" />
            <span>
              <span className="block text-sm font-semibold tracking-wide text-slate-50">Warden</span>
              <span className="block text-xs text-slate-400">Identity control plane</span>
            </span>
          </Link>
          <Link to={adminPath} className="rounded-sm bg-blue-600 px-4 py-2 text-sm font-semibold text-blue-50 hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300">
            Open admin
          </Link>
        </nav>

        <section className="grid flex-1 items-center gap-14 py-14 lg:grid-cols-[minmax(0,0.92fr)_minmax(460px,1.08fr)] lg:py-20">
          <div className="max-w-4xl">
            <p className="mb-6 inline-flex rounded-full border border-blue-300/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-blue-100">
              Auth infrastructure, centralized
            </p>
            <h1 className="text-[clamp(4rem,10vw,9.5rem)] font-black leading-[0.78] tracking-[-0.075em] text-slate-50">
              Identity has a control plane now.
            </h1>
            <p className="mt-8 max-w-2xl text-xl leading-9 text-slate-300">
              Warden gives every backend one clear model for users, API keys, service accounts, grants, and audit history. No scattered auth code. No mystery credentials.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link to={adminPath} className="inline-flex min-h-12 items-center justify-center rounded-sm bg-blue-600 px-6 py-3 text-sm font-bold text-blue-50 hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300">
                Open admin
              </Link>
              <a href="#model" className="inline-flex min-h-12 items-center justify-center rounded-sm border border-slate-600 px-6 py-3 text-sm font-semibold text-slate-100 hover:bg-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300">
                Trace the model
              </a>
            </div>
          </div>

          <div className="relative" aria-label="Warden trust boundary model">
            <div className="absolute -left-6 top-10 hidden h-40 w-40 rounded-full border border-blue-300/20 lg:block" aria-hidden="true" />
            <div className="relative rounded-sm border border-slate-700/50 bg-slate-900/95 p-4 shadow-[0_30px_100px_rgba(0,0,0,0.35)] lg:p-5">
              <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
                <div className="rounded-sm border border-slate-700/50 bg-slate-800/50 p-5">
                  <p className="text-xs uppercase tracking-[0.16em] text-blue-100/70">Control plane</p>
                  <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-50">Warden</h2>
                  <p className="mt-4 text-sm leading-6 text-slate-300">The place where access boundaries become visible before they become incidents.</p>
                  <span className="mt-6 inline-flex rounded-full border border-blue-300/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-100">Audited by default</span>
                </div>

                <div id="model" className="grid gap-2">
                  {capabilities.map(([title, body], index) => (
                    <div key={title} className="grid gap-3 rounded-sm border border-slate-700/80 bg-slate-950 px-4 py-3 sm:grid-cols-[112px_minmax(0,1fr)]">
                      <div className="flex items-center gap-3">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-sm bg-blue-500 text-xs font-bold text-white">{index + 1}</span>
                        <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
                      </div>
                      <p className="text-sm leading-6 text-slate-400">{body}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                {controlPaths.map(([from, via, to]) => (
                  <div key={`${from}-${to}`} className="rounded-sm border border-slate-700/50 bg-slate-800/50 p-4">
                    <p className="text-sm font-semibold text-slate-100">{from}</p>
                    <p className="my-2 text-xs uppercase tracking-[0.14em] text-blue-100/70">{via}</p>
                    <p className="text-sm text-slate-400">{to}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
