import { useEffect, useMemo, useState } from 'react';
import VendorLayout from '../../components/layout/VendorLayout';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import type { Booking, Vendor, VendorPayment } from '../../types';
import { getMyVendor } from '../../api/vendors';
import { getVendorBookings } from '../../api/bookings';
import { getMyPayments } from '../../api/payments';
import { getInventoryBreakdown } from '../../api/items';
import { useTranslation } from 'react-i18next';

const ITEM_PALETTE = [
    { bg: 'bg-rose-400' },
    { bg: 'bg-amber-400' },
    { bg: 'bg-sky-400' },
    { bg: 'bg-emerald-400' },
    { bg: 'bg-violet-400' },
    { bg: 'bg-pink-400' },
    { bg: 'bg-teal-400' },
    { bg: 'bg-orange-400' },
];

type InventoryBreakdownRow = {
    id: string;
    total: number;
    available: number;
    reserved: number;
    color?: string;
    itemType?: {
        name?: string;
    };
};

export default function VendorDashboard() {
    const { t } = useTranslation();
    const [vendor, setVendor] = useState<Vendor | null>(null);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [payments, setPayments] = useState<VendorPayment[]>([]);
    const [breakdown, setBreakdown] = useState<InventoryBreakdownRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [breakdownLoading, setBreakdownLoading] = useState(false);

    useEffect(() => {
        Promise.all([getMyVendor(), getVendorBookings(), getMyPayments()])
            .then(([vendorData, bookingsData, paymentsData]) => {
                setVendor(vendorData);
                setBookings(bookingsData);
                setPayments(paymentsData);
            })
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (!vendor) return;

        setBreakdownLoading(true);
        getInventoryBreakdown(vendor.id)
            .then((rows) => setBreakdown(rows || []))
            .finally(() => setBreakdownLoading(false));
    }, [vendor]);

    const colorMap = useMemo(() => {
        const map: Record<string, (typeof ITEM_PALETTE)[number]> = {};
        breakdown.forEach((item, index) => {
            map[item.id] = ITEM_PALETTE[index % ITEM_PALETTE.length];
        });
        return map;
    }, [breakdown]);

    if (loading) {
        return (
            <VendorLayout>
                <LoadingSpinner />
            </VendorLayout>
        );
    }

    const overduePayments = payments.filter((payment) => payment.status === 'overdue');
    const todayIso = new Date().toISOString().split('T')[0];
    const todaysActiveBookings = bookings.filter((booking) =>
        booking.startDate <= todayIso &&
        booking.endDate >= todayIso &&
        booking.status === 'confirmed'
    );
    const publicShopUrl = `${window.location.origin}/shop/${vendor?.slug || ''}`;

    return (
        <VendorLayout>
            {vendor?.warningCount ? (
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-lg text-xl">
                    {t('vendorDashboard.warningBanner', { count: vendor.warningCount })}
                </div>
            ) : null}

            {overduePayments.length > 0 ? (
                <div className="bg-orange-100 border-l-4 border-orange-500 text-orange-700 p-4 mb-6 rounded-lg text-xl">
                    {t('vendorDashboard.overdueBanner', { count: overduePayments.length })}
                </div>
            ) : null}

            <h1 className="text-4xl font-bold text-gray-900 mb-6">
                {t('vendorDashboard.welcome', { name: vendor?.businessName || '' })}
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-blue-100 rounded-2xl p-6">
                    <p className="text-lg">{t('vendorDashboard.todaysActiveBookings')}</p>
                    <p className="text-5xl font-bold text-blue-800 mt-2">{todaysActiveBookings.length}</p>
                </div>
                <div className="bg-green-100 rounded-2xl p-6">
                    <p className="text-lg">{t('vendorDashboard.totalBookings')}</p>
                    <p className="text-5xl font-bold text-green-800 mt-2">{bookings.length}</p>
                </div>
                <div className="bg-yellow-100 rounded-2xl p-6">
                    <p className="text-lg">{t('vendorDashboard.warnings')}</p>
                    <p className="text-5xl font-bold text-yellow-800 mt-2">{vendor?.warningCount || 0}/3</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow p-6 mb-8">
                <h2 className="text-2xl font-bold mb-4">
                    {t('vendorDashboard.shopPathTitle', { slug: vendor?.slug || '' })}
                </h2>
                <p className="text-gray-600 text-lg">{vendor?.address}</p>
                <a
                    href={publicShopUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 text-lg hover:underline mt-2 inline-block"
                >
                    {t('vendorDashboard.viewPublicPage')} →
                </a>
            </div>

            <div className="bg-white rounded-2xl shadow p-6">
                <h2 className="text-xl font-semibold text-slate-700 mb-4">Equipment Breakdown</h2>
                <BreakdownArmy breakdown={breakdown} breakdownLoading={breakdownLoading} colorMap={colorMap} />
            </div>
        </VendorLayout>
    );
}

function BreakdownArmy({
    breakdown,
    breakdownLoading,
    colorMap,
}: {
    breakdown: InventoryBreakdownRow[];
    breakdownLoading: boolean;
    colorMap: Record<string, (typeof ITEM_PALETTE)[number]>;
}) {
    if (breakdownLoading) return <LoadingSpinner size="md" />;
    if (!breakdown.length) return <div className="text-slate-400 py-8 text-center">No breakdown data.</div>;

    return (
        <section className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-900 to-slate-800 p-5 sm:p-6 text-white">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-200 tabular-nums">
                    {breakdown.reduce((sum, row) => sum + Number(row.total || 0), 0)} total units
                </span>
            </div>
            <p className="mt-2 text-xs text-slate-300">Color = available, Grey = reserved. Each block is one unit.</p>

            <div className="mt-5 space-y-4">
                {breakdown.map((row, index) => {
                    const color = colorMap[row.id] ?? ITEM_PALETTE[index % ITEM_PALETTE.length];
                    return (
                        <div key={row.id} className="rounded-xl border border-white/10 bg-black/15 p-3">
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                <div className="inline-flex items-center gap-2">
                                    <span className={`h-3 w-3 rounded-sm ${color.bg}`} />
                                    <span className="text-sm font-medium text-slate-100">
                                        {row.itemType?.name}
                                        {row.color ? <span className="text-slate-300"> - {row.color}</span> : null}
                                    </span>
                                </div>
                                <span className="text-xs text-slate-300 tabular-nums">
                                    {row.total} unit{row.total !== 1 ? 's' : ''} ({row.available} available, {row.reserved} reserved)
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {Array.from({ length: Number(row.available || 0) }).map((_, i) => (
                                    <div key={`a-${row.id}-${i}`} className={`h-4 w-4 rounded-sm ${color.bg} border border-white/10`} title="Available" />
                                ))}
                                {Array.from({ length: Number(row.reserved || 0) }).map((_, i) => (
                                    <div key={`r-${row.id}-${i}`} className="h-4 w-4 rounded-sm bg-gray-400 border border-white/10 opacity-60" title="Reserved" />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}