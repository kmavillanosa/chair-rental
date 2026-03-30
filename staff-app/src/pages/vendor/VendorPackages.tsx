import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import VendorLayout from '../../components/layout/VendorLayout';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import {
    getMyVendorPackages,
    updateMyVendorPackageActive,
} from '../../api/packages';
import type { VendorPackage } from '../../types';

const statusLabel: Record<VendorPackage['status'], string> = {
    eligible: 'Eligible',
    available: 'Available',
    partially_available: 'Partially Available',
    disabled: 'Disabled',
};

const statusClassName: Record<VendorPackage['status'], string> = {
    eligible: 'bg-slate-100 text-slate-700 border-slate-300',
    available: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    partially_available: 'bg-amber-100 text-amber-700 border-amber-300',
    disabled: 'bg-rose-100 text-rose-700 border-rose-300',
};

export default function VendorPackages() {
    const [packages, setPackages] = useState<VendorPackage[]>([]);
    const [loading, setLoading] = useState(true);
    const [updatingIds, setUpdatingIds] = useState<Record<string, boolean>>({});

    useEffect(() => {
        getMyVendorPackages(true)
            .then((data) => setPackages(data))
            .catch(() => toast.error('Failed to load package availability.'))
            .finally(() => setLoading(false));
    }, []);

    const activeCount = useMemo(
        () => packages.filter((vendorPackage) => vendorPackage.isActive).length,
        [packages],
    );

    const handleToggle = async (vendorPackage: VendorPackage) => {
        setUpdatingIds((current) => ({ ...current, [vendorPackage.id]: true }));

        try {
            const updated = await updateMyVendorPackageActive(
                vendorPackage.id,
                !vendorPackage.isActive,
            );

            setPackages((current) =>
                current.map((item) => (item.id === updated.id ? updated : item)),
            );

            toast.success(
                updated.isActive
                    ? `${updated.packageName} is now visible to customers.`
                    : `${updated.packageName} is hidden from customers.`,
            );
        } catch {
            toast.error('Could not update package visibility.');
        } finally {
            setUpdatingIds((current) => {
                const next = { ...current };
                delete next[vendorPackage.id];
                return next;
            });
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
            <div className="space-y-5">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h1 className="text-2xl font-bold text-slate-900">Package Availability</h1>
                    <p className="mt-2 text-sm text-slate-600">
                        Control which eligible packages appear on your public page. Customers can book
                        active packages directly.
                    </p>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {activeCount} of {packages.length} packages visible
                    </p>
                </div>

                {packages.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
                        No package assignments found for your account yet.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {packages.map((vendorPackage) => {
                            const isUpdating = Boolean(updatingIds[vendorPackage.id]);
                            return (
                                <section
                                    key={vendorPackage.id}
                                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <h2 className="text-lg font-semibold text-slate-900">
                                                {vendorPackage.packageName}
                                            </h2>
                                            <p className="mt-1 text-sm text-slate-600">
                                                {vendorPackage.items.length} included item type
                                                {vendorPackage.items.length === 1 ? '' : 's'}
                                            </p>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2">
                                            <span
                                                className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClassName[vendorPackage.status]}`}
                                            >
                                                {statusLabel[vendorPackage.status]}
                                            </span>

                                            <button
                                                type="button"
                                                onClick={() => handleToggle(vendorPackage)}
                                                disabled={isUpdating}
                                                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${vendorPackage.isActive
                                                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'} ${isUpdating ? 'cursor-not-allowed opacity-60' : ''}`}
                                            >
                                                {isUpdating
                                                    ? 'Saving...'
                                                    : vendorPackage.isActive
                                                        ? 'Visible'
                                                        : 'Hidden'}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                        {vendorPackage.items.map((item) => (
                                            <div
                                                key={item.id}
                                                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                                            >
                                                <p className="font-medium text-slate-800">
                                                    {item.itemType?.name || 'Item type'}
                                                </p>
                                                <p className="mt-0.5 text-xs text-slate-500">
                                                    Required qty: {item.requiredQty}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            );
                        })}
                    </div>
                )}
            </div>
        </VendorLayout>
    );
}