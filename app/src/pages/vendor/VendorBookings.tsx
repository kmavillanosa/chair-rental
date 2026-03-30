import { useEffect, useState } from 'react';
import { Button, Modal, Table } from 'flowbite-react';
import toast from 'react-hot-toast';
import VendorLayout from '../../components/layout/VendorLayout';
import { getVendorBookings, updateBookingStatus } from '../../api/bookings';
import type { Booking } from '../../types';
import { BookingStatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatDate } from '../../utils/format';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useTranslation } from 'react-i18next';
import { HiCalendar, HiCheck, HiClipboardList, HiEye, HiX } from 'react-icons/hi';

export default function VendorBookings() {
    const { t } = useTranslation();
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
    const [showModal, setShowModal] = useState(false);

    const load = () =>
        getVendorBookings()
            .then(setBookings)
            .finally(() => setLoading(false));

    useEffect(() => {
        load();
    }, []);

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

    const openBookingDetails = (booking: Booking) => {
        setSelectedBooking(booking);
        setShowModal(true);
    };

    if (loading) {
        return (
            <VendorLayout>
                <LoadingSpinner />
            </VendorLayout>
        );
    }

    return (
        <VendorLayout>
            <h1 className="mb-6 inline-flex items-center gap-2 text-4xl font-bold text-gray-900">
                <HiCalendar className="h-9 w-9 text-slate-700" aria-hidden="true" />
                {t('vendorBookings.title')}
            </h1>

            <div className="space-y-3 md:hidden">
                {bookings.map((booking) => (
                    <article key={booking.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-900">{booking.customer?.name || t('common.na')}</p>
                            <BookingStatusBadge status={booking.status} />
                        </div>

                        <dl className="mt-3 space-y-2 text-sm">
                            <div className="flex items-start justify-between gap-3">
                                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('common.dates')}</dt>
                                <dd className="text-right text-slate-700">{formatDate(booking.startDate)} - {formatDate(booking.endDate)}</dd>
                            </div>
                            <div className="flex items-start justify-between gap-3">
                                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('common.items')}</dt>
                                <dd className="text-right text-slate-700">{t('vendorBookings.itemsCount', { count: booking.items?.length || 0 })}</dd>
                            </div>
                            <div className="flex items-start justify-between gap-3">
                                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('common.amount')}</dt>
                                <dd className="text-right font-semibold text-slate-900">{formatCurrency(booking.totalAmount)}</dd>
                            </div>
                        </dl>

                        <div className="mt-4 grid grid-cols-2 gap-2">
                            <Button size="sm" color="info" onClick={() => openBookingDetails(booking)}>
                                <span className="inline-flex items-center gap-1">
                                    <HiEye className="h-4 w-4" aria-hidden="true" />
                                    {t('common.view')}
                                </span>
                            </Button>
                            {booking.status === 'pending' ? (
                                <>
                                    <Button size="sm" color="success" onClick={() => confirm(booking.id)}>
                                        <span className="inline-flex items-center gap-1">
                                            <HiCheck className="h-4 w-4" aria-hidden="true" />
                                            {t('vendorBookings.confirm')}
                                        </span>
                                    </Button>
                                    <Button size="sm" color="failure" onClick={() => cancel(booking.id)}>
                                        <span className="inline-flex items-center gap-1">
                                            <HiX className="h-4 w-4" aria-hidden="true" />
                                            {t('vendorBookings.cancel')}
                                        </span>
                                    </Button>
                                </>
                            ) : null}
                            {booking.status === 'confirmed' ? (
                                <Button size="sm" color="indigo" onClick={() => complete(booking.id)}>
                                    <span className="inline-flex items-center gap-1">
                                        <HiCheck className="h-4 w-4" aria-hidden="true" />
                                        {t('vendorBookings.complete')}
                                    </span>
                                </Button>
                            ) : null}
                        </div>
                    </article>
                ))}
            </div>

            <div className="hidden overflow-x-auto rounded-xl shadow md:block">
                <Table striped className="mobile-friendly-table">
                    <Table.Head>
                        <Table.HeadCell className="text-lg">{t('common.customer')}</Table.HeadCell>
                        <Table.HeadCell className="text-lg">{t('common.dates')}</Table.HeadCell>
                        <Table.HeadCell className="text-lg">{t('common.items')}</Table.HeadCell>
                        <Table.HeadCell className="text-lg">{t('common.amount')}</Table.HeadCell>
                        <Table.HeadCell className="text-lg">{t('common.status')}</Table.HeadCell>
                        <Table.HeadCell className="text-lg">{t('common.actions')}</Table.HeadCell>
                    </Table.Head>
                    <Table.Body>
                        {bookings.map((booking) => (
                            <Table.Row key={booking.id} className="text-lg">
                                <Table.Cell>{booking.customer?.name}</Table.Cell>
                                <Table.Cell>{formatDate(booking.startDate)} – {formatDate(booking.endDate)}</Table.Cell>
                                <Table.Cell>{t('vendorBookings.itemsCount', { count: booking.items?.length || 0 })}</Table.Cell>
                                <Table.Cell className="font-semibold">{formatCurrency(booking.totalAmount)}</Table.Cell>
                                <Table.Cell><BookingStatusBadge status={booking.status} /></Table.Cell>
                                <Table.Cell>
                                    <div className="flex gap-2 flex-wrap">
                                        <Button size="sm" color="info" onClick={() => openBookingDetails(booking)}>
                                            <span className="inline-flex items-center gap-1">
                                                <HiEye className="h-4 w-4" aria-hidden="true" />
                                                View
                                            </span>
                                        </Button>
                                        {booking.status === 'pending' ? (
                                            <>
                                                <Button size="sm" color="success" onClick={() => confirm(booking.id)}>
                                                    <span className="inline-flex items-center gap-1">
                                                        <HiCheck className="h-4 w-4" aria-hidden="true" />
                                                        {t('vendorBookings.confirm')}
                                                    </span>
                                                </Button>
                                                <Button size="sm" color="failure" onClick={() => cancel(booking.id)}>
                                                    <span className="inline-flex items-center gap-1">
                                                        <HiX className="h-4 w-4" aria-hidden="true" />
                                                        {t('vendorBookings.cancel')}
                                                    </span>
                                                </Button>
                                            </>
                                        ) : null}
                                        {booking.status === 'confirmed' ? (
                                            <Button size="sm" color="indigo" onClick={() => complete(booking.id)}>
                                                <span className="inline-flex items-center gap-1">
                                                    <HiCheck className="h-4 w-4" aria-hidden="true" />
                                                    {t('vendorBookings.complete')}
                                                </span>
                                            </Button>
                                        ) : null}
                                    </div>
                                </Table.Cell>
                            </Table.Row>
                        ))}
                    </Table.Body>
                </Table>
            </div>

            <Modal className="mobile-fullscreen-modal" show={showModal} onClose={() => setShowModal(false)} size="2xl">
                <Modal.Header>
                    <span className="inline-flex items-center gap-2">
                        <HiClipboardList className="h-5 w-5" aria-hidden="true" />
                        Booking Details{selectedBooking ? ` - ${selectedBooking.customer?.name}` : ''}
                    </span>
                </Modal.Header>
                <Modal.Body>
                    {selectedBooking ? (
                        <div className="space-y-6">
                            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                                <div>
                                    <p className="text-sm font-semibold text-gray-600">Customer</p>
                                    <p className="text-xl font-bold">{selectedBooking.customer?.name || '-'}</p>
                                    <p className="text-gray-600">{selectedBooking.customer?.email || '-'}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-sm font-semibold text-gray-600">Start Date</p>
                                        <p className="text-lg font-bold">{formatDate(selectedBooking.startDate)}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-gray-600">End Date</p>
                                        <p className="text-lg font-bold">{formatDate(selectedBooking.endDate)}</p>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-600">Delivery Address</p>
                                    <p className="text-lg">{selectedBooking.deliveryAddress || 'Not specified'}</p>
                                    {Number.isFinite(Number(selectedBooking.deliveryLatitude)) &&
                                        Number.isFinite(Number(selectedBooking.deliveryLongitude)) ? (
                                        <div className="mt-2">
                                            <p className="text-sm font-semibold text-gray-600">Delivery Coordinates</p>
                                            <p className="font-mono text-sm text-gray-700">
                                                {Number(selectedBooking.deliveryLatitude).toFixed(6)}, {Number(selectedBooking.deliveryLongitude).toFixed(6)}
                                            </p>
                                            <a
                                                href={`https://www.google.com/maps?q=${selectedBooking.deliveryLatitude},${selectedBooking.deliveryLongitude}`}
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

                            <div>
                                <h3 className="mb-3 inline-flex items-center gap-2 text-xl font-bold">
                                    <HiClipboardList className="h-5 w-5" aria-hidden="true" />
                                    Items Requested
                                </h3>
                                <div className="space-y-2">
                                    {selectedBooking.items?.length ? (
                                        selectedBooking.items.map((item) => (
                                            <div key={item.id} className="bg-blue-50 rounded-lg p-3 flex justify-between items-center">
                                                <div>
                                                    <p className="font-semibold">{item.inventoryItem?.itemType?.name || t('common.na')}</p>
                                                    <p className="text-sm text-gray-600">
                                                        {item.inventoryItem?.brand?.name || t('common.na')} • Qty: {item.quantity} × {formatCurrency(item.ratePerDay)}/day
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold">{formatCurrency(item.subtotal)}</p>
                                                    <p className="text-xs text-gray-500">subtotal</p>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-gray-500">No items listed.</p>
                                    )}
                                </div>
                            </div>

                            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-gray-700">Items Subtotal</span>
                                    <span className="font-semibold">
                                        {formatCurrency(
                                            selectedBooking.totalAmount -
                                            Number(selectedBooking.deliveryCharge || 0) -
                                            Number(selectedBooking.serviceCharge || 0),
                                        )}
                                    </span>
                                </div>
                                {selectedBooking.deliveryCharge > 0 ? (
                                    <div className="flex justify-between">
                                        <span className="text-gray-700">Delivery Charge</span>
                                        <span className="font-semibold">{formatCurrency(selectedBooking.deliveryCharge)}</span>
                                    </div>
                                ) : null}
                                {selectedBooking.serviceCharge > 0 ? (
                                    <div className="flex justify-between">
                                        <span className="text-gray-700">Service Charge</span>
                                        <span className="font-semibold">{formatCurrency(selectedBooking.serviceCharge)}</span>
                                    </div>
                                ) : null}
                                <div className="flex justify-between text-lg font-bold pt-2 border-t">
                                    <span>Total Amount</span>
                                    <span className="text-green-600">{formatCurrency(selectedBooking.totalAmount)}</span>
                                </div>
                            </div>

                            {selectedBooking.notes ? (
                                <div>
                                    <h3 className="mb-2 inline-flex items-center gap-2 font-semibold">
                                        <HiClipboardList className="h-4 w-4" aria-hidden="true" />
                                        Special Instructions
                                    </h3>
                                    <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                                        <p className="text-gray-700">{selectedBooking.notes}</p>
                                    </div>
                                </div>
                            ) : null}

                            <div>
                                <h3 className="font-semibold mb-2">Status</h3>
                                <BookingStatusBadge status={selectedBooking.status} />
                            </div>
                        </div>
                    ) : null}
                </Modal.Body>
                <Modal.Footer>
                    <Button color="gray" onClick={() => setShowModal(false)}>Close</Button>
                </Modal.Footer>
            </Modal>
        </VendorLayout>
    );
}