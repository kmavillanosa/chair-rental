import { useEffect, useState } from 'react';
import { Button, TextInput } from 'flowbite-react';
import toast from 'react-hot-toast';
import AdminLayout from '../../components/layout/AdminLayout';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import {
    getFeatureFlagsSettings,
    getKycSettings,
    updateFeatureFlagsSettings,
    updateKycSettings,
    type FeatureFlagsSettings,
    type KycSettings,
} from '../../api/settings';

function FeatureFlagSwitch({
    checked,
    onChange,
}: {
    checked: boolean;
    onChange: (checked: boolean) => void;
}) {
    return (
        <div className="flex items-center gap-3">
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                onClick={() => onChange(!checked)}
                className={`relative inline-flex h-7 w-14 items-center rounded-full border transition ${checked
                    ? 'border-emerald-600 bg-emerald-500'
                    : 'border-slate-300 bg-slate-200'
                    }`}
            >
                <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition ${checked ? 'translate-x-8' : 'translate-x-1'
                        }`}
                />
            </button>
            <span className="text-sm font-medium text-slate-700">
                {checked ? 'Enabled' : 'Disabled'}
            </span>
        </div>
    );
}

const DEFAULT_SETTINGS: KycSettings = {
    vendorRegistrationEnabled: true,
    requireOtpBeforeVendorRegistration: true,
};

const DEFAULT_FEATURE_FLAGS: FeatureFlagsSettings = {
    allowOrdersWithoutPayment: false,
    maintenanceModeEnabled: false,
    showTestVendorsOnCustomerMap: false,
    defaultPlatformCommissionRatePercent: 10,
    defaultDepositPercent: 30,
    newVendorCompletedOrdersThreshold: 5,
    newVendorMaxActiveListings: 40,
    flaggedVendorMaxActiveListings: 15,
    payoutDelayDaysForNewVendors: 3,
    launchNoCommissionEnabled: false,
    launchNoCommissionUntil: null,
    cancellationFullRefundMinDays: 3,
    cancellationHalfRefundMinDays: 1,
    cancellationHalfRefundPercent: 50,
};

const toDateInputValue = (value: string | null) => {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toISOString().split('T')[0];
};

export default function KycSettingsPage() {
    const [loading, setLoading] = useState(true);
    const [savingKyc, setSavingKyc] = useState(false);
    const [savingFeatureFlags, setSavingFeatureFlags] = useState(false);
    const [settings, setSettings] = useState<KycSettings>(DEFAULT_SETTINGS);
    const [featureFlags, setFeatureFlags] =
        useState<FeatureFlagsSettings>(DEFAULT_FEATURE_FLAGS);

    useEffect(() => {
        Promise.all([getKycSettings(), getFeatureFlagsSettings()])
            .then(([kycResponse, featureFlagsResponse]) => {
                setSettings(kycResponse);
                setFeatureFlags({
                    ...DEFAULT_FEATURE_FLAGS,
                    ...featureFlagsResponse,
                    launchNoCommissionUntil: toDateInputValue(
                        featureFlagsResponse.launchNoCommissionUntil,
                    ),
                });
            })
            .catch(() => {
                toast.error('Failed to load platform settings.');
            })
            .finally(() => setLoading(false));
    }, []);

    const handleSaveKycSettings = async () => {
        setSavingKyc(true);
        try {
            const updated = await updateKycSettings(settings);
            setSettings(updated);
            toast.success('KYC settings saved.');
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to save KYC settings.');
        } finally {
            setSavingKyc(false);
        }
    };

    const handleSaveFeatureFlags = async () => {
        const parsedCommissionPercent = Number(
            featureFlags.defaultPlatformCommissionRatePercent,
        );
        const parsedDepositPercent = Number(featureFlags.defaultDepositPercent);
        const parsedCompletedThreshold = Math.max(
            0,
            Math.round(Number(featureFlags.newVendorCompletedOrdersThreshold)),
        );
        const parsedNewVendorMaxListings = Math.max(
            1,
            Math.round(Number(featureFlags.newVendorMaxActiveListings)),
        );
        const parsedFlaggedVendorMaxListings = Math.max(
            1,
            Math.round(Number(featureFlags.flaggedVendorMaxActiveListings)),
        );
        const parsedPayoutDelayDays = Math.max(
            0,
            Math.round(Number(featureFlags.payoutDelayDaysForNewVendors)),
        );

        if (
            !Number.isFinite(parsedCommissionPercent) ||
            parsedCommissionPercent < 0 ||
            parsedCommissionPercent > 100
        ) {
            toast.error('Platform fee must be a number between 0 and 100.');
            return;
        }

        if (
            !Number.isFinite(parsedDepositPercent) ||
            parsedDepositPercent <= 0 ||
            parsedDepositPercent > 100
        ) {
            toast.error('Default deposit percent must be greater than 0 and at most 100.');
            return;
        }

        setSavingFeatureFlags(true);
        try {
            const updated = await updateFeatureFlagsSettings({
                allowOrdersWithoutPayment: featureFlags.allowOrdersWithoutPayment,
                maintenanceModeEnabled: featureFlags.maintenanceModeEnabled,
                defaultPlatformCommissionRatePercent: Number(
                    parsedCommissionPercent.toFixed(2),
                ),
                defaultDepositPercent: Number(parsedDepositPercent.toFixed(2)),
                newVendorCompletedOrdersThreshold: parsedCompletedThreshold,
                newVendorMaxActiveListings: parsedNewVendorMaxListings,
                flaggedVendorMaxActiveListings: parsedFlaggedVendorMaxListings,
                payoutDelayDaysForNewVendors: parsedPayoutDelayDays,
                launchNoCommissionEnabled: featureFlags.launchNoCommissionEnabled,
                launchNoCommissionUntil: featureFlags.launchNoCommissionUntil || null,
                cancellationFullRefundMinDays: Math.max(0, Math.round(Number(featureFlags.cancellationFullRefundMinDays))),
                cancellationHalfRefundMinDays: Math.max(0, Math.round(Number(featureFlags.cancellationHalfRefundMinDays))),
                cancellationHalfRefundPercent: Number(Number(featureFlags.cancellationHalfRefundPercent).toFixed(2)),
            });

            setFeatureFlags({
                ...DEFAULT_FEATURE_FLAGS,
                ...updated,
                launchNoCommissionUntil: toDateInputValue(
                    updated.launchNoCommissionUntil,
                ),
            });
            window.dispatchEvent(
                new CustomEvent('staff-feature-flags-updated', {
                    detail: updated,
                }),
            );

            toast.success('Feature flags saved.');
        } catch (error: any) {
            toast.error(
                error?.response?.data?.message ||
                'Failed to save feature flags.',
            );
        } finally {
            setSavingFeatureFlags(false);
        }
    };

    if (loading) {
        return (
            <AdminLayout>
                <LoadingSpinner />
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <h1 className="mb-8 text-4xl font-bold text-slate-900">Platform Feature Flags</h1>

            <div className="space-y-6">
                <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div>
                        <h2 className="text-2xl font-semibold text-slate-900">Launch Controls</h2>
                        <p className="text-sm text-slate-600">
                            Configure platform fee behavior during launch windows.
                        </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-lg font-semibold text-slate-900">Enable No-Commission Mode</p>
                                <p className="text-sm text-slate-600">
                                    When enabled, bookings apply 0% platform fee while the launch window is active.
                                </p>
                            </div>
                            <FeatureFlagSwitch
                                checked={featureFlags.launchNoCommissionEnabled}
                                onChange={(checked) =>
                                    setFeatureFlags((current) => ({
                                        ...current,
                                        launchNoCommissionEnabled: checked,
                                    }))
                                }
                            />
                        </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-lg font-semibold text-slate-900">Allow Orders Without Paying (Test Mode)</p>
                                <p className="text-sm text-slate-600">
                                    When enabled, customers can submit bookings without being forced into checkout, and vendors or admins can confirm unpaid PayMongo bookings. Keep this disabled in live mode.
                                </p>
                            </div>
                            <FeatureFlagSwitch
                                checked={featureFlags.allowOrdersWithoutPayment}
                                onChange={(checked) =>
                                    setFeatureFlags((current) => ({
                                        ...current,
                                        allowOrdersWithoutPayment: checked,
                                    }))
                                }
                            />
                        </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-lg font-semibold text-slate-900">Maintenance Mode</p>
                                <p className="text-sm text-slate-600">
                                    When enabled, the customer-facing app shows a maintenance notice while staff users still have access with a visible badge.
                                </p>
                            </div>
                            <FeatureFlagSwitch
                                checked={featureFlags.maintenanceModeEnabled}
                                onChange={(checked) =>
                                    setFeatureFlags((current) => ({
                                        ...current,
                                        maintenanceModeEnabled: checked,
                                    }))
                                }
                            />
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <label className="mb-2 block text-sm font-semibold text-slate-800">
                                Launch No-Commission Until
                            </label>
                            <TextInput
                                type="date"
                                value={featureFlags.launchNoCommissionUntil || ''}
                                onChange={(event) =>
                                    setFeatureFlags((current) => ({
                                        ...current,
                                        launchNoCommissionUntil: event.target.value || null,
                                    }))
                                }
                                helperText="Leave empty to keep no-commission mode open-ended while enabled."
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-semibold text-slate-800">
                                Default Platform Fee (%)
                            </label>
                            <TextInput
                                type="number"
                                min={0}
                                max={100}
                                step="0.01"
                                value={String(featureFlags.defaultPlatformCommissionRatePercent)}
                                onChange={(event) =>
                                    setFeatureFlags((current) => ({
                                        ...current,
                                        defaultPlatformCommissionRatePercent: Number(
                                            event.target.value,
                                        ),
                                    }))
                                }
                                helperText="Applied when no-commission mode is disabled or expired."
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-semibold text-slate-800">
                                Default Booking Deposit (%)
                            </label>
                            <TextInput
                                type="number"
                                min={1}
                                max={100}
                                step="0.01"
                                value={String(featureFlags.defaultDepositPercent)}
                                onChange={(event) =>
                                    setFeatureFlags((current) => ({
                                        ...current,
                                        defaultDepositPercent: Number(event.target.value),
                                    }))
                                }
                                helperText="Initial payment required at checkout before booking confirmation."
                            />
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <div>
                            <label className="mb-2 block text-sm font-semibold text-slate-800">
                                New Vendor Completion Threshold
                            </label>
                            <TextInput
                                type="number"
                                min={0}
                                max={500}
                                step="1"
                                value={String(featureFlags.newVendorCompletedOrdersThreshold)}
                                onChange={(event) =>
                                    setFeatureFlags((current) => ({
                                        ...current,
                                        newVendorCompletedOrdersThreshold: Math.max(0, Math.round(Number(event.target.value))),
                                    }))
                                }
                                helperText="Vendors below this completed-order count are treated as new vendors for controls below."
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-semibold text-slate-800">
                                New Vendor Max Listings
                            </label>
                            <TextInput
                                type="number"
                                min={1}
                                max={5000}
                                step="1"
                                value={String(featureFlags.newVendorMaxActiveListings)}
                                onChange={(event) =>
                                    setFeatureFlags((current) => ({
                                        ...current,
                                        newVendorMaxActiveListings: Math.max(1, Math.round(Number(event.target.value))),
                                    }))
                                }
                                helperText="Maximum inventory listings allowed for new vendors."
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-semibold text-slate-800">
                                Flagged Vendor Max Listings
                            </label>
                            <TextInput
                                type="number"
                                min={1}
                                max={5000}
                                step="1"
                                value={String(featureFlags.flaggedVendorMaxActiveListings)}
                                onChange={(event) =>
                                    setFeatureFlags((current) => ({
                                        ...current,
                                        flaggedVendorMaxActiveListings: Math.max(1, Math.round(Number(event.target.value))),
                                    }))
                                }
                                helperText="Maximum listings when a vendor is suspicious or low-rated."
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-semibold text-slate-800">
                                New Vendor Payout Delay (Days)
                            </label>
                            <TextInput
                                type="number"
                                min={0}
                                max={30}
                                step="1"
                                value={String(featureFlags.payoutDelayDaysForNewVendors)}
                                onChange={(event) =>
                                    setFeatureFlags((current) => ({
                                        ...current,
                                        payoutDelayDaysForNewVendors: Math.max(0, Math.round(Number(event.target.value))),
                                    }))
                                }
                                helperText="How long payouts stay held for vendors still within the new-vendor threshold."
                            />
                        </div>
                    </div>

                    <div className="pt-2">
                        <Button
                            size="lg"
                            className="!bg-slate-800 hover:!bg-slate-900"
                            onClick={handleSaveFeatureFlags}
                            isProcessing={savingFeatureFlags}
                            disabled={savingFeatureFlags}
                        >
                            Save Feature Flags
                        </Button>
                    </div>
                </div>

                <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div>
                        <h2 className="text-2xl font-semibold text-slate-900">Cancellation Policy</h2>
                        <p className="text-sm text-slate-600">
                            Configure the day thresholds and refund percentages applied when customers cancel paid bookings.
                        </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                        <div>
                            <label className="mb-2 block text-sm font-semibold text-slate-800">
                                Full Refund Min. Days
                            </label>
                            <TextInput
                                type="number"
                                min={0}
                                max={365}
                                step="1"
                                value={String(featureFlags.cancellationFullRefundMinDays)}
                                onChange={(event) =>
                                    setFeatureFlags((current) => ({
                                        ...current,
                                        cancellationFullRefundMinDays: Math.max(0, Math.round(Number(event.target.value))),
                                    }))
                                }
                                helperText="Days before event start to qualify for a 100% refund."
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-semibold text-slate-800">
                                Partial Refund Min. Days
                            </label>
                            <TextInput
                                type="number"
                                min={0}
                                max={365}
                                step="1"
                                value={String(featureFlags.cancellationHalfRefundMinDays)}
                                onChange={(event) =>
                                    setFeatureFlags((current) => ({
                                        ...current,
                                        cancellationHalfRefundMinDays: Math.max(0, Math.round(Number(event.target.value))),
                                    }))
                                }
                                helperText="Days before event start to qualify for the partial refund."
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-semibold text-slate-800">
                                Partial Refund Percent (%)
                            </label>
                            <TextInput
                                type="number"
                                min={0}
                                max={100}
                                step="0.01"
                                value={String(featureFlags.cancellationHalfRefundPercent)}
                                onChange={(event) =>
                                    setFeatureFlags((current) => ({
                                        ...current,
                                        cancellationHalfRefundPercent: Number(event.target.value),
                                    }))
                                }
                                helperText="Percentage of the paid amount returned for the partial-refund tier."
                            />
                        </div>
                    </div>

                    <div className="pt-2">
                        <Button
                            size="lg"
                            className="!bg-slate-800 hover:!bg-slate-900"
                            onClick={handleSaveFeatureFlags}
                            isProcessing={savingFeatureFlags}
                            disabled={savingFeatureFlags}
                        >
                            Save Feature Flags
                        </Button>
                    </div>
                </div>

                <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div>
                        <h2 className="text-2xl font-semibold text-slate-900">KYC Controls</h2>
                        <p className="text-sm text-slate-600">
                            Manage vendor onboarding policies.
                        </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-lg font-semibold text-slate-900">Allow Customer Vendor Registration</p>
                                <p className="text-sm text-slate-600">
                                    When disabled, customers cannot submit new vendor registration requests.
                                </p>
                            </div>
                            <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-800">
                                <input
                                    type="checkbox"
                                    className="h-5 w-5 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                                    checked={settings.vendorRegistrationEnabled}
                                    onChange={(event) =>
                                        setSettings((current) => ({
                                            ...current,
                                            vendorRegistrationEnabled: event.target.checked,
                                        }))
                                    }
                                />
                                Enabled
                            </label>
                        </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-lg font-semibold text-slate-900">Require OTP Before Vendor Registration</p>
                                <p className="text-sm text-slate-600">
                                    When enabled, customer email OTP verification is required before registration can be submitted.
                                </p>
                            </div>
                            <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-800">
                                <input
                                    type="checkbox"
                                    className="h-5 w-5 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                                    checked={settings.requireOtpBeforeVendorRegistration}
                                    onChange={(event) =>
                                        setSettings((current) => ({
                                            ...current,
                                            requireOtpBeforeVendorRegistration: event.target.checked,
                                        }))
                                    }
                                />
                                Enabled
                            </label>
                        </div>
                    </div>

                    <div className="pt-2">
                        <Button
                            size="lg"
                            className="!bg-slate-800 hover:!bg-slate-900"
                            onClick={handleSaveKycSettings}
                            isProcessing={savingKyc}
                            disabled={savingKyc}
                        >
                            Save KYC Settings
                        </Button>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
