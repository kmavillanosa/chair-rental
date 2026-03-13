import { useEffect, useState } from 'react';
import { Button } from 'flowbite-react';
import toast from 'react-hot-toast';
import CustomerLayout from '../../components/layout/CustomerLayout';
import { getMyBookings, updateBookingStatus } from '../../api/bookings';
import type { Booking } from '../../types';
import { BookingStatusBadge } from '../../components/common/StatusBadge';
import { formatDate, formatCurrency } from '../../utils/format';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export default function MyBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const load = () => getMyBookings().then(setBookings).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const cancel = async (id: string) => {
    if (!window.confirm('Cancel this booking?')) return;
    await updateBookingStatus(id, 'cancelled');
    toast.success('Booking cancelled.');
    load();
  };

  if (loading) return <CustomerLayout><LoadingSpinner /></CustomerLayout>;

  return (
    <CustomerLayout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-6">📅 My Bookings</h1>
        {bookings.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-3xl text-gray-400">😔 No bookings yet.</p>
            <p className="text-xl text-gray-400 mt-2">Find a vendor and book equipment!</p>
            <Button size="xl" className="mt-6" onClick={() => window.location.href = '/'}>🔍 Find Vendors</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map(b => (
              <div key={b.id} className="bg-white rounded-2xl shadow p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-2xl font-bold">{b.vendor?.businessName}</h3>
                    <p className="text-gray-500 text-lg">📅 {formatDate(b.startDate)} – {formatDate(b.endDate)}</p>
                    {b.deliveryAddress && <p className="text-gray-500 text-lg">📍 {b.deliveryAddress}</p>}
                  </div>
                  <BookingStatusBadge status={b.status} />
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-2xl font-bold text-blue-600">{formatCurrency(b.totalAmount)}</p>
                  {b.status === 'pending' && (
                    <Button color="failure" size="lg" onClick={() => cancel(b.id)}>❌ Cancel</Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </CustomerLayout>
  );
}
