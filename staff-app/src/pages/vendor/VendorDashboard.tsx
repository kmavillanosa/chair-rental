import React, { useState, useEffect, useMemo } from 'react';
import VendorLayout from '../../components/layout/VendorLayout';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { Vendor, Booking, VendorPayment } from '../../types';
import { getMyVendor } from '../../api/vendors';
import { getVendorBookings } from '../../api/bookings';
import { getMyPayments } from '../../api/payments';
import { getInventoryBreakdown } from '../../api/items';

export default function VendorDashboard() {
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payments, setPayments] = useState<VendorPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [breakdown, setBreakdown] = useState<any[]>([]);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const customerAppUrl = (import.meta.env.VITE_CUSTOMER_APP_URL || 'http://127.0.0.1:43171').replace(/\/$/, '');
  const publicShopUrl = `${customerAppUrl}/shop/${vendor?.slug || ''}`;

  useEffect(() => {
    Promise.all([getMyVendor(), getVendorBookings(), getMyPayments()])
      .then(([v, b, p]) => { setVendor(v); setBookings(b); setPayments(p); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (vendor) {
      setBreakdownLoading(true);
      getInventoryBreakdown(vendor.id)
        .then(setBreakdown)
        .finally(() => setBreakdownLoading(false));
    }
  }, [vendor]);

  const ITEM_PALETTE = [
    { bg: 'bg-rose-400', pill: 'bg-rose-100 text-rose-700 border-rose-300' },
    { bg: 'bg-amber-400', pill: 'bg-amber-100 text-amber-700 border-amber-300' },
    { bg: 'bg-sky-400', pill: 'bg-sky-100 text-sky-700 border-sky-300' },
    { bg: 'bg-emerald-400', pill: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
    { bg: 'bg-violet-400', pill: 'bg-violet-100 text-violet-700 border-violet-300' },
    { bg: 'bg-pink-400', pill: 'bg-pink-100 text-pink-700 border-pink-300' },
    { bg: 'bg-teal-400', pill: 'bg-teal-100 text-teal-700 border-teal-300' },
    { bg: 'bg-orange-400', pill: 'bg-orange-100 text-orange-700 border-orange-300' },
  ];

  const colorMap = useMemo(() => {
    const map: Record<string, typeof ITEM_PALETTE[number]> = {};
    breakdown.forEach((item, index) => {
      map[item.id] = ITEM_PALETTE[index % ITEM_PALETTE.length];
    });
    return map;
  }, [breakdown]);

  if (loading) return <VendorLayout><LoadingSpinner /></VendorLayout>;

  const overduePayments = payments.filter(p => p.status === 'overdue');
  const todayBookings = bookings.filter(b => {
    const today = new Date().toISOString().split('T')[0];
    return b.startDate <= today && b.endDate >= today && b.status === 'confirmed';
  });

  function BreakdownArmy() {
    if (breakdownLoading) return <LoadingSpinner size="md" />;
    if (!breakdown.length) return <div className="text-slate-400 py-8 text-center">No breakdown data.</div>;
    return (
      <section className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-900 to-slate-800 p-5 sm:p-6 text-white">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-200 tabular-nums">
            {breakdown.reduce((sum, row) => sum + row.total, 0)} total units
          </span>
        </div>
        <p className="mt-2 text-xs text-slate-300">
          Color = available, Grey = reserved. Each block is one unit.
        </p>
        <div className="mt-5 space-y-4">
          {breakdown.map((row, idx) => {
            const color = colorMap[row.id] ?? ITEM_PALETTE[idx % ITEM_PALETTE.length];
            return (
              <div key={row.id} className="rounded-xl border border-white/10 bg-black/15 p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-2">
                    <span className={`h-3 w-3 rounded-sm ${color.bg}`} />
                    <span className="text-sm font-medium text-slate-100">
                      {row.itemType?.name}
                      {row.color ? <span className="text-slate-300"> - {row.color}</span> : null}
                    </span>
                  </div>
                  <span className="text-xs text-slate-300 tabular-nums">
                    {row.total} unit{row.total !== 1 ? 's' : ''} ({row.available} available, {row.reserved} reserved)
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {Array.from({ length: row.available }).map((_, i) => (
                    <div key={`a-${i}`} className={`h-4 w-4 rounded-sm ${color.bg} border border-white/10`} title="Available" />
                  ))}
                  {Array.from({ length: row.reserved }).map((_, i) => (
                    <div key={`r-${i}`} className="h-4 w-4 rounded-sm bg-gray-400 border border-white/10 opacity-60" title="Reserved" />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <VendorLayout>
      {vendor?.warningCount && vendor.warningCount > 0 && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-lg text-xl">
          ⚠️ You have {vendor.warningCount} warning(s). At 3 warnings, your account will be suspended for 7 days.
        </div>
      )}
      {overduePayments.length > 0 && (
        <div className="bg-orange-100 border-l-4 border-orange-500 text-orange-700 p-4 mb-6 rounded-lg text-xl">
          💰 You have {overduePayments.length} overdue payment(s). Please pay to continue accepting bookings.
        </div>
      )}
      <h1 className="text-4xl font-bold text-gray-900 mb-6">👋 Welcome, {vendor?.businessName}</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-blue-100 rounded-2xl p-6">
          <p className="text-lg">📅 Today's Active Bookings</p>
          <p className="text-5xl font-bold text-blue-800 mt-2">{todayBookings.length}</p>
        </div>
        <div className="bg-green-100 rounded-2xl p-6">
          <p className="text-lg">📋 Total Bookings</p>
          <p className="text-5xl font-bold text-green-800 mt-2">{bookings.length}</p>
        </div>
        <div className="bg-yellow-100 rounded-2xl p-6">
          <p className="text-lg">⚠️ Warnings</p>
          <p className="text-5xl font-bold text-yellow-800 mt-2">{vendor?.warningCount || 0}/3</p>
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow p-6 mb-8">
        <h2 className="text-2xl font-bold mb-4">🏪 Shop: /shop/{vendor?.slug}</h2>
        <p className="text-gray-600 text-lg">{vendor?.address}</p>
        <a href={publicShopUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-lg hover:underline mt-2 inline-block">View Public Page →</a>
      </div>

      {/* Equipment Breakdown Section */}
      <div className="bg-white rounded-2xl shadow p-6">
        <h2 className="text-xl font-semibold text-slate-700 mb-4">Equipment Breakdown</h2>
        <BreakdownArmy />
      </div>
    </VendorLayout>
  );
}
