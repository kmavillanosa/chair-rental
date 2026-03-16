import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table } from 'flowbite-react';
import toast from 'react-hot-toast';
import VendorLayout from '../../components/layout/VendorLayout';
import { getVendorBookings, updateBookingStatus } from '../../api/bookings';
import type { Booking } from '../../types';
import { BookingStatusBadge } from '../../components/common/StatusBadge';
import { formatDate, formatCurrency } from '../../utils/format';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export default function VendorBookings() {
    const navigate = useNavigate();
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const load = () => getVendorBookings().then(setBookings).finally(() => setLoading(false));

    useEffect(() => {
        load();
    }, []);

    const filteredBookings = useMemo(
        () =>
            bookings.filter((booking) => {
                if (searchQuery) {
                    const query = searchQuery.toLowerCase();
                    const name = (booking.customer?.name || '').toLowerCase();
                    const email = (booking.customer?.email || '').toLowerCase();
                    if (!name.includes(query) && !email.includes(query)) return false;
                }

                if (statusFilter && booking.status !== statusFilter) return false;
                if (dateFrom && booking.endDate < dateFrom) return false;
                if (dateTo && booking.startDate > dateTo) return false;
                return true;
            }),
        [bookings, searchQuery, statusFilter, dateFrom, dateTo],
    );

    const confirm = async (id: string) => {
        try {
            await updateBookingStatus(id, 'confirmed');
            toast.success('Booking confirmed.');
            await load();
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to confirm booking.');
        }
    };

    const cancel = async (id: string) => {
        try {
            await updateBookingStatus(id, 'cancelled');
            toast.success('Booking cancelled.');
            await load();
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to cancel booking.');
        }
    };

    const complete = async (id: string) => {
        try {
            await updateBookingStatus(id, 'completed');
            toast.success('Booking completed.');
            await load();
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to complete booking.');
        }
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
            <h1 className="mb-3 text-xl font-semibold text-slate-800">My Bookings</h1>

            <div className="mb-3 flex flex-wrap items-center gap-2">
                <input
                    type="text"
                    placeholder="Search by customer name or email"
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

            <div className="overflow-x-auto rounded-xl shadow">
                <Table striped>
                    <Table.Head>
                        <Table.HeadCell>Customer</Table.HeadCell>
                        <Table.HeadCell>Dates</Table.HeadCell>
                        <Table.HeadCell>Items</Table.HeadCell>
                        <Table.HeadCell>Amount</Table.HeadCell>
                        <Table.HeadCell>Status</Table.HeadCell>
                        <Table.HeadCell>Actions</Table.HeadCell>
                    </Table.Head>
                    <Table.Body>
                        {filteredBookings.map((booking) => (
                            <Table.Row key={booking.id} className="text-sm">
                                <Table.Cell>{booking.customer?.name || '-'}</Table.Cell>
                                <Table.Cell>
                                    {formatDate(booking.startDate)} - {formatDate(booking.endDate)}
                                </Table.Cell>
                                <Table.Cell>{booking.items?.length || 0} items</Table.Cell>
                                <Table.Cell className="font-medium">{formatCurrency(booking.totalAmount)}</Table.Cell>
                                <Table.Cell>
                                    <BookingStatusBadge status={booking.status} />
                                </Table.Cell>
                                <Table.Cell>
                                    <div className="flex flex-wrap gap-1">
                                        <button
                                            type="button"
                                            className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                                            onClick={() => navigate(`/vendor/bookings/${booking.id}`)}
                                        >
                                            View
                                        </button>
                                        {booking.status === 'pending' && (
                                            <>
                                                <button
                                                    type="button"
                                                    className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-100"
                                                    onClick={() => confirm(booking.id)}
                                                >
                                                    Confirm
                                                </button>
                                                <button
                                                    type="button"
                                                    className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700 hover:bg-rose-100"
                                                    onClick={() => cancel(booking.id)}
                                                >
                                                    Cancel
                                                </button>
                                            </>
                                        )}
                                        {booking.status === 'confirmed' && (
                                            <button
                                                type="button"
                                                className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700 hover:bg-blue-100"
                                                onClick={() => complete(booking.id)}
                                            >
                                                Complete
                                            </button>
                                        )}
                                    </div>
                                </Table.Cell>
                            </Table.Row>
                        ))}
                        {filteredBookings.length === 0 && (
                            <Table.Row>
                                <Table.Cell colSpan={6} className="py-6 text-center text-sm text-slate-400">
                                    {bookings.length === 0 ? 'No bookings yet.' : 'No bookings match your filters.'}
                                </Table.Cell>
                            </Table.Row>
                        )}
                    </Table.Body>
                </Table>
            </div>
        </VendorLayout>
    );
}
