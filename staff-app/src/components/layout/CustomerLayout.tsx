import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import LegalFooter from '../common/LegalFooter';
import { HiCalendar, HiLogout, HiSearch } from 'react-icons/hi';
import { clearPostLoginRedirect, getCurrentAppPath, savePostLoginRedirect } from '../../utils/postLoginRedirect';

export default function CustomerLayout({ children }: { children?: React.ReactNode }) {
  const { user, logout, adminToken, adminUser, stopImpersonation } = useAuthStore();
  const isImpersonating = Boolean(user?.impersonation?.active && adminToken && adminUser);
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-blue-700 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="text-2xl font-bold">RentalBasic</Link>
          <nav className="flex items-center gap-4">
            <Link to="/" className="inline-flex items-center gap-2 text-lg hover:text-blue-200">
              <HiSearch className="h-5 w-5" aria-hidden="true" />
              Find Rentals
            </Link>
            <Link to="/faq" className="text-lg hover:text-blue-200">
              FAQ
            </Link>
            {user ? (
              <>
                <Link to="/my-bookings" className="inline-flex items-center gap-2 text-lg hover:text-blue-200">
                  <HiCalendar className="h-5 w-5" aria-hidden="true" />
                  My Bookings
                </Link>
                {isImpersonating && (
                  <button
                    onClick={() => {
                      stopImpersonation();
                      window.location.href = '/admin/customers';
                    }}
                    className="rounded-lg bg-yellow-300 px-3 py-1 text-sm font-semibold text-slate-900 hover:bg-yellow-200"
                  >
                    Return to Admin
                  </button>
                )}
                <button onClick={() => { logout(); clearPostLoginRedirect(); window.location.href = '/login'; }} className="inline-flex items-center gap-2 text-lg hover:text-blue-200">
                  <HiLogout className="h-5 w-5" aria-hidden="true" />
                  Sign Out
                </button>
              </>
            ) : (
              <Link to="/login" onClick={() => savePostLoginRedirect(getCurrentAppPath())} className="bg-white text-blue-700 px-4 py-2 rounded-lg font-semibold text-lg hover:bg-blue-50">Sign In</Link>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <div className="max-w-7xl mx-auto w-full px-4 py-6">
        <LegalFooter />
      </div>
    </div>
  );
}
