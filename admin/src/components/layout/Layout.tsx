import { NavLink, useNavigate } from 'react-router-dom';
import { clearToken } from '../../lib/api';

const nav = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/applications', label: 'Applications' },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/service-accounts', label: 'Service Accounts' },
  { to: '/admin/api-keys', label: 'API Keys' },
  { to: '/admin/audit', label: 'Audit Log' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  const logout = () => {
    clearToken();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 lg:flex">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-blue-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white">
        Skip to main content
      </a>
      <aside className="border-b border-slate-800 bg-slate-900 lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col lg:border-b-0 lg:border-r" aria-label="Admin navigation">
        <div className="flex items-center justify-between gap-4 border-b border-slate-800 p-4 lg:block">
          <div className="flex items-center gap-3">
            <img src="/warden-cat-no-bg.png" alt="Warden logo" className="h-8 w-8 rounded-sm object-cover" />
            <div>
              <h1 className="text-lg font-semibold text-slate-50">Warden</h1>
              <p className="text-xs text-slate-400">Admin control plane</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="rounded-md px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300 lg:hidden"
          >
            Sign out
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto p-2 lg:flex-1 lg:flex-col" aria-label="Admin sections">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300 ${
                  isActive
                    ? 'bg-slate-800 text-slate-50'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-50'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden border-t border-slate-800 p-2 lg:block">
          <button
            onClick={logout}
            className="w-full rounded-md px-3 py-2 text-left text-sm text-slate-400 hover:bg-slate-800/60 hover:text-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main id="main-content" className="min-w-0 flex-1 p-5 sm:p-6 lg:ml-64 lg:p-8">
        {children}
      </main>
    </div>
  );
}
