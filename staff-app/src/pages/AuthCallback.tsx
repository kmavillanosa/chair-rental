import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../api/axios';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { registerPushNotifications } from '../utils/pushNotifications';
import { clearPostLoginRedirect, consumePostLoginRedirect } from '../utils/postLoginRedirect';
import { motion } from 'framer-motion';

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

function resolveSafeUrl(configuredValue: string | undefined, fallbackValue: string) {
  const fallback = String(fallbackValue || '').trim();
  const configured = String(configuredValue || '').trim();
  if (!configured) return fallback;

  try {
    const parsed = new URL(configured);
    const runningOnPublicHost =
      typeof window === 'undefined' || !LOCAL_HOSTNAMES.has(window.location.hostname.toLowerCase());
    if (runningOnPublicHost && LOCAL_HOSTNAMES.has(parsed.hostname.toLowerCase())) {
      return fallback;
    }
    return parsed.toString();
  } catch {
    return fallback;
  }
}

const DEFAULT_CUSTOMER_APP_URL = typeof window === 'undefined'
  ? 'http://localhost:5173/app'
  : new URL('/app', window.location.origin).toString();

function resolveCustomerAuthCallbackUrl(token: string) {
  const customerAppUrl = resolveSafeUrl(import.meta.env.VITE_CUSTOMER_APP_URL, DEFAULT_CUSTOMER_APP_URL).replace(/\/+$/, '');
  return `${customerAppUrl}/auth/callback?token=${encodeURIComponent(token)}`;
}

export default function AuthCallback() {
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
        const nextPath = consumePostLoginRedirect();

        if (data.role === 'admin') {
          await registerPushNotifications(token);
          navigate(nextPath || '/admin', { replace: true });
          return;
        }

        if (data.role === 'vendor') {
          await registerPushNotifications(token);
          navigate(nextPath || '/vendor', { replace: true });
          return;
        }

        if (data.role === 'customer' && data.impersonation?.active) {
          navigate(nextPath || '/customer', { replace: true });
          return;
        }

        window.location.href = resolveCustomerAuthCallbackUrl(token);
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
          Signing you in...
        </motion.p>
      </motion.div>
    </motion.div>
  );
}
