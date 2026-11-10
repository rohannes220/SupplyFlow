import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', isActive: (path) => path === '/' },
  { to: '/orders', label: 'Purchase Orders', isActive: (path) => path.startsWith('/orders') },
  { to: '/vendors', label: 'Vendors', isActive: (path) => path.startsWith('/vendors') },
];

const ROLE_LABELS = { admin: 'Admin', employee: 'Employee' };

const initials = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');

function AccountMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <section aria-label={`Signed in as ${user.name}`} className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className="grid h-9 w-9 place-items-center rounded-full bg-blue-600 text-sm font-semibold text-white"
      >
        {initials(user.name)}
      </span>
      <div className="hidden text-sm leading-tight sm:block">
        <p className="font-medium text-slate-900">{user.name}</p>
        <p className="text-slate-500">{ROLE_LABELS[user.role] ?? user.role}</p>
      </div>
      <button
        type="button"
        onClick={handleLogout}
        className="ml-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        Logout
      </button>
    </section>
  );
}

export default function Layout({ children }) {
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen bg-slate-50 md:pl-60">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col bg-navy-900 text-slate-200 md:flex">
        <div className="flex items-center gap-2 px-5 py-5 text-lg font-semibold text-white">
          <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded bg-blue-600">
            SF
          </span>
          SupplyFlow
        </div>
        <nav aria-label="Main" className="space-y-1 px-3">
          {NAV_ITEMS.map(({ to, label, isActive }) => {
            const active = isActive(pathname);
            return (
              <Link
                key={to}
                to={to}
                aria-current={active ? 'page' : undefined}
                className={`block rounded-md px-3 py-2 text-sm font-medium ${
                  active ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-navy-800'
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3 sm:px-8">
        <span className="font-semibold text-slate-900 md:invisible">SupplyFlow</span>
        <AccountMenu />
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">{children}</main>
    </div>
  );
}
