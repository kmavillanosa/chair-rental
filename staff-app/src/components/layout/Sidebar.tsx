import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { clearPostLoginRedirect } from '../../utils/postLoginRedirect';
import {
  HiAdjustments,
  HiCalendar,
  HiChartBar,
  HiClipboardList,
  HiCollection,
  HiCreditCard,
  HiCurrencyDollar,
  HiLogout,
  HiShoppingBag,
  HiTruck,
} from 'react-icons/hi';
import type { IconType } from 'react-icons';

interface MenuLink {
  to?: string;
  label: string;
  icon?: IconType;
  exact?: boolean;
  matchPrefixes?: string[];
  children?: MenuLink[];
}

const adminLinks: MenuLink[] = [
  { to: '/admin', label: 'Overview', icon: HiChartBar, exact: true },
  {
    label: 'Vendors',
    icon: HiShoppingBag,
    matchPrefixes: ['/admin/vendors'],
    children: [
      { to: '/admin/vendors/applicants', label: 'Applicants' },
      { to: '/admin/vendors', label: 'Rental Partners', exact: true },
    ],
  },
  {
    label: 'Operations',
    icon: HiClipboardList,
    matchPrefixes: ['/admin/customers', '/admin/disputes', '/admin/fraud-alerts'],
    children: [
      { to: '/admin/customers', label: 'Customers', exact: true },
      { to: '/admin/disputes', label: 'Disputes' },
      { to: '/admin/fraud-alerts', label: 'Fraud Alerts' },
    ],
  },
  {
    label: 'Catalog',
    icon: HiCollection,
    matchPrefixes: ['/admin/item-types', '/admin/brands', '/admin/packages'],
    children: [
      { to: '/admin/item-types', label: 'Item Types' },
      { to: '/admin/brands', label: 'Brands' },
      { to: '/admin/packages', label: 'Packages' },
    ],
  },
  { to: '/admin/payments', label: 'Payments', icon: HiCreditCard },
  {
    label: 'Settings',
    icon: HiAdjustments,
    matchPrefixes: ['/admin/settings'],
    children: [
      { to: '/admin/settings/feature-flags', label: 'Feature Flags' },
      { to: '/admin/settings/cancellation', label: 'Cancellation Policy' },
      { to: '/admin/settings/kyc', label: 'KYC Controls' },
    ],
  },
];

const vendorLinks: MenuLink[] = [
  { to: '/vendor', label: 'Overview', icon: HiChartBar, exact: true },
  { to: '/vendor/inventory', label: 'Inventory', icon: HiCollection },
  {
    label: 'Bookings',
    icon: HiCalendar,
    matchPrefixes: ['/vendor/bookings'],
    children: [
      { to: '/vendor/bookings', label: 'List of Bookings', exact: true },
      { to: '/vendor/bookings/calendar', label: 'Booking Calendar' },
    ],
  },
  {
    label: 'Pricing',
    icon: HiCurrencyDollar,
    matchPrefixes: ['/vendor/pricing'],
    children: [
      { to: '/vendor/pricing/distance', label: 'Distance Pricing' },
      { to: '/vendor/pricing/helpers', label: 'Helper Pricing' },
    ],
  },
  { to: '/vendor/vehicles', label: 'Delivery Vehicles', icon: HiTruck },
  { to: '/vendor/shop', label: 'My Shop', icon: HiShoppingBag },
  { to: '/vendor/payments', label: 'Payments', icon: HiCreditCard },
];

interface Props {
  role: 'admin' | 'vendor';
  className?: string;
  onNavigate?: () => void;
  dataTour?: string;
}

function isPathActive(
  pathname: string,
  to?: string,
  exact?: boolean,
  matchPrefixes?: string[],
): boolean {
  if (matchPrefixes?.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return true;
  }

  if (!to) return false;
  if (exact) return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
}

