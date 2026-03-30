import { useEffect, useState } from 'react';
import { Button } from 'flowbite-react';
import toast from 'react-hot-toast';
import CustomerLayout from '../../components/layout/CustomerLayout';
import { getMyBookings, updateBookingStatus } from '../../api/bookings';
import type { Booking } from '../../types';
import { BookingStatusBadge } from '../../components/common/StatusBadge';
import { formatDate, formatCurrency } from '../../utils/format';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { HiCalendar, HiLocationMarker, HiSearch, HiX } from 'react-icons/hi';

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
        <h1 className="mb-6 flex items-center gap-3 text-4xl font-bold text-gray-900">
          <HiCalendar className="h-9 w-9 text-blue-600" />
          <span>My Bookings</span>
        </h1>
        {bookings.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-3xl text-gray-400">No bookings yet.</p>
            <p className="text-xl text-gray-400 mt-2">Find a rental partner and book equipment!</p>
            <Button size="xl" className="mt-6" onClick={() => window.location.href = '/'}>
              <span className="inline-flex items-center gap-2">
                <HiSearch className="h-5 w-5" />
                Find Rental Partners
              </span>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map(b => (
              <div key={b.id} className="bg-white rounded-2xl shadow p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-2xl font-bold">{b.vendor?.businessName}</h3>
                    <p className="mt-1 inline-flex items-center gap-2 text-lg text-gray-500">
                      <HiCalendar className="h-5 w-5" />
                      {formatDate(b.startDate)} - {formatDate(b.endDate)}
                    </p>
                    {b.deliveryAddress && (
                      <p className="mt-1 inline-flex items-center gap-2 text-lg text-gray-500">
                        <HiLocationMarker className="h-5 w-5" />
                        {b.deliveryAddress}
                      </p>
                    )}
                  </div>
                  <BookingStatusBadge status={b.status} />
                </div>
                {Array.isArray(b.items) && b.items.length > 0 && (
                  <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm font-semibold text-slate-700">Items Booked</p>
                    <div className="mt-2 space-y-1">
                      {b.items.map((item) => {
                        const itemLabel =
                          item.inventoryItem?.itemType?.name ||
                          item.inventoryItem?.brand?.name ||
                          'N/A';
                        return (
                          <div key={item.id} className="flex items-center justify-between text-sm text-slate-700">
                            <span>{itemLabel} x {item.quantity}</span>
                            <span>{formatCurrency(Number(item.subtotal || 0))}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <p className="text-2xl font-bold text-blue-600">{formatCurrency(b.totalAmount)}</p>
                  {b.status === 'pending' && (
                    <Button color="failure" size="lg" onClick={() => cancel(b.id)}>
                      <span className="inline-flex items-center gap-2">
                        <HiX className="h-5 w-5" />
                        Cancel
                      </span>
                    </Button>
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
