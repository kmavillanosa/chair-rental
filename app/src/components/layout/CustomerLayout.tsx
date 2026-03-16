import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../common/LanguageSwitcher';
import LegalFooter from '../common/LegalFooter';
import { clearPostLoginRedirect, getCurrentAppPath, savePostLoginRedirect } from '../../utils/postLoginRedirect';

interface CustomerLayoutProps {
  children?: React.ReactNode;
  hideHeaderBackground?: boolean;
}

export default function CustomerLayout({ children, hideHeaderBackground = false }: CustomerLayoutProps) {
  const { t } = useTranslation();
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const headerClassName = hideHeaderBackground
    ? 'absolute inset-x-0 top-0 z-[1100] border-b border-white/10 bg-[#1f2944]/95 text-white shadow-sm backdrop-blur'
    : 'bg-[#1f2944] text-white shadow-md';

  const navPillClass = (isActive: boolean) =>
    `inline-flex items-center rounded-md px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${isActive
      ? 'bg-[#b7e92f] text-[#1f2944]'
      : 'text-slate-100 hover:bg-white/10 hover:text-white'
    }`;

  const secondaryActionClass =
    'inline-flex items-center rounded-md px-3 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/10 hover:text-white';

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleSignOut = () => {
    clearPostLoginRedirect();
    logout();
    window.location.href = '/login';
  };

  const navLinks = [
    ...(user
      ? [
        {
          to: '/my-bookings',
          label: t('nav.myBookings'),
          active: location.pathname.startsWith('/my-bookings'),
        },
      ]
      : []),
    ...(user?.role === 'customer'
      ? [
        {
          to: '/become-vendor',
          label: t('nav.becomeVendor'),
          active: location.pathname.startsWith('/become-vendor'),
        },
      ]
      : []),
  ];

  return (
    <div className={`min-h-screen bg-[#f3f5f8] ${hideHeaderBackground ? 'relative flex flex-col' : 'flex flex-col'}`}>
      <header className={headerClassName}>
        <div className="mx-auto max-w-7xl px-3 py-2 sm:px-4 sm:py-3">
          <div className="flex items-center justify-between gap-2">
            <Link to="/" className="inline-flex min-w-0 items-center gap-2 text-lg font-bold sm:text-2xl">
              <span aria-hidden="true">🪑</span>
              <span className="truncate">{t('common.appName')}</span>
            </Link>

            <div className="flex items-center gap-2">
              <LanguageSwitcher compact />
              <button
                type="button"
                aria-label="Toggle navigation menu"
                aria-expanded={mobileMenuOpen}
                aria-controls="customer-mobile-menu"
                onClick={() => setMobileMenuOpen((current) => !current)}
                className="inline-flex h-9 items-center justify-center rounded-md border border-white/40 px-2.5 text-sm font-semibold text-white transition hover:bg-white/10 md:hidden"
              >
                {mobileMenuOpen ? 'Close' : 'Menu'}
              </button>

              <div className="hidden items-center gap-2 md:flex">
                {user ? (
                  <button onClick={handleSignOut} className={secondaryActionClass}>
                    {t('common.signOut')}
                  </button>
                ) : (
                  <Link
                    to="/login"
                    onClick={() => savePostLoginRedirect(getCurrentAppPath())}
                    className="inline-flex items-center rounded-md bg-[#b7e92f] px-3 py-2 text-sm font-semibold text-[#1f2944] transition hover:bg-[#9fcd23]"
                  >
                    {t('common.signIn')}
                  </Link>
                )}
              </div>
            </div>
          </div>

          <nav className="mt-2 hidden flex-wrap items-center gap-1 md:flex">
            {navLinks.map((link) => (
              <Link key={link.to} to={link.to} className={navPillClass(link.active)}>
                {link.label}
              </Link>
            ))}
          </nav>

          {mobileMenuOpen && (
            <nav
              id="customer-mobile-menu"
              className="mt-2 rounded-xl border border-white/25 bg-[#1f2944]/90 p-2 backdrop-blur md:hidden"
            >
              <div className="flex flex-col gap-1">
                {navLinks.map((link) => (
                  <Link key={link.to} to={link.to} className={navPillClass(link.active)}>
                    {link.label}
                  </Link>
                ))}

                {user ? (
                  <button onClick={handleSignOut} className={`${secondaryActionClass} justify-start`}>
                    {t('common.signOut')}
                  </button>
                ) : (
                  <Link
                    to="/login"
                    onClick={() => savePostLoginRedirect(getCurrentAppPath())}
                    className="inline-flex items-center rounded-md bg-[#b7e92f] px-3 py-2 text-sm font-semibold text-[#1f2944] transition hover:bg-[#9fcd23]"
                  >
                    {t('common.signIn')}
                  </Link>
                )}
              </div>
            </nav>
          )}
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <div className="mx-auto w-full max-w-7xl px-3 pb-6 pt-4 sm:px-4">
        <LegalFooter />
      </div>
    </div>
  );
}