function SidebarLink({ link, onNavigate, location }: { link: MenuLink; onNavigate?: () => void; location: ReturnType<typeof useLocation> }) {
  const LinkIcon = link.icon;
  const linkIsActive = isPathActive(
    location.pathname,
    link.to,
    link.exact,
    link.matchPrefixes,
  );
  const childIsActive =
    link.children?.some((child) =>
      isPathActive(location.pathname, child.to, child.exact, child.matchPrefixes),
    ) || false;
  const shouldBeOpen = linkIsActive || childIsActive;
  const [expanded, setExpanded] = useState(shouldBeOpen);

  useEffect(() => {
    if (shouldBeOpen) {
      setExpanded(true);
    }
  }, [shouldBeOpen]);

  if (link.children && link.children.length > 0) {
    const sectionId = `sidebar-group-${link.label.toLowerCase().replace(/\s+/g, '-')}`;

    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-controls={sectionId}
          className={`w-full flex items-center justify-between px-3 py-2 rounded text-sm font-medium transition-colors ${shouldBeOpen || expanded
            ? 'bg-[#b7e92f] text-[#1f2944]'
            : 'text-slate-100 hover:bg-[#2d3f63]'
            }`}
        >
          <span className="inline-flex items-center gap-2">
            {LinkIcon ? (
              <LinkIcon className="h-4 w-4" aria-hidden="true" />
            ) : (
              <span aria-hidden="true">•</span>
            )}
            <span>{link.label}</span>
          </span>
          <svg
            className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="m6 9 6 6 6-6"
            />
          </svg>
        </button>
        {expanded && (
          <div id={sectionId} className="ml-4 mt-1 space-y-1 border-l border-[#2d3f63] pl-2">
            {link.children.map((child) => {
              const active = isPathActive(
                location.pathname,
                child.to,
                child.exact,
                child.matchPrefixes,
              );
              return (
                <Link
                  key={child.to}
                  to={child.to!}
                  onClick={() => onNavigate?.()}
                  className={`block px-3 py-2 rounded text-sm font-medium transition-colors ${active
                    ? 'bg-[#b7e92f] text-[#1f2944]'
                    : 'text-slate-100 hover:bg-[#2d3f63]'
                    }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <span className="text-xs" aria-hidden="true">↳</span>
                    <span>{child.label}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const active = isPathActive(
    location.pathname,
    link.to,
    link.exact,
    link.matchPrefixes,
  );
  return (
    <Link
      to={link.to!}
      onClick={() => onNavigate?.()}
      className={`flex items-center px-3 py-2 rounded text-sm font-medium transition-colors ${active ? 'bg-[#b7e92f] text-[#1f2944]' : 'text-slate-100 hover:bg-[#2d3f63]'
        }`}
    >
      <span className="inline-flex items-center gap-2">
        {LinkIcon ? (
          <LinkIcon className="h-4 w-4" aria-hidden="true" />
        ) : (
          <span aria-hidden="true">•</span>
        )}
        <span>{link.label}</span>
      </span>
    </Link>
  );
}

export default function Sidebar({ role, className = '', onNavigate, dataTour }: Props) {
  const location = useLocation();
  const { logout, user, adminToken, adminUser, stopImpersonation } = useAuthStore();
  const links: MenuLink[] = role === 'admin' ? adminLinks : vendorLinks;
  const isImpersonating = Boolean(user?.impersonation?.active && adminToken && adminUser);

  return (
    <aside
      data-tour={dataTour}
      className={`flex h-full min-h-0 w-64 shrink-0 flex-col border-r border-[#2d3f63] bg-[#1f2944] text-slate-100 shadow-lg ${className}`.trim()}
    >
      <div className="border-b border-[#2d3f63] p-6">
        <img
          src="/dark_logo.svg"
          alt={role === 'admin' ? 'RentalBasic Admin Panel' : 'RentalBasic Rental Partner Panel'}
          className="h-20 w-auto"
        />
      </div>
      <nav className="flex-1 min-h-0 overflow-y-auto p-4 space-y-1">
        {links.map((link) => (
          <SidebarLink key={link.label} link={link} onNavigate={onNavigate} location={location} />
        ))}
      </nav>
      <div className="border-t border-[#2d3f63] p-4">
        {isImpersonating && (
          <button
            onClick={() => {
              onNavigate?.();
              stopImpersonation();
              window.location.href = user?.role === 'vendor' ? '/admin/vendors' : '/admin/customers';
            }}
            className="mb-3 w-full rounded-lg border border-[#b7e92f]/70 bg-[#b7e92f] px-4 py-2 text-left text-sm font-semibold text-[#1f2944] transition hover:brightness-95"
          >
            Return to Admin
          </button>
        )}
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
            clearPostLoginRedirect();
            window.location.href = '/login';
          }}
          className="w-full rounded-lg px-4 py-2 text-left text-base text-slate-100 transition-colors hover:bg-[#2d3f63]"
        >
          <span className="inline-flex items-center gap-2">
            <HiLogout className="h-5 w-5" aria-hidden="true" />
            Sign Out
          </span>
        </button>
      </div>
    </aside>
  );
}
