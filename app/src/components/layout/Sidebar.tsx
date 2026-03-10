import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

const adminLinks = [
  { to: '/admin', label: '📊 Overview', exact: true },
  { to: '/admin/vendors', label: '🏪 Vendors' },
  { to: '/admin/item-types', label: '📦 Item Types' },
  { to: '/admin/brands', label: '🏷️ Brands' },
  { to: '/admin/payments', label: '💰 Payments' },
];

const vendorLinks = [
  { to: '/vendor', label: '📊 Overview', exact: true },
  { to: '/vendor/inventory', label: '📦 My Inventory' },
  { to: '/vendor/bookings', label: '📅 Bookings' },
  { to: '/vendor/pricing', label: '💵 Pricing' },
  { to: '/vendor/shop', label: '🏪 My Shop' },
  { to: '/vendor/payments', label: '💰 Payments' },
];

interface Props { role: 'admin' | 'vendor' }

export default function Sidebar({ role }: Props) {
  const location = useLocation();
  const { logout, user } = useAuthStore();
  const links = role === 'admin' ? adminLinks : vendorLinks;

  return (
    <aside className="w-64 min-h-screen bg-blue-700 text-white flex flex-col shadow-lg">
      <div className="p-6 border-b border-blue-600">
        <h1 className="text-2xl font-bold">🪑 RentEasy</h1>
        <p className="text-blue-200 text-sm mt-1">{role === 'admin' ? 'Admin Panel' : 'Vendor Panel'}</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {links.map(({ to, label, exact }) => {
          const active = exact ? location.pathname === to : location.pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={`flex items-center px-4 py-3 rounded-lg text-lg font-medium transition-colors ${
                active ? 'bg-white text-blue-700' : 'hover:bg-blue-600'
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-blue-600">
        <div className="flex items-center gap-3 mb-3">
          {user?.avatar && <img src={user.avatar} className="w-10 h-10 rounded-full" alt="" />}
          <div>
            <p className="font-semibold text-sm">{user?.name}</p>
            <p className="text-blue-200 text-xs">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={() => { logout(); window.location.href = '/login'; }}
          className="w-full text-left px-4 py-2 rounded-lg hover:bg-blue-600 text-lg"
        >
          🚪 Sign Out
        </button>
      </div>
    </aside>
  );
}
