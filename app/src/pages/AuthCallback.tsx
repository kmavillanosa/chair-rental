import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../api/axios';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useTranslation } from 'react-i18next';
import { consumePostLoginRedirect, clearPostLoginRedirect } from '../utils/postLoginRedirect';
import { registerPushNotifications } from '../utils/pushNotifications';
import { resolveSafeUrl } from '../utils/envUrl';
import { motion } from 'framer-motion';

const DEFAULT_STAFF_APP_URL = typeof window === 'undefined'
  ? 'http://localhost:5174/staff-app'
  : new URL('/staff-app', window.location.origin).toString();

function resolveStaffAuthCallbackUrl(token: string) {
  const staffAppUrl = resolveSafeUrl(import.meta.env.VITE_STAFF_APP_URL, DEFAULT_STAFF_APP_URL).replace(/\/+$/, '');
  return `${staffAppUrl}/auth/callback?token=${encodeURIComponent(token)}`;
}

export default function AuthCallback() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuthStore();

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      navigate('/login');
      return;
    }

    void (async () => {
      try {
        const { data } = await api.get('/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        });

        login(token, data);
        if (data.role === 'admin' || data.role === 'vendor') {
          clearPostLoginRedirect();
          window.location.href = resolveStaffAuthCallbackUrl(token);
          return;
        }

        await registerPushNotifications(token);
        const nextPath = consumePostLoginRedirect();
        navigate(nextPath || '/', { replace: true });
      } catch {
        clearPostLoginRedirect();
        navigate('/login');
      }
    })();
  }, []);

  return (
    <motion.div
      className="min-h-screen flex items-center justify-center bg-blue-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <motion.div
        className="text-center"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: 'easeOut' }}
      >
        <LoadingSpinner size="lg" />
        <motion.p
          className="text-2xl text-gray-600 mt-4"
          animate={{ opacity: [0.55, 1, 0.55] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          {t('authCallback.signingIn')}
        </motion.p>
      </motion.div>
    </motion.div>
  );
}
