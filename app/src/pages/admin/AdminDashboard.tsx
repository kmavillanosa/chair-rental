import { useEffect, useState } from 'react';
import { Card } from 'flowbite-react';
import AdminLayout from '../../components/layout/AdminLayout';
import { getAllVendors } from '../../api/vendors';
import { getAllPayments } from '../../api/payments';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ vendors: 0, active: 0, payments: 0, overdue: 0 });

  useEffect(() => {
    Promise.all([getAllVendors(), getAllPayments()])
      .then(([vendors, payments]) => {
        setStats({
          vendors: vendors.length,
          active: vendors.filter(v => v.isActive).length,
          payments: payments.length,
          overdue: payments.filter(p => p.status === 'overdue').length,
        });
      })
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    { label: '🏪 Total Vendors', value: stats.vendors, color: 'bg-blue-100 text-blue-800' },
    { label: '✅ Active Vendors', value: stats.active, color: 'bg-green-100 text-green-800' },
    { label: '💰 Total Payments', value: stats.payments, color: 'bg-yellow-100 text-yellow-800' },
    { label: '⚠️ Overdue Payments', value: stats.overdue, color: 'bg-red-100 text-red-800' },
  ];

  return (
    <AdminLayout>
      <h1 className="text-4xl font-bold text-gray-900 mb-8">📊 Dashboard Overview</h1>
      {loading ? <LoadingSpinner /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {cards.map(c => (
            <div key={c.label} className={`rounded-2xl p-6 ${c.color}`}>
              <p className="text-lg font-semibold">{c.label}</p>
              <p className="text-5xl font-bold mt-2">{c.value}</p>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
