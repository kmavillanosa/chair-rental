
import { useEffect } from 'react';

export default function VendorDashboard() {
  useEffect(() => {
    // Redirect vendors/admins to the staff portal dashboard
    const staffUrl = (import.meta.env.VITE_STAFF_APP_URL || 'http://localhost:43172').replace(/\/$/, '');
    window.location.href = `${staffUrl}/vendor/dashboard`;
  }, []);
  return null;
}
