import { loginWithGoogle } from '../api/auth';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/common/LanguageSwitcher';
import LegalFooter from '../components/common/LegalFooter';
import { Link, useSearchParams } from 'react-router-dom';
import { HiArrowLeft, HiArrowRight } from 'react-icons/hi';
import { resolveSafeUrl } from '../utils/envUrl';

export default function Login() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const vendorLoginCandidate = (
    import.meta.env.VITE_VENDOR_LOGIN_URL ||
    'https://vendor.rentalbasic.com/login'
  ).trim();
  const vendorLoginUrl = resolveSafeUrl(vendorLoginCandidate, 'https://vendor.rentalbasic.com/login');
  const authError = searchParams.get('error')?.trim() || '';

  const handleVendorLoginRedirect = () => {
    window.location.assign(vendorLoginUrl);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1f2944] via-[#243153] to-[#0d4ea8] px-4 py-8 sm:px-6 sm:py-10">
      <Link
        to="/"
        aria-label={t('login.backToHome')}
        className="group absolute top-6 left-6 inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/35 bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white/25"
      >
        <HiArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
      </Link>
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md flex-col justify-center">
        <div className="w-full rounded-3xl border border-[#dce3ef] bg-white p-6 text-center shadow-2xl sm:p-10">
          <div className="mb-3 flex justify-end">
            <LanguageSwitcher compact />
          </div>
          <div className="mb-3 flex justify-center">
            <img src="/logo_primary.svg" alt={t('common.appName')} className="h-20 w-auto sm:h-24" />
          </div>
          <p className="mb-1 text-lg text-gray-500 sm:text-xl">{t('login.tagline')}</p>
          <p className="mb-6 text-base text-gray-400 sm:mb-7 sm:text-lg">{t('login.subtitle')}</p>
          {authError && (
            <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-left text-sm font-medium text-rose-700">
              {authError}
            </div>
          )}
          <button
            onClick={loginWithGoogle}
            className="w-full rounded-2xl border-2 border-gray-300 bg-white px-6 py-4 text-xl font-semibold text-gray-700 shadow-md transition-all hover:border-[#1561bf] hover:bg-gray-50 hover:shadow-lg sm:text-2xl"
          >
            <span className="flex items-center justify-center gap-4">
              <svg className="h-8 w-8" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {t('login.googleButton')}
            </span>
          </button>

          <div className="my-4 flex items-center gap-3 text-sm font-semibold uppercase tracking-wider text-gray-400 sm:my-5">
            <span className="h-px flex-1 bg-gray-200" />
            {t('login.orSeparator')}
            <span className="h-px flex-1 bg-gray-200" />
          </div>

          <button
            type="button"
            onClick={handleVendorLoginRedirect}
            className="group w-full rounded-2xl border border-[#2d3f63] bg-gradient-to-r from-[#1f2944] via-[#243153] to-[#0d4ea8] px-6 py-3.5 text-left text-white shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl"
          >
            <span className="flex items-center justify-between gap-4">
              <span className="block text-xl font-semibold leading-tight">{t('login.vendorPortalButton')}</span>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/20 transition-transform duration-200 group-hover:translate-x-0.5">
                <HiArrowRight className="h-5 w-5" aria-hidden="true" />
              </span>
            </span>
          </button>

          <p className="mt-5 text-base text-gray-400 sm:text-lg">{t('login.footer')}</p>
        </div>
        <LegalFooter variant="dark" className="mt-4" />
      </div>
    </div>
  );
}
