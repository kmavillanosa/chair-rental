import { useEffect, useState } from 'react';
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
    { label: 'Total Vendors', value: stats.vendors },
    { label: 'Active Vendors', value: stats.active },
    { label: 'Total Payments', value: stats.payments },
    { label: 'Overdue Payments', value: stats.overdue },
  ];

  return (
    <AdminLayout>
      <h1 className="mb-5 text-xl font-semibold text-slate-800">Overview</h1>
      {loading ? <LoadingSpinner /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {cards.map(c => (
            <div key={c.label} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-base font-semibold text-slate-600">{c.label}</p>
              <p className="mt-1 text-3xl font-bold text-slate-800">{c.value}</p>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
