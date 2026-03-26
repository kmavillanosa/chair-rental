import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../common/LanguageSwitcher';
import { clearPostLoginRedirect } from '../../utils/postLoginRedirect';

const adminLinks = [
  { to: '/admin', labelKey: 'nav.admin.overview', icon: '📊', exact: true },
  { to: '/admin/vendors', labelKey: 'nav.admin.vendors', icon: '🏪' },
  { to: '/admin/item-types', labelKey: 'nav.admin.itemTypes', icon: '📦' },
  { to: '/admin/brands', labelKey: 'nav.admin.brands', icon: '🏷️' },
  { to: '/admin/payments', labelKey: 'nav.admin.payments', icon: '💰' },
];

const vendorLinks = [
  { to: '/vendor', labelKey: 'nav.vendor.overview', icon: '📊', exact: true },
  { to: '/vendor/inventory', labelKey: 'nav.vendor.inventory', icon: '📦' },
  { to: '/vendor/bookings', labelKey: 'nav.vendor.bookings', icon: '📅' },
  { to: '/vendor/pricing', labelKey: 'nav.vendor.pricing', icon: '💵' },
  { to: '/vendor/shop', labelKey: 'nav.vendor.shop', icon: '🏪' },
  { to: '/vendor/payments', labelKey: 'nav.vendor.payments', icon: '💰' },
];

interface Props {
  role: 'admin' | 'vendor';
  className?: string;
  onNavigate?: () => void;
}

export default function Sidebar({ role, className = '', onNavigate }: Props) {
  const { t } = useTranslation();
  const location = useLocation();
  const { logout, user } = useAuthStore();
  const links = role === 'admin' ? adminLinks : vendorLinks;

  return (
    <aside className={`flex min-h-screen w-64 shrink-0 flex-col bg-blue-700 text-white shadow-lg ${className}`.trim()}>
      <div className="p-6 border-b border-blue-600">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <img src="/no_text_logo_dark.svg" alt={t('common.appName')} className="h-7 w-7" />
              <span className="text-2xl font-bold leading-none">{t('common.appName')}</span>
            </div>
            <p className="text-blue-200 text-sm mt-1">{role === 'admin' ? t('nav.adminPanel') : t('nav.vendorPanel')}</p>
          </div>
          <LanguageSwitcher compact className="!border-blue-500 !bg-blue-50" />
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {links.map(({ to, labelKey, icon, exact }) => {
          const active = exact ? location.pathname === to : location.pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              onClick={() => onNavigate?.()}
              className={`flex items-center px-4 py-3 rounded-lg text-lg font-medium transition-colors ${active ? 'bg-white text-blue-700' : 'hover:bg-blue-600'
                }`}
            >
              <span className="mr-2">{icon}</span>
              {t(labelKey)}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-blue-600">
        <div className="mb-3 flex items-start gap-3">
          {user?.avatar && <img src={user.avatar} className="h-10 w-10 shrink-0 rounded-full" alt="" />}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user?.name}</p>
            <p className="mt-0.5 break-all text-xs leading-tight text-blue-200">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={() => {
            onNavigate?.();
            clearPostLoginRedirect();
            logout();
            window.location.href = '/login';
          }}
          className="w-full text-left px-4 py-2 rounded-lg hover:bg-blue-600 text-lg"
        >
          🚪 {t('common.signOut')}
        </button>
      </div>
    </aside>
  );
}
