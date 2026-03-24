import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../api/axios';
import LoadingSpinner from '../components/common/LoadingSpinner';

export default function AuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { login, logout } = useAuthStore();

  useEffect(() => {
    const token = params.get('token');
    if (!token) { navigate('/login'); return; }

    // Fetch user info
    api.get('/users/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(({ data }) => {
        login(token, data);
        if (data.role === 'admin') navigate('/admin');
        else if (data.role === 'vendor') navigate('/vendor');
        else if (data.role === 'customer' && data.impersonation?.active) {
          navigate('/customer');
        }
        else {
          // Redirect customer to main app with token
          const appUrl = window.location.origin.replace(/\/staff-app$/, '/app');
          window.location.href = `${appUrl}/auth-callback?token=${encodeURIComponent(token)}`;
        }
      })
      .catch(() => navigate('/login'));
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
