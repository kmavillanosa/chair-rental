import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import VendorLayout from '../../components/layout/VendorLayout';
import {
    downloadBookingDocument,
    generateBookingDocuments,
    getBookingDisputes,
    getBookingDocuments,
    getBookingMessages,
    getBookingReviews,
    getVendorBookings,
    openBookingDispute,
    submitBookingReview,
    updateBookingStatus,
    uploadBookingDeliveryProof,
} from '../../api/bookings';
import type {
    Booking,
    BookingDispute,
    BookingDocument,
    BookingMessage,
    BookingReview,
} from '../../types';
import { BookingStatusBadge } from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatCurrency, formatDate } from '../../utils/format';
import BookingChatWidget from '../../components/chat/BookingChatWidget';

export default function VendorBookingDetails() {
    const navigate = useNavigate();
    const { bookingId } = useParams<{ bookingId: string }>();
    const [booking, setBooking] = useState<Booking | null>(null);
    const [messages, setMessages] = useState<BookingMessage[]>([]);
    const [reviews, setReviews] = useState<BookingReview[]>([]);
    const [disputes, setDisputes] = useState<BookingDispute[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionBookingId, setActionBookingId] = useState<string | null>(null);

    const loadBooking = async () => {
        if (!bookingId) {
            setBooking(null);
            return;
        }

        const vendorBookings = await getVendorBookings();
        const matchedBooking = vendorBookings.find((item) => item.id === bookingId) || null;
        setBooking(matchedBooking);
    };

    const loadBookingTrustContext = async (id: string) => {
        const [nextMessages, nextReviews, nextDisputes] = await Promise.all([
            getBookingMessages(id),
            getBookingReviews(id),
            getBookingDisputes(id),
        ]);

        setMessages(nextMessages);
        setReviews(nextReviews);
        setDisputes(nextDisputes);
    };

    const load = async () => {
        if (!bookingId) {
            setLoading(false);
            return;
        }

        try {
            await Promise.all([loadBooking(), loadBookingTrustContext(bookingId)]);
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to load booking details.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setLoading(true);
        load();
    }, [bookingId]);

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
                    ['vendor', 'both'].includes(document.issuedTo),
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
                    : 'Signed rental partner receipt downloaded.',
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

    const updateStatus = async (status: 'confirmed' | 'cancelled' | 'completed') => {
        if (!booking) return;

        setActionBookingId(booking.id);
        try {
            await updateBookingStatus(booking.id, status);
            toast.success(
                status === 'confirmed'
                    ? 'Booking confirmed.'
                    : status === 'cancelled'
                        ? 'Booking cancelled.'
                        : 'Booking completed.',
            );
            await loadBooking();
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to update booking status.');
        } finally {
            setActionBookingId(null);
        }
    };

    const uploadProof = async () => {
        if (!booking) return;

        const photoUrl = window.prompt('Enter delivery proof photo URL:');
        if (!photoUrl) return;

        setActionBookingId(booking.id);
        try {
            await uploadBookingDeliveryProof(booking.id, { photoUrl });
            toast.success('Delivery proof uploaded.');
            await loadBooking();
            await loadBookingTrustContext(booking.id);
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to upload delivery proof.');
        } finally {
            setActionBookingId(null);
        }
    };

    const reviewCustomer = async () => {
        if (!booking) return;

        const ratingInput = window.prompt('Rate this customer from 1 to 5:');
        if (!ratingInput) return;

        const rating = Math.round(Number(ratingInput));
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            toast.error('Rating must be an integer between 1 and 5.');
            return;
        }

        const comment = window.prompt('Optional review comment:') || undefined;

        setActionBookingId(booking.id);
        try {
            await submitBookingReview(booking.id, rating, comment);
            toast.success('Review submitted.');
            await loadBookingTrustContext(booking.id);
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to submit review.');
        } finally {
            setActionBookingId(null);
        }
    };

    const openDispute = async () => {
        if (!booking) return;

        const reason = window.prompt('Dispute reason:');
        if (!reason?.trim()) return;

        setActionBookingId(booking.id);
        try {
            await openBookingDispute(booking.id, reason.trim());
            toast.success('Dispute opened.');
            await loadBookingTrustContext(booking.id);
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to open dispute.');
        } finally {
            setActionBookingId(null);
        }
    };

    if (loading) {
        return (
            <VendorLayout>
                <LoadingSpinner />
            </VendorLayout>
        );
    }

    if (!booking) {
        return (
            <VendorLayout>
                <div className="mx-auto max-w-3xl rounded border border-slate-200 bg-white p-5">
                    <h1 className="text-xl font-semibold text-slate-800">Booking Details</h1>
                    <p className="mt-2 text-sm text-slate-500">Booking not found.</p>
                    <button
                        type="button"
                        className="mt-4 rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                        onClick={() => navigate('/vendor/bookings')}
                    >
                        Back to bookings
                    </button>
                </div>
            </VendorLayout>
        );
    }

    return (
        <VendorLayout>
            <div className="mx-auto max-w-6xl space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-semibold text-slate-800">Booking Details</h1>
                        <p className="text-sm text-slate-500">{booking.customer?.name || booking.customerId}</p>
                    </div>
                    <button
                        type="button"
                        className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                        onClick={() => navigate('/vendor/bookings')}
                    >
                        Back
                    </button>
                </div>

                <BookingChatWidget
                    bookingId={booking.id}
                    userRole="vendor"
                    defaultOpen
                    className="mb-4"
                />

                <div className="space-y-4">
                    <div className="rounded border border-slate-200 bg-gray-50 p-4">
                        <div>
                            <p className="text-sm font-semibold text-gray-600">Customer</p>
                            <p className="text-base font-semibold">{booking.customer?.name}</p>
                            <p className="text-sm text-gray-600">{booking.customer?.email}</p>
                        </div>
                        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                                <p className="text-sm font-semibold text-gray-600">Start Date</p>
                                <p className="text-sm font-medium">{formatDate(booking.startDate)}</p>
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-gray-600">End Date</p>
                                <p className="text-sm font-medium">{formatDate(booking.endDate)}</p>
                            </div>
                        </div>
                        <div className="mt-3">
                            <p className="text-sm font-semibold text-gray-600">Delivery Address</p>
                            <p className="text-sm">{booking.deliveryAddress || 'Not specified'}</p>
                            {Number.isFinite(Number(booking.deliveryLatitude)) &&
                                Number.isFinite(Number(booking.deliveryLongitude)) ? (
                                <div className="mt-2">
                                    <p className="text-sm font-semibold text-gray-600">Delivery Coordinates</p>
                                    <p className="font-mono text-sm text-gray-700">
                                        {Number(booking.deliveryLatitude).toFixed(6)}, {Number(booking.deliveryLongitude).toFixed(6)}
                                    </p>
                                    <a
                                        href={`https://www.google.com/maps?q=${booking.deliveryLatitude},${booking.deliveryLongitude}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm font-semibold text-blue-600 hover:underline"
                                    >
                                        Open in Maps
                                    </a>
                                </div>
                            ) : null}
                        </div>
                    </div>

                    <div className="rounded border border-slate-200 bg-white p-4">
                        <h3 className="mb-2 text-sm font-semibold text-slate-700">Items Requested</h3>
                        <div className="space-y-2">
                            {booking.items && booking.items.length > 0 ? (
                                booking.items.map((item) => (
                                    <div key={item.id} className="rounded border border-slate-200 bg-slate-50 p-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="font-semibold">{item.inventoryItem?.itemType?.name}</p>
                                                <p className="text-sm text-gray-600">
                                                    {item.inventoryItem?.brand?.name} - Qty: {item.quantity} x {formatCurrency(item.ratePerDay)}/day
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold">{formatCurrency(item.subtotal)}</p>
                                                <p className="text-xs text-gray-500">subtotal</p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-gray-500">No items listed.</p>
                            )}
                        </div>
                    </div>

                    <div className="rounded border border-slate-200 bg-gray-50 p-4 space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-700">Items Subtotal</span>
                            <span className="font-semibold">
                                {formatCurrency(booking.totalAmount - booking.deliveryCharge - booking.serviceCharge)}
                            </span>
                        </div>
                        {booking.deliveryCharge > 0 && (
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-700">Delivery Charge</span>
                                <span className="font-semibold">{formatCurrency(booking.deliveryCharge)}</span>
                            </div>
                        )}
                        {booking.serviceCharge > 0 && (
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-700">Service Charge</span>
                                <span className="font-semibold">{formatCurrency(booking.serviceCharge)}</span>
                            </div>
                        )}
                        <div className="flex justify-between border-t pt-2 text-sm font-semibold">
                            <span>Total Amount</span>
                            <span className="text-green-600">{formatCurrency(booking.totalAmount)}</span>
                        </div>
                    </div>

                    {booking.notes && (
                        <div className="rounded border border-yellow-200 bg-yellow-50 p-3">
                            <h3 className="mb-1 text-sm font-semibold text-yellow-800">Special Instructions</h3>
                            <p className="text-sm text-gray-700">{booking.notes}</p>
                        </div>
                    )}

                    <div className="rounded border border-slate-200 bg-white p-4">
                        <h3 className="mb-2 text-sm font-semibold text-slate-700">Status</h3>
                        <BookingStatusBadge status={booking.status} />
                    </div>

                    <div className="rounded border border-slate-200 bg-white p-4">
                        <h3 className="mb-2 text-sm font-semibold text-slate-700">Actions</h3>
                        <div className="flex flex-wrap gap-2">
                            {booking.status === 'pending' && (
                                <>
                                    <button
                                        type="button"
                                        className="rounded border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                                        onClick={() => updateStatus('confirmed')}
                                        disabled={actionBookingId === booking.id}
                                    >
                                        Confirm
                                    </button>
                                    <button
                                        type="button"
                                        className="rounded border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                                        onClick={() => updateStatus('cancelled')}
                                        disabled={actionBookingId === booking.id}
                                    >
                                        Cancel
                                    </button>
                                </>
                            )}
                            {booking.status === 'confirmed' && (
                                <button
                                    type="button"
                                    className="rounded border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                                    onClick={() => updateStatus('completed')}
                                    disabled={actionBookingId === booking.id}
                                >
                                    Complete
                                </button>
                            )}
                            <button
                                type="button"
                                className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                onClick={uploadProof}
                                disabled={actionBookingId === booking.id}
                            >
                                Upload Proof
                            </button>
                            <button
                                type="button"
                                className="rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                                onClick={reviewCustomer}
                                disabled={actionBookingId === booking.id}
                            >
                                Write Review
                            </button>
                            <button
                                type="button"
                                className="rounded border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                                onClick={openDispute}
                                disabled={actionBookingId === booking.id}
                            >
                                Open Dispute
                            </button>
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

                    <div className="rounded border border-slate-200 bg-white p-4">
                        <h3 className="mb-2 text-sm font-semibold text-slate-700">Messages</h3>
                        {messages.length === 0 ? (
                            <p className="text-sm text-gray-500">No messages yet.</p>
                        ) : (
                            <div className="space-y-2">
                                {messages.map((message) => (
                                    <div key={message.id} className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
                                        <p className="font-semibold capitalize text-slate-800">{message.senderRole}</p>
                                        <p className="text-slate-700">{message.content}</p>
                                        {message.isFlagged ? (
                                            <p className="mt-1 text-xs font-semibold text-rose-700">Flagged for policy review</p>
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="rounded border border-slate-200 bg-white p-4">
                        <h3 className="mb-2 text-sm font-semibold text-slate-700">Reviews</h3>
                        {reviews.length === 0 ? (
                            <p className="text-sm text-gray-500">No reviews yet.</p>
                        ) : (
                            <div className="space-y-2">
                                {reviews.map((review) => (
                                    <div key={review.id} className="rounded border border-amber-200 bg-amber-50 p-3 text-sm">
                                        <p className="font-semibold text-amber-900">
                                            {review.rating}/5 from {review.reviewerRole}
                                        </p>
                                        {review.comment ? <p className="text-amber-800">{review.comment}</p> : null}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="rounded border border-slate-200 bg-white p-4">
                        <h3 className="mb-2 text-sm font-semibold text-slate-700">Disputes</h3>
                        {disputes.length === 0 ? (
                            <p className="text-sm text-gray-500">No disputes on this booking.</p>
                        ) : (
                            <div className="space-y-2">
                                {disputes.map((dispute) => (
                                    <div key={dispute.id} className="rounded border border-rose-200 bg-rose-50 p-3 text-sm">
                                        <p className="font-semibold capitalize text-rose-900">
                                            {dispute.status.replace('_', ' ')}
                                        </p>
                                        <p className="text-rose-800">{dispute.reason}</p>
                                        {dispute.outcome ? (
                                            <p className="mt-1 text-xs font-semibold text-rose-700">
                                                Outcome: {dispute.outcome.replace(/_/g, ' ')}
                                            </p>
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </VendorLayout>
    );
}
