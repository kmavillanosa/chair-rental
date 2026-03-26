import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';

const adminLinks = [
  { to: '/admin', label: 'Overview', exact: true },
  { to: '/admin/customers', label: 'Customers', exact: true },
  { to: '/admin/vendors/applicants', label: 'Applicants' },
  { to: '/admin/vendors', label: 'Vendors', exact: true },
  { to: '/admin/item-types', label: 'Item Types' },
  { to: '/admin/brands', label: 'Brands' },
  { to: '/admin/payments', label: 'Payments' },
  { to: '/admin/fraud-alerts', label: 'Fraud Alerts' },
  { to: '/admin/disputes', label: 'Disputes' },
  { to: '/admin/settings/feature-flags', label: 'Feature Flags' },
  { to: '/admin/settings/cancellation', label: 'Cancellation Policy' },
  { to: '/admin/settings/kyc', label: 'KYC Controls' },
];

interface MenuLink {
  to?: string;
  label: string;
  icon?: string;
  exact?: boolean;
  matchPrefixes?: string[];
  children?: MenuLink[];
}

const vendorLinks: MenuLink[] = [
  { to: '/vendor', label: 'Overview', icon: '📊', exact: true },
  { to: '/vendor/inventory', label: 'Inventory', icon: '📦' },
  {
    label: 'Bookings',
    icon: '📅',
    matchPrefixes: ['/vendor/bookings'],
    children: [
      { to: '/vendor/bookings', label: 'List of Bookings', exact: true },
      { to: '/vendor/bookings/calendar', label: 'Booking Calendar' },
    ],
  },
  {
    label: 'Pricing',
    icon: '💵',
    matchPrefixes: ['/vendor/pricing'],
    children: [
      { to: '/vendor/pricing/distance', label: 'Distance Pricing' },
      { to: '/vendor/pricing/helpers', label: 'Helper Pricing' },
    ],
  },
  { to: '/vendor/vehicles', label: 'Delivery Vehicles', icon: '🚚' },
  { to: '/vendor/shop', label: 'My Shop', icon: '🏪' },
  { to: '/vendor/payments', label: 'Payments', icon: '💰' },
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
            <span aria-hidden="true">{link.icon || '•'}</span>
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
        <span aria-hidden="true">{link.icon || '•'}</span>
        <span>{link.label}</span>
      </span>
    </Link>
  );
}

export default function Sidebar({ role, className = '', onNavigate, dataTour }: Props) {
  const location = useLocation();
  const { logout, user, adminToken, adminUser, stopImpersonation } = useAuthStore();
  const links = role === 'admin' ? adminLinks : vendorLinks;
  const isImpersonating = Boolean(user?.impersonation?.active && adminToken && adminUser);

  return (
    <aside
      data-tour={dataTour}
      className={`flex h-full min-h-0 w-64 shrink-0 flex-col border-r border-[#2d3f63] bg-[#1f2944] text-slate-100 shadow-lg ${className}`.trim()}
    >
      <div className="border-b border-[#2d3f63] p-6">
        <div className="flex items-center gap-2">
          <img src="/no_text_logo_dark.svg" alt="RentalBasic" className="h-8 w-8" />
          <span className="text-[30px] font-bold leading-none tracking-tight">RentalBasic</span>
        </div>
        <p className="mt-1 text-sm text-slate-300">{role === 'admin' ? 'Admin Panel' : 'Vendor Panel'}</p>
      </div>
      <nav className="flex-1 min-h-0 overflow-y-auto p-4 space-y-1">
        {role === 'admin'
          ? links.map(({ to, label, exact }) => {
            const active = exact ? location.pathname === to : location.pathname === to || location.pathname.startsWith(`${to}/`);
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
          })
          : (links as MenuLink[]).map((link) => <SidebarLink key={link.label} link={link} onNavigate={onNavigate} location={location} />)}
      </nav>
      <div className="border-t border-[#2d3f63] p-4">
        {isImpersonating && (
          <button
            onClick={() => {
              onNavigate?.();
              stopImpersonation();
              window.location.href = '/admin';
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
