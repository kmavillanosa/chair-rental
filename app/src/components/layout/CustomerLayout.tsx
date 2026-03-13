import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../common/LanguageSwitcher';

interface CustomerLayoutProps {
  children?: React.ReactNode;
  hideHeaderBackground?: boolean;
}

export default function CustomerLayout({ children, hideHeaderBackground = false }: CustomerLayoutProps) {
  const { t } = useTranslation();
  const { user, logout } = useAuthStore();

  const headerClassName = hideHeaderBackground
    ? 'absolute inset-x-0 top-0 z-[1100] bg-transparent text-white'
    : 'bg-blue-700 text-white shadow-md';

  return (
    <div className={`min-h-screen bg-gray-50 ${hideHeaderBackground ? 'relative' : ''}`}>
      <header className={headerClassName}>
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="text-2xl font-bold">🪑 {t('common.appName')}</Link>
          <nav className="flex items-center gap-4">
            <LanguageSwitcher compact />
            <Link to="/" className="text-lg hover:text-blue-200">🔍 {t('nav.findRentals')}</Link>
            {user ? (
              <>
                <Link to="/my-bookings" className="text-lg hover:text-blue-200">📅 {t('nav.myBookings')}</Link>
                {user.role === 'customer' && (
                  <Link to="/become-vendor" className="text-lg hover:text-blue-200">🏪 {t('nav.becomeVendor')}</Link>
                )}
                <button onClick={() => { logout(); window.location.href = '/login'; }} className="text-lg hover:text-blue-200">🚪 {t('common.signOut')}</button>
              </>
            ) : (
              <Link to="/login" className="bg-white text-blue-700 px-4 py-2 rounded-lg font-semibold text-lg hover:bg-blue-50">{t('common.signIn')}</Link>
            )}
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
