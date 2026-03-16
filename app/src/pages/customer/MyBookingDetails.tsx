import { useEffect, useState } from 'react';
import { Button } from 'flowbite-react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import CustomerLayout from '../../components/layout/CustomerLayout';
import {
    confirmBookingDelivery,
    createBookingRemainingBalanceCheckout,
    createBookingPaymentCheckout,
    downloadBookingDocument,
    generateBookingDocuments,
    getBookingCancellationPreview,
    getBookingDocuments,
    getBookingDisputes,
    getMyBookings,
    openBookingDispute,
    submitBookingReview,
    updateBookingStatus,
} from '../../api/bookings';
import type { Booking, BookingDocument } from '../../types';
import { BookingStatusBadge } from '../../components/common/StatusBadge';
import { formatDate, formatCurrency } from '../../utils/format';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useTranslation } from 'react-i18next';
import BookingChatWidget from '../../components/chat/BookingChatWidget';

export default function MyBookingDetails() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { bookingId } = useParams<{ bookingId: string }>();
    const [booking, setBooking] = useState<Booking | null>(null);
    const [loading, setLoading] = useState(true);
    const [redirectingBookingId, setRedirectingBookingId] = useState<string | null>(null);
    const [actionBookingId, setActionBookingId] = useState<string | null>(null);

    const loadBooking = async () => {
        if (!bookingId) {
            setBooking(null);
            return;
        }

        const myBookings = await getMyBookings();
        setBooking(myBookings.find((item) => item.id === bookingId) || null);
    };

    useEffect(() => {
        setLoading(true);
        loadBooking()
            .catch((error: any) => {
                toast.error(error?.response?.data?.message || 'Failed to load booking details.');
            })
            .finally(() => setLoading(false));
    }, [bookingId]);

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

    const cancel = async (currentBooking: Booking) => {
        try {
            const preview = await getBookingCancellationPreview(currentBooking.id);
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

            const updated = await updateBookingStatus(currentBooking.id, 'cancelled');
            const refundAmount = Number(updated.cancellationRefundAmount ?? preview.refundAmount ?? 0);

            toast.success(
                t('myBookingsPage.toastCancelledWithRefund', {
                    amount: formatCurrency(refundAmount),
                }),
            );
            await loadBooking();
        } catch (error: any) {
            toast.error(error?.response?.data?.message || t('myBookingsPage.toastCancelFailed'));
        }
    };

    const continuePayment = async (currentBooking: Booking) => {
        if (currentBooking.paymentCheckoutUrl) {
            setRedirectingBookingId(currentBooking.id);
            window.location.href = currentBooking.paymentCheckoutUrl;
            return;
        }

        setRedirectingBookingId(currentBooking.id);
        try {
            const refreshed = await createBookingPaymentCheckout(currentBooking.id);
            if (!refreshed.paymentCheckoutUrl) {
                throw new Error('Missing checkout URL');
            }

            window.location.href = refreshed.paymentCheckoutUrl;
        } catch (error: any) {
            toast.error(error?.response?.data?.message || t('myBookingsPage.toastPaymentCheckoutFailed'));
            setRedirectingBookingId(null);
        }
    };

    const continueRemainingBalancePayment = async (currentBooking: Booking) => {
        if (
            currentBooking.paymentCheckoutUrl &&
            currentBooking.paymentStatus === 'checkout_pending'
        ) {
            setRedirectingBookingId(currentBooking.id);
            window.location.href = currentBooking.paymentCheckoutUrl;
            return;
        }

        setRedirectingBookingId(currentBooking.id);
        try {
            const refreshed = await createBookingRemainingBalanceCheckout(currentBooking.id);
            if (!refreshed.paymentCheckoutUrl) {
                throw new Error('Missing checkout URL');
            }

            window.location.href = refreshed.paymentCheckoutUrl;
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to start remaining balance checkout.');
            setRedirectingBookingId(null);
        }
    };

    const confirmDelivered = async (currentBooking: Booking) => {
        setActionBookingId(currentBooking.id);
        try {
            await confirmBookingDelivery(currentBooking.id);
            toast.success('Delivery confirmed. Payment release is now queued.');
            await loadBooking();
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to confirm delivery.');
        } finally {
            setActionBookingId(null);
        }
    };

    const rateVendor = async (currentBooking: Booking) => {
        const ratingInput = window.prompt('Rate this vendor from 1 to 5:');
        if (!ratingInput) return;

        const rating = Math.round(Number(ratingInput));
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            toast.error('Rating must be an integer between 1 and 5.');
            return;
        }

        const comment = window.prompt('Optional review comment:') || undefined;

        setActionBookingId(currentBooking.id);
        try {
            await submitBookingReview(currentBooking.id, rating, comment);
            toast.success('Review submitted.');
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to submit review.');
        } finally {
            setActionBookingId(null);
        }
    };

    const openDisputeForBooking = async (currentBooking: Booking) => {
        setActionBookingId(currentBooking.id);
        try {
            const existing = await getBookingDisputes(currentBooking.id);
            const hasOpen = existing.some((dispute) => ['open', 'under_review'].includes(dispute.status));
            if (hasOpen) {
                toast.error('There is already an active dispute for this booking.');
                return;
            }

            const reason = window.prompt('Describe your dispute:');
            if (!reason?.trim()) return;

            await openBookingDispute(currentBooking.id, reason.trim());
            toast.success('Dispute opened. Our team will review it.');
            await loadBooking();
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to open dispute.');
        } finally {
            setActionBookingId(null);
        }
    };

    const triggerPdfDownload = (blob: Blob, fileName: string) => {
        const objectUrl = window.URL.createObjectURL(blob);
        const anchor = window.document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = fileName;
        window.document.body.appendChild(anchor);
        anchor.click();
        window.document.body.removeChild(anchor);
        window.URL.revokeObjectURL(objectUrl);
    };

    const downloadSignedDocument = async (
        currentBooking: Booking,
        documentType: 'contract' | 'receipt',
    ) => {
        const findTargetDocument = (documents: BookingDocument[]) =>
            documents.find(
                (document) =>
                    document.documentType === documentType &&
                    ['customer', 'both'].includes(document.issuedTo),
            );

        setActionBookingId(currentBooking.id);
        try {
            let documents = await getBookingDocuments(currentBooking.id);
            let target = findTargetDocument(documents);

            if (!target) {
                documents = await generateBookingDocuments(currentBooking.id);
                target = findTargetDocument(documents);
            }

            if (!target) {
                throw new Error(`${documentType} PDF is not available for this booking yet.`);
            }

            const blob = await downloadBookingDocument(currentBooking.id, target.id);
            triggerPdfDownload(
                blob,
                target.fileName || `${documentType}-booking-${currentBooking.id}.pdf`,
            );
            toast.success(
                documentType === 'contract'
                    ? 'Signed booking contract downloaded.'
                    : 'Signed customer receipt downloaded.',
            );
        } catch (error: any) {
            toast.error(
                error?.response?.data?.message ||
                error?.message ||
                `Failed to download ${documentType} PDF.`,
            );
        } finally {
            setActionBookingId(null);
        }
    };

    const getBookingActionState = (currentBooking: Booking) => {
        const normalizedPaymentProvider = (currentBooking.paymentProvider || '').toLowerCase();
        const canContinuePayment =
            currentBooking.status === 'pending' &&
            normalizedPaymentProvider === 'paymongo' &&
            ['pending', 'unpaid', 'checkout_pending'].includes(currentBooking.paymentStatus);

        const canPayRemainingBalance =
            normalizedPaymentProvider === 'paymongo' &&
            !['cancelled', 'completed'].includes(currentBooking.status) &&
            Number(currentBooking.totalPaidAmount || 0) > 0 &&
            Number(currentBooking.remainingBalanceAmount || 0) > 0;

        const canConfirmDelivery =
            ['confirmed', 'completed'].includes(currentBooking.status) &&
            !currentBooking.customerConfirmedDeliveryAt;

        return {
            canContinuePayment,
            canPayRemainingBalance,
            canConfirmDelivery,
        };
    };

    const getOutstandingNow = (currentBooking: Booking) => {
        const totalAmount = Number(currentBooking.totalAmount || 0);
        const totalPaidAmount = Number(currentBooking.totalPaidAmount || 0);
        return Math.max(0, totalAmount - totalPaidAmount);
    };

    if (loading) {
        return (
            <CustomerLayout>
                <LoadingSpinner />
            </CustomerLayout>
        );
    }

    if (!booking) {
        return (
            <CustomerLayout>
                <div className="mx-auto max-w-3xl px-4 py-6">
                    <div className="rounded border border-slate-200 bg-white p-5 shadow-sm">
                        <h1 className="text-xl font-semibold text-slate-800">Booking details</h1>
                        <p className="mt-2 text-sm text-slate-500">Booking not found.</p>
                        <Button size="sm" className="mt-4" onClick={() => navigate('/my-bookings')}>
                            Back to my bookings
                        </Button>
                    </div>
                </div>
            </CustomerLayout>
        );
    }

    const actionState = getBookingActionState(booking);

    return (
        <CustomerLayout>
            <div className="mx-auto max-w-6xl px-4 py-6">
                <div className="mb-3 flex items-center justify-between gap-3">
                    <h1 className="text-xl font-semibold text-slate-800">Booking details</h1>
                    <button
                        type="button"
                        className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                        onClick={() => navigate('/my-bookings')}
                    >
                        Back
                    </button>
                </div>

                <BookingChatWidget
                    bookingId={booking.id}
                    userRole="customer"
                    defaultOpen
                    className="mb-4"
                />

                <div className="space-y-4">
                        <div className="rounded border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h3 className="text-base font-semibold text-slate-800">{booking.vendor?.businessName}</h3>
                                <p className="text-xs text-slate-500">
                                    {formatDate(booking.startDate)} - {formatDate(booking.endDate)}
                                </p>
                                {booking.deliveryAddress && (
                                    <p className="text-xs text-slate-500">{booking.deliveryAddress}</p>
                                )}
                            </div>
                            <BookingStatusBadge status={booking.status} />
                        </div>
                    </div>

                    {booking.status === 'cancelled' && (
                        <div className="rounded border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-900">
                            <p className="font-semibold">
                                {t('myBookingsPage.cancelledRefundSummary', {
                                    amount: formatCurrency(Number(booking.cancellationRefundAmount || 0)),
                                    percent: Number(booking.cancellationRefundPercent || 0),
                                })}
                            </p>
                            {booking.cancellationPolicyCode && (
                                <p className="mt-1 text-rose-800">
                                    {t('myBookingsPage.cancelPolicy')}: {getCancellationPolicyLabel(booking.cancellationPolicyCode)}
                                </p>
                            )}
                        </div>
                    )}

                    {Array.isArray(booking.items) && booking.items.length > 0 && (
                        <div className="rounded border border-slate-200 bg-white p-3 shadow-sm">
                            <h3 className="mb-2 text-sm font-semibold text-slate-700">Items</h3>
                            <div className="space-y-1.5">
                                {booking.items.map((item) => {
                                    const itemLabel =
                                        item.inventoryItem?.itemType?.name ||
                                        item.inventoryItem?.brand?.name ||
                                        t('common.na');
                                    return (
                                        <div key={item.id} className="flex items-center justify-between text-sm text-slate-700">
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

                    <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 shadow-sm">
                        <p>
                            Paid to date:{' '}
                            <span className="font-semibold">{formatCurrency(Number(booking.totalPaidAmount || 0))}</span>
                        </p>
                        {booking.depositAmount ? (
                            <p>
                                Deposit required:{' '}
                                <span className="font-semibold">{formatCurrency(Number(booking.depositAmount || 0))}</span>
                            </p>
                        ) : null}
                        <p>
                            Remaining after deposit:{' '}
                            <span className="font-semibold">{formatCurrency(Number(booking.remainingBalanceAmount || 0))}</span>
                        </p>
                        <p>
                            Outstanding now: <span className="font-semibold">{formatCurrency(getOutstandingNow(booking))}</span>
                        </p>
                        <p className="mt-2 border-t border-slate-200 pt-2 text-base font-semibold text-slate-800">
                            Total: {formatCurrency(Number(booking.totalAmount || 0))}
                        </p>
                    </div>

                    <div className="rounded border border-slate-200 bg-white p-4 shadow-sm">
                        <h3 className="mb-2 text-sm font-semibold text-slate-700">Actions</h3>
                        <div className="flex flex-wrap gap-2">
                            {actionState.canContinuePayment && (
                                <button
                                    type="button"
                                    className="rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                                    onClick={() => continuePayment(booking)}
                                    disabled={redirectingBookingId === booking.id}
                                >
                                    {redirectingBookingId === booking.id ? 'Processing...' : t('myBookingsPage.payNow')}
                                </button>
                            )}
                            {actionState.canPayRemainingBalance && (
                                <button
                                    type="button"
                                    className="rounded border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                                    onClick={() => continueRemainingBalancePayment(booking)}
                                    disabled={redirectingBookingId === booking.id}
                                >
                                    {redirectingBookingId === booking.id ? 'Processing...' : 'Pay remaining'}
                                </button>
                            )}
                            {actionState.canConfirmDelivery && (
                                <button
                                    type="button"
                                    className="rounded border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                                    onClick={() => confirmDelivered(booking)}
                                    disabled={actionBookingId === booking.id}
                                >
                                    {actionBookingId === booking.id ? 'Processing...' : 'Confirm delivery'}
                                </button>
                            )}
                            {booking.status === 'pending' && (
                                <button
                                    type="button"
                                    className="rounded border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                                    onClick={() => cancel(booking)}
                                    disabled={actionBookingId === booking.id}
                                >
                                    {t('myBookingsPage.cancel')}
                                </button>
                            )}
                            {booking.status === 'completed' && (
                                <button
                                    type="button"
                                    className="rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                                    onClick={() => rateVendor(booking)}
                                    disabled={actionBookingId === booking.id}
                                >
                                    Rate vendor
                                </button>
                            )}
                            {['confirmed', 'completed'].includes(booking.status) && (
                                <button
                                    type="button"
                                    className="rounded border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                                    onClick={() => openDisputeForBooking(booking)}
                                    disabled={actionBookingId === booking.id}
                                >
                                    Open dispute
                                </button>
                            )}
                            <button
                                type="button"
                                className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                onClick={() => downloadSignedDocument(booking, 'contract')}
                                disabled={actionBookingId === booking.id}
                            >
                                Contract PDF
                            </button>
                            <button
                                type="button"
                                className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                onClick={() => downloadSignedDocument(booking, 'receipt')}
                                disabled={actionBookingId === booking.id}
                            >
                                Receipt PDF
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </CustomerLayout>
    );
}
