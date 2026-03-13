import { useEffect, useState } from 'react';
import { Button, Table } from 'flowbite-react';
import toast from 'react-hot-toast';
import VendorLayout from '../../components/layout/VendorLayout';
import { getVendorBookings, updateBookingStatus } from '../../api/bookings';
import type { Booking } from '../../types';
import { BookingStatusBadge } from '../../components/common/StatusBadge';
import { formatDate, formatCurrency } from '../../utils/format';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useTranslation } from 'react-i18next';

export default function VendorBookings() {
  const { t } = useTranslation();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const load = () => getVendorBookings().then(setBookings).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const confirm = async (id: string) => {
    await updateBookingStatus(id, 'confirmed');
    toast.success(t('vendorBookings.toastConfirmed'));
    load();
  };
  const cancel = async (id: string) => {
    await updateBookingStatus(id, 'cancelled');
    toast.success(t('vendorBookings.toastCancelled'));
    load();
  };
  const complete = async (id: string) => {
    await updateBookingStatus(id, 'completed');
    toast.success(t('vendorBookings.toastCompleted'));
    load();
  };

  if (loading) return <VendorLayout><LoadingSpinner /></VendorLayout>;

  return (
    <VendorLayout>
      <h1 className="text-4xl font-bold text-gray-900 mb-6">📅 {t('vendorBookings.title')}</h1>
      <div className="overflow-x-auto rounded-xl shadow">
        <Table striped>
          <Table.Head>
            <Table.HeadCell className="text-lg">{t('common.customer')}</Table.HeadCell>
            <Table.HeadCell className="text-lg">{t('common.dates')}</Table.HeadCell>
            <Table.HeadCell className="text-lg">{t('common.items')}</Table.HeadCell>
            <Table.HeadCell className="text-lg">{t('common.amount')}</Table.HeadCell>
            <Table.HeadCell className="text-lg">{t('common.status')}</Table.HeadCell>
            <Table.HeadCell className="text-lg">{t('common.actions')}</Table.HeadCell>
          </Table.Head>
          <Table.Body>
            {bookings.map(b => (
              <Table.Row key={b.id} className="text-lg">
                <Table.Cell>{b.customer?.name}</Table.Cell>
                <Table.Cell>{formatDate(b.startDate)} – {formatDate(b.endDate)}</Table.Cell>
                <Table.Cell>{t('vendorBookings.itemsCount', { count: b.items?.length || 0 })}</Table.Cell>
                <Table.Cell className="font-semibold">{formatCurrency(b.totalAmount)}</Table.Cell>
                <Table.Cell><BookingStatusBadge status={b.status} /></Table.Cell>
                <Table.Cell>
                  <div className="flex gap-2">
                    {b.status === 'pending' && (
                      <>
                        <Button size="sm" color="success" onClick={() => confirm(b.id)}>✅ {t('vendorBookings.confirm')}</Button>
                        <Button size="sm" color="failure" onClick={() => cancel(b.id)}>❌ {t('vendorBookings.cancel')}</Button>
                      </>
                    )}
                    {b.status === 'confirmed' && (
                      <Button size="sm" color="indigo" onClick={() => complete(b.id)}>🎉 {t('vendorBookings.complete')}</Button>
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
