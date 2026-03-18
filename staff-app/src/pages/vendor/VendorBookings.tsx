import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table } from 'flowbite-react';
import toast from 'react-hot-toast';
import { addDays, format, getDay, parse, startOfWeek } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { Calendar, Views, dateFnsLocalizer, type View } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import VendorLayout from '../../components/layout/VendorLayout';
import { getVendorBookings, updateBookingStatus } from '../../api/bookings';
import type { Booking } from '../../types';
import { BookingStatusBadge } from '../../components/common/StatusBadge';
import { formatDate, formatCurrency } from '../../utils/format';
import LoadingSpinner from '../../components/common/LoadingSpinner';

type BookingCalendarEvent = {
    title: string;
    start: Date;
    end: Date;
    allDay: boolean;
    resource: Booking;
};

const calendarLocalizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek: (date) => startOfWeek(date, { weekStartsOn: 0 }),
    getDay,
    locales: {
        'en-US': enUS,
    },
});

const BOOKING_STATUS_STYLES: Record<Booking['status'], { background: string; border: string; color: string; label: string }> = {
    pending: { background: '#fef3c7', border: '#f59e0b', color: '#92400e', label: 'Pending' },
    confirmed: { background: '#dbeafe', border: '#3b82f6', color: '#1d4ed8', label: 'Confirmed' },
    completed: { background: '#dcfce7', border: '#22c55e', color: '#166534', label: 'Completed' },
    cancelled: { background: '#fee2e2', border: '#ef4444', color: '#991b1b', label: 'Cancelled' },
};

const CALENDAR_VIEWS: View[] = [Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA];

function parseBookingDate(value: string): Date {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [year, month, day] = value.split('-').map((segment) => Number(segment));
        return new Date(year, month - 1, day);
    }

    return new Date(value);
}

export default function VendorBookings() {
    const navigate = useNavigate();
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [calendarView, setCalendarView] = useState<View>(Views.MONTH);
    const [calendarDate, setCalendarDate] = useState(new Date());

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

    const calendarEvents = useMemo<BookingCalendarEvent[]>(
        () =>
            filteredBookings
                .map((booking) => {
                    const start = parseBookingDate(booking.startDate);
                    const endExclusive = addDays(parseBookingDate(booking.endDate), 1);

                    if (Number.isNaN(start.getTime()) || Number.isNaN(endExclusive.getTime())) {
                        return null;
                    }

                    return {
                        title: `${booking.customer?.name || 'Customer'} • ${formatCurrency(booking.totalAmount)}`,
                        start,
                        end: endExclusive,
                        allDay: true,
                        resource: booking,
                    };
                })
                .filter((event): event is BookingCalendarEvent => Boolean(event)),
        [filteredBookings],
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

            <div className="booking-calendar mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-800">Booking Schedule Calendar</h2>
                        <p className="text-sm text-slate-500">Click any booking event to open details.</p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs font-medium">
                        {(Object.keys(BOOKING_STATUS_STYLES) as Booking['status'][]).map((status) => {
                            const style = BOOKING_STATUS_STYLES[status];

                            return (
                                <span
                                    key={status}
                                    className="inline-flex items-center rounded-full border px-3 py-1"
                                    style={{
                                        backgroundColor: style.background,
                                        borderColor: style.border,
                                        color: style.color,
                                    }}
                                >
                                    {style.label}
                                </span>
                            );
                        })}
                    </div>
                </div>

                <Calendar<BookingCalendarEvent>
                    localizer={calendarLocalizer}
                    events={calendarEvents}
                    views={CALENDAR_VIEWS}
                    view={calendarView}
                    onView={(nextView) => setCalendarView(nextView)}
                    date={calendarDate}
                    onNavigate={(nextDate) => setCalendarDate(nextDate)}
                    startAccessor="start"
                    endAccessor="end"
                    allDayAccessor="allDay"
                    popup
                    onSelectEvent={(event) => navigate(`/vendor/bookings/${event.resource.id}`)}
                    eventPropGetter={(event) => {
                        const style = BOOKING_STATUS_STYLES[event.resource.status];

                        return {
                            style: {
                                backgroundColor: style.background,
                                borderColor: style.border,
                                color: style.color,
                                borderWidth: '1px',
                                borderStyle: 'solid',
                                borderRadius: '10px',
                                fontWeight: 600,
                                opacity: event.resource.status === 'cancelled' ? 0.75 : 1,
                            },
                        };
                    }}
                    style={{ height: 720 }}
                />
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
