import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../common/LanguageSwitcher';
import { clearPostLoginRedirect } from '../../utils/postLoginRedirect';
import {
  HiChartBar,
  HiCollection,
  HiCreditCard,
  HiLogout,
  HiShoppingBag,
  HiTag,
  HiCalendar,
  HiCurrencyDollar,
} from 'react-icons/hi';
import type { IconType } from 'react-icons';

interface NavLink {
  to: string;
  labelKey: string;
  icon: IconType;
  exact?: boolean;
}

const adminLinks: NavLink[] = [
  { to: '/admin', labelKey: 'nav.admin.overview', icon: HiChartBar, exact: true },
  { to: '/admin/vendors', labelKey: 'nav.admin.vendors', icon: HiShoppingBag },
  { to: '/admin/item-types', labelKey: 'nav.admin.itemTypes', icon: HiCollection },
  { to: '/admin/brands', labelKey: 'nav.admin.brands', icon: HiTag },
  { to: '/admin/payments', labelKey: 'nav.admin.payments', icon: HiCreditCard },
];

const vendorLinks: NavLink[] = [
  { to: '/vendor', labelKey: 'nav.vendor.overview', icon: HiChartBar, exact: true },
  { to: '/vendor/inventory', labelKey: 'nav.vendor.inventory', icon: HiCollection },
  { to: '/vendor/bookings', labelKey: 'nav.vendor.bookings', icon: HiCalendar },
  { to: '/vendor/pricing', labelKey: 'nav.vendor.pricing', icon: HiCurrencyDollar },
  { to: '/vendor/shop', labelKey: 'nav.vendor.shop', icon: HiShoppingBag },
  { to: '/vendor/payments', labelKey: 'nav.vendor.payments', icon: HiCreditCard },
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
            <img
              src="/dark_logo.svg"
              alt={role === 'admin' ? t('nav.adminPanel') : t('nav.vendorPanel')}
              className="h-10 w-auto"
            />
          </div>
          <LanguageSwitcher compact className="!border-blue-500 !bg-blue-50" />
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {links.map(({ to, labelKey, icon: Icon, exact }) => {
          const active = exact ? location.pathname === to : location.pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              onClick={() => onNavigate?.()}
              className={`flex items-center px-4 py-3 rounded-lg text-lg font-medium transition-colors ${active ? 'bg-white text-blue-700' : 'hover:bg-blue-600'
                }`}
            >
              <span className="mr-2" aria-hidden="true">
                <Icon className="h-5 w-5" />
              </span>
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
          <span className="inline-flex items-center gap-2">
            <HiLogout className="h-5 w-5" aria-hidden="true" />
            {t('common.signOut')}
          </span>
        </button>
      </div>
    </aside>
  );
}
