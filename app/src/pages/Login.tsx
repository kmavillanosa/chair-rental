import { loginWithGoogle } from '../api/auth';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/common/LanguageSwitcher';
import { Link, useSearchParams } from 'react-router-dom';
import { HiArrowLeft, HiArrowRight } from 'react-icons/hi';

export default function Login() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const vendorLoginUrl = (
    import.meta.env.VITE_VENDOR_LOGIN_URL ||
    import.meta.env.VITE_STAFF_APP_URL ||
    'http://127.0.0.1:43172/login'
  ).trim();
  const authError = searchParams.get('error')?.trim() || '';

  const handleVendorLoginRedirect = () => {
    window.location.assign(vendorLoginUrl);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex flex-col items-center justify-center p-6">
      <Link
        to="/"
        aria-label={t('login.backToHome')}
        className="group absolute top-6 left-6 inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/40 bg-white/20 text-white backdrop-blur-sm transition-colors hover:bg-white/30"
      >
        <HiArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
      </Link>
      <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full text-center">
        <div className="mb-4 flex justify-end">
          <LanguageSwitcher compact />
        </div>
        <div className="text-7xl mb-4">🪑</div>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">{t('common.appName')}</h1>
        <p className="text-xl text-gray-500 mb-2">{t('login.tagline')}</p>
        <p className="text-lg text-gray-400 mb-8">{t('login.subtitle')}</p>
        {authError && (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-left text-sm font-medium text-rose-700">
            {authError}
          </div>
        )}
        <button
          onClick={loginWithGoogle}
          className="w-full flex items-center justify-center gap-4 bg-white border-2 border-gray-300 rounded-2xl px-6 py-5 text-2xl font-semibold text-gray-700 hover:bg-gray-50 hover:border-blue-400 transition-all shadow-md hover:shadow-lg"
        >
          <svg className="w-8 h-8" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          {t('login.googleButton')}
        </button>

        <div className="my-5 flex items-center gap-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
          <span className="h-px flex-1 bg-gray-200" />
          {t('login.orSeparator')}
          <span className="h-px flex-1 bg-gray-200" />
        </div>

        <button
          type="button"
          onClick={handleVendorLoginRedirect}
          className="group w-full rounded-2xl border border-slate-300 bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 px-6 py-4 text-left text-white shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl"
        >
          <span className="flex items-center justify-between gap-4">
            <span>
              <span className="block text-sm font-medium uppercase tracking-wide text-blue-200">
                {t('login.vendorPortalBadge')}
              </span>
              <span className="mt-1 block text-lg font-semibold leading-tight">
                {t('login.vendorPortalButton')}
              </span>
            </span>
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/20 transition-transform duration-200 group-hover:translate-x-0.5">
              <HiArrowRight className="h-5 w-5" aria-hidden="true" />
            </span>
          </span>
        </button>

        <p className="mt-3 text-sm text-gray-500">{t('login.vendorPortalHint')}</p>
        <p className="mt-6 text-gray-400 text-lg">{t('login.footer')}</p>
      </div>
    </div>
  );
}
