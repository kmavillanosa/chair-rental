import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from 'flowbite-react';
import toast from 'react-hot-toast';
import CustomerLayout from '../../components/layout/CustomerLayout';
import {
    confirmBookingDelivery,
    createBookingRemainingBalanceCheckout,
    createBookingPaymentCheckout,
    getMyBookings,
    verifyBookingPayment,
} from '../../api/bookings';
import type { Booking } from '../../types';
import { BookingStatusBadge } from '../../components/common/StatusBadge';
import { formatDate, formatCurrency } from '../../utils/format';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useTranslation } from 'react-i18next';

export default function MyBookings() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [redirectingBookingId, setRedirectingBookingId] = useState<string | null>(null);
    const [actionBookingId, setActionBookingId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [loading, setLoading] = useState(true);

    const load = () => getMyBookings().then(setBookings).finally(() => setLoading(false));

    const filteredBookings = useMemo(
        () =>
            bookings.filter((booking) => {
                if (searchQuery) {
                    const query = searchQuery.toLowerCase();
                    const vendorName = (booking.vendor?.businessName || '').toLowerCase();
                    const address = (booking.deliveryAddress || '').toLowerCase();
                    if (!vendorName.includes(query) && !address.includes(query)) return false;
                }

                if (statusFilter && booking.status !== statusFilter) return false;
                if (dateFrom && booking.endDate < dateFrom) return false;
                if (dateTo && booking.startDate > dateTo) return false;
                return true;
            }),
        [bookings, searchQuery, statusFilter, dateFrom, dateTo],
    );

    useEffect(() => {
        load();
    }, []);

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

    const continueRemainingBalancePayment = async (booking: Booking) => {
        if (booking.paymentCheckoutUrl && booking.paymentStatus === 'checkout_pending') {
            setRedirectingBookingId(booking.id);
            window.location.href = booking.paymentCheckoutUrl;
            return;
        }

        setRedirectingBookingId(booking.id);
        try {
            const refreshed = await createBookingRemainingBalanceCheckout(booking.id);
            if (!refreshed.paymentCheckoutUrl) {
                throw new Error('Missing checkout URL');
            }

            window.location.href = refreshed.paymentCheckoutUrl;
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to start remaining balance checkout.');
            setRedirectingBookingId(null);
        }
    };

    const confirmDelivered = async (booking: Booking) => {
        setActionBookingId(booking.id);
        try {
            await confirmBookingDelivery(booking.id);
            toast.success('Delivery confirmed. Payment release is now queued.');
            load();
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to confirm delivery.');
        } finally {
            setActionBookingId(null);
        }
    };

    const getBookingActionState = (booking: Booking) => {
        const normalizedPaymentProvider = (booking.paymentProvider || '').toLowerCase();
        const canContinuePayment =
            booking.status === 'pending' &&
            normalizedPaymentProvider === 'paymongo' &&
            ['pending', 'unpaid', 'checkout_pending'].includes(booking.paymentStatus);

        const canPayRemainingBalance =
            normalizedPaymentProvider === 'paymongo' &&
            !['cancelled', 'completed'].includes(booking.status) &&
            Number(booking.totalPaidAmount || 0) > 0 &&
            Number(booking.remainingBalanceAmount || 0) > 0;

        const canConfirmDelivery =
            ['confirmed', 'completed'].includes(booking.status) &&
            !booking.customerConfirmedDeliveryAt;

        return {
            canContinuePayment,
            canPayRemainingBalance,
            canConfirmDelivery,
        };
    };

    const getOutstandingNow = (booking: Booking) => {
        const totalAmount = Number(booking.totalAmount || 0);
        const totalPaidAmount = Number(booking.totalPaidAmount || 0);
        return Math.max(0, totalAmount - totalPaidAmount);
    };

    if (loading) {
        return (
            <CustomerLayout>
                <LoadingSpinner />
            </CustomerLayout>
        );
    }

    return (
        <CustomerLayout>
            <div className="mx-auto max-w-4xl px-4 py-6">
                <h1 className="mb-3 text-xl font-semibold text-slate-800">{t('myBookingsPage.title')}</h1>
                {bookings.length === 0 ? (
                    <div className="py-14 text-center">
                        <p className="text-base text-slate-500">{t('myBookingsPage.noBookings')}</p>
                        <p className="mt-1 text-sm text-slate-400">{t('myBookingsPage.findAndBook')}</p>
                        <Button
                            size="sm"
                            className="mt-4"
                            onClick={() => {
                                window.location.href = '/';
                            }}
                        >
                            {t('myBookingsPage.findVendors')}
                        </Button>
                    </div>
                ) : (
                    <>
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                            <input
                                type="text"
                                placeholder="Search vendor or address"
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
                            />
                            <select
                                value={statusFilter}
                                onChange={(event) => setStatusFilter(event.target.value)}
                                className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
                            >
                                <option value="">All statuses</option>
                                <option value="pending">Pending</option>
                                <option value="confirmed">Confirmed</option>
                                <option value="completed">Completed</option>
                                <option value="cancelled">Cancelled</option>
                            </select>
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(event) => setDateFrom(event.target.value)}
                                title="From date"
                                className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
                            />
                            <span className="text-sm text-slate-400">to</span>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(event) => setDateTo(event.target.value)}
                                title="To date"
                                className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
                            />
                            {(searchQuery || statusFilter || dateFrom || dateTo) && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchQuery('');
                                        setStatusFilter('');
                                        setDateFrom('');
                                        setDateTo('');
                                    }}
                                    className="text-sm text-slate-500 underline hover:text-slate-700"
                                >
                                    Clear
                                </button>
                            )}
                            <span className="ml-auto text-xs text-slate-400">
                                {filteredBookings.length} of {bookings.length}
                            </span>
                        </div>

                        <div className="space-y-3">
                            {filteredBookings.map((booking) => {
                                const { canContinuePayment, canPayRemainingBalance, canConfirmDelivery } =
                                    getBookingActionState(booking);

                                return (
                                    <div key={booking.id} className="rounded border border-slate-200 bg-white p-4 shadow-sm">
                                        <div className="mb-3 flex items-start justify-between gap-3">
                                            <div>
                                                <h3 className="text-base font-semibold text-slate-800">
                                                    {booking.vendor?.businessName}
                                                </h3>
                                                <p className="text-xs text-slate-500">
                                                    {formatDate(booking.startDate)} - {formatDate(booking.endDate)}
                                                </p>
                                                {booking.deliveryAddress && (
                                                    <p className="text-xs text-slate-500">{booking.deliveryAddress}</p>
                                                )}
                                                {booking.paymentStatus === 'checkout_pending' && (
                                                    <p className="mt-1 text-xs font-semibold text-amber-700">
                                                        {t('myBookingsPage.paymentPending')}
                                                    </p>
                                                )}
                                            </div>
                                            <BookingStatusBadge status={booking.status} />
                                        </div>

                                        {booking.status === 'cancelled' && (
                                            <div className="mb-3 rounded border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-900">
                                                <p className="font-semibold">
                                                    {t('myBookingsPage.cancelledRefundSummary', {
                                                        amount: formatCurrency(Number(booking.cancellationRefundAmount || 0)),
                                                        percent: Number(booking.cancellationRefundPercent || 0),
                                                    })}
                                                </p>
                                            </div>
                                        )}

                                        {Array.isArray(booking.items) && booking.items.length > 0 && (
                                            <div className="mb-3 rounded border border-slate-200 bg-slate-50 p-2.5">
                                                <p className="text-xs font-semibold text-slate-700">
                                                    {t('myBookingsPage.itemsBooked')}
                                                </p>
                                                <div className="mt-1.5 space-y-1">
                                                    {booking.items.map((item) => {
                                                        const itemLabel =
                                                            item.inventoryItem?.itemType?.name ||
                                                            item.inventoryItem?.brand?.name ||
                                                            t('common.na');
                                                        return (
                                                            <div
                                                                key={item.id}
                                                                className="flex items-center justify-between text-xs text-slate-700"
                                                            >
                                                                <span>
                                                                    {itemLabel} x {item.quantity}
                                                                </span>
                                                                <span>{formatCurrency(Number(item.subtotal || 0))}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        <div className="mb-3 rounded border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-700">
                                            <p>
                                                Paid to date:{' '}
                                                <span className="font-semibold">
                                                    {formatCurrency(Number(booking.totalPaidAmount || 0))}
                                                </span>
                                            </p>
                                            {booking.depositAmount ? (
                                                <p>
                                                    Deposit required:{' '}
                                                    <span className="font-semibold">
                                                        {formatCurrency(Number(booking.depositAmount || 0))}
                                                    </span>
                                                </p>
                                            ) : null}
                                            <p>
                                                Remaining after deposit:{' '}
                                                <span className="font-semibold">
                                                    {formatCurrency(Number(booking.remainingBalanceAmount || 0))}
                                                </span>
                                            </p>
                                            <p>
                                                Outstanding now:{' '}
                                                <span className="font-semibold">{formatCurrency(getOutstandingNow(booking))}</span>
                                            </p>
                                        </div>

                                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3">
                                            <p className="text-base font-semibold text-slate-800">
                                                {formatCurrency(booking.totalAmount)}
                                            </p>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <button
                                                    type="button"
                                                    className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                                                    onClick={() => navigate(`/my-bookings/${booking.id}`)}
                                                >
                                                    View
                                                </button>
                                                {canContinuePayment && (
                                                    <button
                                                        type="button"
                                                        className="rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                                                        onClick={() => continuePayment(booking)}
                                                        disabled={redirectingBookingId === booking.id}
                                                    >
                                                        {redirectingBookingId === booking.id
                                                            ? 'Processing...'
                                                            : t('myBookingsPage.payNow')}
                                                    </button>
                                                )}
                                                {canPayRemainingBalance && (
                                                    <button
                                                        type="button"
                                                        className="rounded border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                                                        onClick={() => continueRemainingBalancePayment(booking)}
                                                        disabled={redirectingBookingId === booking.id}
                                                    >
                                                        {redirectingBookingId === booking.id ? 'Processing...' : 'Pay remaining'}
                                                    </button>
                                                )}
                                                {canConfirmDelivery && (
                                                    <button
                                                        type="button"
                                                        className="rounded border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                                                        onClick={() => confirmDelivered(booking)}
                                                        disabled={actionBookingId === booking.id}
                                                    >
                                                        {actionBookingId === booking.id ? 'Processing...' : 'Confirm delivery'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            {filteredBookings.length === 0 && (
                                <div className="rounded border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                                    No bookings match your filters.
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </CustomerLayout>
    );
}
