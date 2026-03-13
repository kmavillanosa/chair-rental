import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from 'flowbite-react';
import toast from 'react-hot-toast';
import CustomerLayout from '../../components/layout/CustomerLayout';
import {
  createBookingPaymentCheckout,
  getBookingCancellationPreview,
  getMyBookings,
  updateBookingStatus,
  verifyBookingPayment,
} from '../../api/bookings';
import type { Booking } from '../../types';
import { BookingStatusBadge } from '../../components/common/StatusBadge';
import { formatDate, formatCurrency } from '../../utils/format';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useTranslation } from 'react-i18next';

export default function MyBookings() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [redirectingBookingId, setRedirectingBookingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = () => getMyBookings().then(setBookings).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  useEffect(() => {
    const paymentState = searchParams.get('payment');
    const bookingId = searchParams.get('bookingId');
    if (!paymentState) return;

    const clearParams = () => {
      const next = new URLSearchParams(searchParams);
      next.delete('payment');
      next.delete('bookingId');
      setSearchParams(next, { replace: true });
    };

    if (paymentState === 'success' && bookingId) {
      verifyBookingPayment(bookingId)
        .then(() => {
          toast.success(t('myBookingsPage.toastPaymentVerified'));
          load();
        })
        .catch((error: any) => {
          toast.error(error?.response?.data?.message || t('myBookingsPage.toastPaymentVerifyFailed'));
        })
        .finally(clearParams);
      return;
    }

    if (paymentState === 'cancel') {
      toast.error(t('myBookingsPage.toastPaymentCancelled'));
    }

    clearParams();
  }, [searchParams, setSearchParams, t]);

  const getCancellationPolicyLabel = (policyCode?: string) => {
    switch (policyCode) {
      case 'full_refund_3_days':
        return t('myBookingsPage.policyFullRefund');
      case 'half_refund_24_hours':
        return t('myBookingsPage.policyHalfRefund');
      case 'same_day_no_refund':
        return t('myBookingsPage.policyNoRefund');
      case 'vendor_or_admin_full_refund':
        return t('myBookingsPage.policyVendorOrAdmin');
      default:
        return t('common.na');
    }
  };

  const cancel = async (booking: Booking) => {
    try {
      const preview = await getBookingCancellationPreview(booking.id);
      const policyLabel = getCancellationPolicyLabel(preview.policyCode);

      const confirmMessage = [
        t('myBookingsPage.cancelConfirm'),
        '',
        `${t('myBookingsPage.cancelPolicy')}: ${policyLabel}`,
        t('myBookingsPage.cancelRefundLine', {
          percent: preview.refundPercent,
          amount: formatCurrency(preview.refundAmount),
        }),
        preview.isSameDayBooking
          ? t('myBookingsPage.sameDayPolicyNote')
          : t('myBookingsPage.daysBeforeEventLine', {
            days: preview.daysBeforeStartDate,
          }),
      ].join('\n');

      if (!window.confirm(confirmMessage)) return;

      const updated = await updateBookingStatus(booking.id, 'cancelled');
      const refundAmount = Number(
        updated.cancellationRefundAmount ?? preview.refundAmount ?? 0,
      );

      toast.success(
        t('myBookingsPage.toastCancelledWithRefund', {
          amount: formatCurrency(refundAmount),
        }),
      );
      load();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t('myBookingsPage.toastCancelFailed'));
    }
  };

  const continuePayment = async (booking: Booking) => {
    if (booking.paymentCheckoutUrl) {
      setRedirectingBookingId(booking.id);
      window.location.href = booking.paymentCheckoutUrl;
      return;
    }

    setRedirectingBookingId(booking.id);
    try {
      const refreshed = await createBookingPaymentCheckout(booking.id);
      if (!refreshed.paymentCheckoutUrl) {
        throw new Error('Missing checkout URL');
      }

      window.location.href = refreshed.paymentCheckoutUrl;
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t('myBookingsPage.toastPaymentCheckoutFailed'));
      setRedirectingBookingId(null);
    }
  };

  if (loading) return <CustomerLayout><LoadingSpinner /></CustomerLayout>;

  return (
    <CustomerLayout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-6">📅 {t('myBookingsPage.title')}</h1>
        {bookings.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-3xl text-gray-400">😔 {t('myBookingsPage.noBookings')}</p>
            <p className="text-xl text-gray-400 mt-2">{t('myBookingsPage.findAndBook')}</p>
            <Button size="xl" className="mt-6" onClick={() => window.location.href = '/'}>🔍 {t('myBookingsPage.findVendors')}</Button>
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
                    {b.paymentStatus === 'checkout_pending' && (
                      <p className="mt-1 text-sm font-semibold text-amber-700">
                        {t('myBookingsPage.paymentPending')}
                      </p>
                    )}
                  </div>
                  <BookingStatusBadge status={b.status} />
                </div>
                {b.status === 'cancelled' && (
                  <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
                    <p className="font-semibold">
                      {t('myBookingsPage.cancelledRefundSummary', {
                        amount: formatCurrency(Number(b.cancellationRefundAmount || 0)),
                        percent: Number(b.cancellationRefundPercent || 0),
                      })}
                    </p>
                    {b.cancellationPolicyCode && (
                      <p className="mt-1 text-rose-800">
                        {t('myBookingsPage.cancelPolicy')}: {getCancellationPolicyLabel(b.cancellationPolicyCode)}
                      </p>
                    )}
                  </div>
                )}
                {Array.isArray(b.items) && b.items.length > 0 && (
                  <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm font-semibold text-slate-700">{t('myBookingsPage.itemsBooked')}</p>
                    <div className="mt-2 space-y-1">
                      {b.items.map((item) => {
                        const itemLabel =
                          item.inventoryItem?.itemType?.name ||
                          item.inventoryItem?.brand?.name ||
                          t('common.na');
                        return (
                          <div key={item.id} className="flex items-center justify-between text-sm text-slate-700">
                            <span>{itemLabel} × {item.quantity}</span>
                            <span>{formatCurrency(Number(item.subtotal || 0))}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <p className="text-2xl font-bold text-blue-600">{formatCurrency(b.totalAmount)}</p>
                  <div className="flex items-center gap-2">
                    {b.status === 'pending' && b.paymentStatus === 'checkout_pending' && (
                      <Button
                        color="warning"
                        size="lg"
                        onClick={() => continuePayment(b)}
                        disabled={redirectingBookingId === b.id}
                        isProcessing={redirectingBookingId === b.id}
                      >
                        💳 {t('myBookingsPage.payNow')}
                      </Button>
                    )}
                    {b.status === 'pending' && (
                      <Button color="failure" size="lg" onClick={() => cancel(b)}>❌ {t('myBookingsPage.cancel')}</Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </CustomerLayout>
  );
}
