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

const DEFAULT_SETTINGS: KycSettings = {
    vendorRegistrationEnabled: true,
    requireOtpBeforeVendorRegistration: true,
};

const DEFAULT_FEATURE_FLAGS: FeatureFlagsSettings = {
    defaultPlatformCommissionRatePercent: 10,
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

        if (
            !Number.isFinite(parsedCommissionPercent) ||
            parsedCommissionPercent < 0 ||
            parsedCommissionPercent > 100
        ) {
            toast.error('Platform fee must be a number between 0 and 100.');
            return;
        }

        setSavingFeatureFlags(true);
        try {
            const updated = await updateFeatureFlagsSettings({
                defaultPlatformCommissionRatePercent: Number(
                    parsedCommissionPercent.toFixed(2),
                ),
                launchNoCommissionEnabled: featureFlags.launchNoCommissionEnabled,
                launchNoCommissionUntil: featureFlags.launchNoCommissionUntil || null,
                cancellationFullRefundMinDays: Math.max(0, Math.round(Number(featureFlags.cancellationFullRefundMinDays))),
                cancellationHalfRefundMinDays: Math.max(0, Math.round(Number(featureFlags.cancellationHalfRefundMinDays))),
                cancellationHalfRefundPercent: Number(Number(featureFlags.cancellationHalfRefundPercent).toFixed(2)),
            });

            setFeatureFlags({
                ...updated,
                launchNoCommissionUntil: toDateInputValue(
                    updated.launchNoCommissionUntil,
                ),
            });

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
                            <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-800">
                                <input
                                    type="checkbox"
                                    className="h-5 w-5 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                                    checked={featureFlags.launchNoCommissionEnabled}
                                    onChange={(event) =>
                                        setFeatureFlags((current) => ({
                                            ...current,
                                            launchNoCommissionEnabled: event.target.checked,
                                        }))
                                    }
                                />
                                Enabled
                            </label>
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
