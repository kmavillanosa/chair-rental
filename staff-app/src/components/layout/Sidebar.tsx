import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

const adminLinks = [
  { to: '/admin', label: 'Overview', exact: true },
  { to: '/admin/vendors', label: 'Vendors' },
  { to: '/admin/item-types', label: 'Item Types' },
  { to: '/admin/brands', label: 'Brands' },
  { to: '/admin/payments', label: 'Payments' },
  { to: '/admin/fraud-alerts', label: 'Fraud Alerts' },
  { to: '/admin/disputes', label: 'Disputes' },
  { to: '/admin/settings/feature-flags', label: 'Feature Flags' },
];

const vendorLinks = [
  { to: '/vendor', label: 'Overview', exact: true },
  { to: '/vendor/inventory', label: 'My Inventory' },
  { to: '/vendor/bookings', label: 'Bookings' },
  { to: '/vendor/pricing', label: 'Pricing' },
  { to: '/vendor/shop', label: 'My Shop' },
  { to: '/vendor/payments', label: 'Payments' },
];

interface Props {
  role: 'admin' | 'vendor';
  className?: string;
  onNavigate?: () => void;
}

export default function Sidebar({ role, className = '', onNavigate }: Props) {
  const location = useLocation();
  const { logout, user } = useAuthStore();
  const links = role === 'admin' ? adminLinks : vendorLinks;

  return (
    <aside className={`flex h-full min-h-0 w-64 shrink-0 flex-col border-r border-[#2d3f63] bg-[#1f2944] text-slate-100 shadow-lg ${className}`.trim()}>
      <div className="border-b border-[#2d3f63] p-6">
        <h1 className="text-base font-bold">RentalBasic</h1>
        <p className="mt-1 text-sm text-slate-300">{role === 'admin' ? 'Admin Panel' : 'Vendor Panel'}</p>
      </div>
      <nav className="flex-1 min-h-0 overflow-y-auto p-4 space-y-1">
        {links.map(({ to, label, exact }) => {
          const active = exact ? location.pathname === to : location.pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              onClick={() => onNavigate?.()}
              className={`flex items-center px-3 py-2 rounded text-sm font-medium transition-colors ${active ? 'bg-[#b7e92f] text-[#1f2944]' : 'text-slate-100 hover:bg-[#2d3f63]'
                }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-[#2d3f63] p-4">
        <div className="mb-3 flex items-start gap-3">
          {user?.avatar && <img src={user.avatar} className="h-10 w-10 shrink-0 rounded-full" alt="" />}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user?.name}</p>
            <p className="mt-0.5 break-all text-xs leading-tight text-slate-300">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={() => {
            onNavigate?.();
            logout();
            window.location.href = '/login';
          }}
          className="w-full rounded-lg px-4 py-2 text-left text-base text-slate-100 transition-colors hover:bg-[#2d3f63]"
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}
