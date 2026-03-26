import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../api/axios';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useTranslation } from 'react-i18next';
import { consumePostLoginRedirect, clearPostLoginRedirect } from '../utils/postLoginRedirect';
import { registerPushNotifications } from '../utils/pushNotifications';

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
          const staffUrl = window.location.origin.replace(/\/app$/, '/staff-app');
          window.location.href = `${staffUrl}/auth-callback?token=${encodeURIComponent(token)}`;
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
    <div className="min-h-screen flex items-center justify-center bg-blue-50">
      <div className="text-center">
        <LoadingSpinner size="lg" />
        <p className="text-2xl text-gray-600 mt-4">{t('authCallback.signingIn')}</p>
      </div>
    </div>
  );
}
