import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTour } from '@reactour/tour';
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
  const { setIsOpen, setCurrentStep } = useTour();
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

  const handleOpenGuide = () => {
    setCurrentStep(0);
    setIsOpen(true);
  };

  const navLinks = [
    ...(user
      ? [
        {
          to: '/my-bookings',
          label: t('nav.myBookings'),
          active: location.pathname.startsWith('/my-bookings'),
          dataTour: 'nav-my-bookings',
        },
      ]
      : []),
    ...(user?.role === 'customer'
      ? [
        {
          to: '/become-vendor',
          label: t('nav.becomeVendor'),
          active: location.pathname.startsWith('/become-vendor'),
          dataTour: 'nav-become-vendor',
        },
      ]
      : []),
  ];

  return (
    <div className={`min-h-screen bg-[#f3f5f8] ${hideHeaderBackground ? 'relative flex flex-col' : 'flex flex-col'}`}>
      <header className={headerClassName}>
        <div className="mx-auto max-w-7xl px-3 py-2 sm:px-4 sm:py-3">
          <div className="flex items-center justify-between gap-2">
            <Link to="/" data-tour="header-brand" className="inline-flex min-w-0 items-center">
              <img src="/logo_dark.svg" alt="" aria-hidden="true" className="h-10 w-auto shrink-0 sm:h-12" />
            </Link>

            <div className="flex items-center gap-2">
              <LanguageSwitcher compact />
              <button
                type="button"
                aria-label="Toggle navigation menu"
                aria-expanded={mobileMenuOpen}
                aria-controls="customer-mobile-menu"
                onClick={() => setMobileMenuOpen((current) => !current)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/40 text-white transition hover:bg-white/10 md:hidden"
              >
                {mobileMenuOpen ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
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

          <nav data-tour="header-nav" className="mt-2 hidden flex-wrap items-center gap-1 md:flex">
            {navLinks.map((link) => (
              <Link key={link.to} to={link.to} data-tour={link.dataTour} className={navPillClass(link.active)}>
                {link.label}
              </Link>
            ))}
          </nav>

          {mobileMenuOpen && (
            <nav
              id="customer-mobile-menu"
              className="mt-2 rounded-xl border border-white/20 bg-[#162038] p-3 shadow-xl md:hidden"
            >
              {/* Nav links */}
              {navLinks.length > 0 && (
                <div className="mb-2 flex flex-col gap-1">
                  {navLinks.map((link) => (
                    <Link
                      key={link.to}
                      to={link.to}
                      data-tour={link.dataTour}
                      className={`flex items-center rounded-lg px-4 py-3 text-sm font-medium transition ${link.active
                        ? 'bg-[#b7e92f] text-[#1f2944]'
                        : 'text-slate-100 hover:bg-white/10'
                        }`}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              )}

              {/* Auth action — full-width, easy tap target */}
              <div className="border-t border-white/10 pt-3">
                {user ? (
                  <button
                    onClick={handleSignOut}
                    className="flex w-full items-center justify-center rounded-lg border border-white/20 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
                  >
                    {t('common.signOut')}
                  </button>
                ) : (
                  <Link
                    to="/login"
                    onClick={() => savePostLoginRedirect(getCurrentAppPath())}
                    className="flex w-full items-center justify-center rounded-lg bg-[#b7e92f] px-4 py-3 text-sm font-bold text-[#1f2944] transition hover:bg-[#9fcd23]"
                  >
                    {t('common.signIn')}
                  </Link>
                )}
              </div>
            </nav>
          )}
        </div>
      </header>
      <main data-tour="main-content" className="flex-1">{children}</main>

      {/* Floating guide button — bottom-right, out of the way */}
      <button
        id="tour-info-button"
        data-tour="guide-button"
        type="button"
        onClick={handleOpenGuide}
        className="fixed bottom-6 right-5 z-[1200] flex h-11 w-11 items-center justify-center rounded-full bg-[#1f2944] text-white shadow-lg transition hover:bg-[#2d3a5e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b7e92f]"
        title={t('tour.customer.openGuideTitle')}
        aria-label={t('tour.customer.openGuideAriaLabel')}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
        </svg>
      </button>
      <div data-tour="footer-legal" className="mx-auto w-full max-w-7xl px-3 pb-6 pt-4 sm:px-4">
        <LegalFooter />
      </div>
    </div>
  );
}
