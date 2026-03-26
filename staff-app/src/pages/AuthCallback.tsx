import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../api/axios';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { registerPushNotifications } from '../utils/pushNotifications';

export default function AuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { login, logout } = useAuthStore();

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
        if (data.role === 'admin') {
          await registerPushNotifications(token);
          navigate('/admin');
          return;
        }

        if (data.role === 'vendor') {
          await registerPushNotifications(token);
          navigate('/vendor');
          return;
        }

        if (data.role === 'customer' && data.impersonation?.active) {
          navigate('/customer');
          return;
        }

        const appUrl = window.location.origin.replace(/\/staff-app$/, '/app');
        window.location.href = `${appUrl}/auth-callback?token=${encodeURIComponent(token)}`;
      } catch {
        navigate('/login');
      }
    })();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-blue-50">
      <div className="text-center">
        <LoadingSpinner size="lg" />
        <p className="text-2xl text-gray-600 mt-4">Signing you in...</p>
      </div>
    </div>
  );
}
