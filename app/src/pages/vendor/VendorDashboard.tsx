import { useEffect, useState } from 'react';
import VendorLayout from '../../components/layout/VendorLayout';
import { getMyVendor } from '../../api/vendors';
import { getVendorBookings } from '../../api/bookings';
import { getMyPayments } from '../../api/payments';
import type { Vendor, Booking, VendorPayment } from '../../types';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatCurrency } from '../../utils/format';
import { useTranslation } from 'react-i18next';

export default function VendorDashboard() {
  const { t } = useTranslation();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payments, setPayments] = useState<VendorPayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getMyVendor(), getVendorBookings(), getMyPayments()])
      .then(([v, b, p]) => { setVendor(v); setBookings(b); setPayments(p); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <VendorLayout><LoadingSpinner /></VendorLayout>;

  const overduePayments = payments.filter(p => p.status === 'overdue');
  const todayBookings = bookings.filter(b => {
    const today = new Date().toISOString().split('T')[0];
    return b.startDate <= today && b.endDate >= today && b.status === 'confirmed';
  });

  return (
    <VendorLayout>
      {vendor?.warningCount && vendor.warningCount > 0 && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-lg text-xl">
          ⚠️ {t('vendorDashboard.warningBanner', { count: vendor.warningCount })}
        </div>
      )}
      {overduePayments.length > 0 && (
        <div className="bg-orange-100 border-l-4 border-orange-500 text-orange-700 p-4 mb-6 rounded-lg text-xl">
          💰 {t('vendorDashboard.overdueBanner', { count: overduePayments.length })}
        </div>
      )}
      <h1 className="text-4xl font-bold text-gray-900 mb-6">👋 {t('vendorDashboard.welcome', { name: vendor?.businessName || '' })}</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-blue-100 rounded-2xl p-6">
          <p className="text-lg">📅 {t('vendorDashboard.todaysActiveBookings')}</p>
          <p className="text-5xl font-bold text-blue-800 mt-2">{todayBookings.length}</p>
        </div>
        <div className="bg-green-100 rounded-2xl p-6">
          <p className="text-lg">📋 {t('vendorDashboard.totalBookings')}</p>
          <p className="text-5xl font-bold text-green-800 mt-2">{bookings.length}</p>
        </div>
        <div className="bg-yellow-100 rounded-2xl p-6">
          <p className="text-lg">⚠️ {t('vendorDashboard.warnings')}</p>
          <p className="text-5xl font-bold text-yellow-800 mt-2">{vendor?.warningCount || 0}/3</p>
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow p-6">
        <h2 className="text-2xl font-bold mb-4">🏪 {t('vendorDashboard.shopPathTitle', { slug: vendor?.slug || '' })}</h2>
        <p className="text-gray-600 text-lg">{vendor?.address}</p>
        <a href={`/shop/${vendor?.slug}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-lg hover:underline mt-2 inline-block">{t('vendorDashboard.viewPublicPage')} →</a>
      </div>
    </VendorLayout>
  );
}
