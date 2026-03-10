import { useEffect, useState } from 'react';
import { Button, Table } from 'flowbite-react';
import toast from 'react-hot-toast';
import VendorLayout from '../../components/layout/VendorLayout';
import { getVendorBookings, updateBookingStatus } from '../../api/bookings';
import type { Booking } from '../../types';
import { BookingStatusBadge } from '../../components/common/StatusBadge';
import { formatDate, formatCurrency } from '../../utils/format';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export default function VendorBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const load = () => getVendorBookings().then(setBookings).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const confirm = async (id: string) => {
    await updateBookingStatus(id, 'confirmed');
    toast.success('Booking confirmed! ✅');
    load();
  };
  const cancel = async (id: string) => {
    await updateBookingStatus(id, 'cancelled');
    toast.success('Booking cancelled.');
    load();
  };
  const complete = async (id: string) => {
    await updateBookingStatus(id, 'completed');
    toast.success('Booking completed! 🎉');
    load();
  };

  if (loading) return <VendorLayout><LoadingSpinner /></VendorLayout>;

  return (
    <VendorLayout>
      <h1 className="text-4xl font-bold text-gray-900 mb-6">📅 My Bookings</h1>
      <div className="overflow-x-auto rounded-xl shadow">
        <Table striped>
          <Table.Head>
            <Table.HeadCell className="text-lg">Customer</Table.HeadCell>
            <Table.HeadCell className="text-lg">Dates</Table.HeadCell>
            <Table.HeadCell className="text-lg">Items</Table.HeadCell>
            <Table.HeadCell className="text-lg">Amount</Table.HeadCell>
            <Table.HeadCell className="text-lg">Status</Table.HeadCell>
            <Table.HeadCell className="text-lg">Actions</Table.HeadCell>
          </Table.Head>
          <Table.Body>
            {bookings.map(b => (
              <Table.Row key={b.id} className="text-lg">
                <Table.Cell>{b.customer?.name}</Table.Cell>
                <Table.Cell>{formatDate(b.startDate)} – {formatDate(b.endDate)}</Table.Cell>
                <Table.Cell>{b.items?.length || 0} items</Table.Cell>
                <Table.Cell className="font-semibold">{formatCurrency(b.totalAmount)}</Table.Cell>
                <Table.Cell><BookingStatusBadge status={b.status} /></Table.Cell>
                <Table.Cell>
                  <div className="flex gap-2">
                    {b.status === 'pending' && (
                      <>
                        <Button size="sm" color="success" onClick={() => confirm(b.id)}>✅ Confirm</Button>
                        <Button size="sm" color="failure" onClick={() => cancel(b.id)}>❌ Cancel</Button>
                      </>
                    )}
                    {b.status === 'confirmed' && (
                      <Button size="sm" color="indigo" onClick={() => complete(b.id)}>🎉 Complete</Button>
                    )}
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </div>
    </VendorLayout>
  );
}
