import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDays, format, getDay, parse, startOfWeek } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { Calendar, Views, dateFnsLocalizer, type View } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import VendorLayout from '../../components/layout/VendorLayout';
import { getVendorBookings } from '../../api/bookings';
import type { Booking } from '../../types';
import { formatDate, formatCurrency } from '../../utils/format';
import LoadingSpinner from '../../components/common/LoadingSpinner';

type BookingCalendarEvent = {
    title: string;
    tooltip: string;
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

const BOOKING_STATUS_STYLES: Record<
    Booking['status'],
    { background: string; border: string; color: string; label: string }
> = {
    pending: {
        background: '#fef3c7',
        border: '#f59e0b',
        color: '#92400e',
        label: 'Pending',
    },
    confirmed: {
        background: '#dbeafe',
        border: '#3b82f6',
        color: '#1d4ed8',
        label: 'Confirmed',
    },
    completed: {
        background: '#dcfce7',
        border: '#22c55e',
        color: '#166534',
        label: 'Completed',
    },
    cancelled: {
        background: '#fee2e2',
        border: '#ef4444',
        color: '#991b1b',
        label: 'Cancelled',
    },
};

const CALENDAR_VIEWS: View[] = [Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA];

function parseBookingDate(value: string): Date {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [year, month, day] = value.split('-').map((segment) => Number(segment));
        return new Date(year, month - 1, day);
    }

    return new Date(value);
}

export default function VendorBookingsCalendar() {
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
                        tooltip: [
                            `Customer: ${booking.customer?.name || 'Customer'}`,
                            `Status: ${BOOKING_STATUS_STYLES[booking.status].label}`,
                            `Dates: ${formatDate(booking.startDate)} - ${formatDate(booking.endDate)}`,
                            `Amount: ${formatCurrency(booking.totalAmount)}`,
                            `Items: ${booking.items?.length || 0}`,
                        ].join('\n'),
                        start,
                        end: endExclusive,
                        allDay: true,
                        resource: booking,
                    };
                })
                .filter((event): event is BookingCalendarEvent => Boolean(event)),
        [filteredBookings],
    );

    if (loading) {
        return (
            <VendorLayout>
                <LoadingSpinner />
            </VendorLayout>
        );
    }

    return (
        <VendorLayout>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h1 className="text-xl font-semibold text-slate-800">Booking Calendar</h1>
                <button
                    type="button"
                    className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    onClick={() => navigate('/vendor/bookings')}
                >
                    View Booking List
                </button>
            </div>

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
                        <p className="text-sm text-slate-500">Click any booking event to open details. Hover on an event to see full booking info.</p>
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
                    tooltipAccessor="tooltip"
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
                                fontWeight: 500,
                                opacity: event.resource.status === 'cancelled' ? 0.75 : 1,
                            },
                        };
                    }}
                    style={{ height: 720 }}
                />
            </div>
        </VendorLayout>
    );
}
