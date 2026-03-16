import { useEffect, useState } from 'react';
import { Button, Select, Table } from 'flowbite-react';
import toast from 'react-hot-toast';
import AdminLayout from '../../components/layout/AdminLayout';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import {
    getFraudAlerts,
    getFraudSummary,
    reviewFraudAlert,
    type FraudSummary,
} from '../../api/fraud';
import type { FraudAlert, FraudAlertStatus, FraudAlertType } from '../../types';
import { formatDate } from '../../utils/format';

const statusOptions: Array<{ value: '' | FraudAlertStatus; label: string }> = [
    { value: '', label: 'All statuses' },
    { value: 'open', label: 'Open' },
    { value: 'under_review', label: 'Under review' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'dismissed', label: 'Dismissed' },
];

const typeOptions: Array<{ value: '' | FraudAlertType; label: string }> = [
    { value: '', label: 'All types' },
    { value: 'booking_risk', label: 'Booking Risk' },
    { value: 'off_platform_message', label: 'Off-platform Message' },
    { value: 'vendor_kyc', label: 'Vendor KYC' },
    { value: 'dispute', label: 'Dispute' },
    { value: 'low_rating_vendor', label: 'Low Rating Vendor' },
    { value: 'ip_reuse', label: 'IP Reuse' },
    { value: 'cancellation_pattern', label: 'Cancellation Pattern' },
    { value: 'unusual_booking_frequency', label: 'Unusual Booking Frequency' },
];

export default function FraudAlertsPage() {
    const [loading, setLoading] = useState(true);
    const [alerts, setAlerts] = useState<FraudAlert[]>([]);
    const [summary, setSummary] = useState<FraudSummary | null>(null);
    const [statusFilter, setStatusFilter] = useState<'' | FraudAlertStatus>('');
    const [typeFilter, setTypeFilter] = useState<'' | FraudAlertType>('');
    const [reviewingAlertId, setReviewingAlertId] = useState<string | null>(null);

    const load = async () => {
        const [summaryResponse, alertsResponse] = await Promise.all([
            getFraudSummary(),
            getFraudAlerts({
                status: statusFilter || undefined,
                type: typeFilter || undefined,
            }),
        ]);

        setSummary(summaryResponse);
        setAlerts(alertsResponse);
    };

    useEffect(() => {
        setLoading(true);
        load()
            .catch(() => {
                toast.error('Failed to load fraud alerts.');
            })
            .finally(() => setLoading(false));
    }, [statusFilter, typeFilter]);

    const handleReview = async (alertId: string, status: FraudAlertStatus) => {
        setReviewingAlertId(alertId);
        try {
            const note =
                status === 'resolved' || status === 'dismissed'
                    ? window.prompt('Resolution note (optional):') || undefined
                    : undefined;
            await reviewFraudAlert(alertId, status, note);
            toast.success('Alert updated.');
            await load();
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to update alert.');
        } finally {
            setReviewingAlertId(null);
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
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl font-semibold text-slate-800">Fraud Alerts</h1>
                    <p className="mt-2 text-sm text-slate-600">
                        Monitor flagged bookings, messages, and risk events.
                    </p>
                </div>
            </div>

            <div className="mb-4 grid gap-3 md:grid-cols-4">
                <div className="rounded border border-slate-200 bg-white p-3">
                    <p className="text-xs text-slate-500">Total Alerts</p>
                    <p className="text-2xl font-bold text-slate-800">{summary?.total || 0}</p>
                </div>
                <div className="rounded border border-slate-200 bg-white p-3">
                    <p className="text-xs text-slate-500">Open</p>
                    <p className="text-2xl font-bold text-slate-800">{summary?.open || 0}</p>
                </div>
                <div className="rounded border border-slate-200 bg-white p-3">
                    <p className="text-xs text-slate-500">Under Review</p>
                    <p className="text-2xl font-bold text-slate-800">{summary?.underReview || 0}</p>
                </div>
                <div className="rounded border border-slate-200 bg-white p-3">
                    <p className="text-xs text-slate-500">High Priority</p>
                    <p className="text-2xl font-bold text-slate-800">{summary?.highPriority || 0}</p>
                </div>
            </div>

            <div className="mb-4 grid gap-4 md:grid-cols-2">
                <Select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as '' | FraudAlertStatus)}
                >
                    {statusOptions.map((option) => (
                        <option key={option.value || 'all'} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </Select>

                <Select
                    value={typeFilter}
                    onChange={(event) => setTypeFilter(event.target.value as '' | FraudAlertType)}
                >
                    {typeOptions.map((option) => (
                        <option key={option.value || 'all'} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </Select>
            </div>

            <div className="overflow-x-auto rounded-xl shadow">
                <Table striped>
                    <Table.Head>
                        <Table.HeadCell>Created</Table.HeadCell>
                        <Table.HeadCell>Severity</Table.HeadCell>
                        <Table.HeadCell>Type</Table.HeadCell>
                        <Table.HeadCell>Alert</Table.HeadCell>
                        <Table.HeadCell>Status</Table.HeadCell>
                        <Table.HeadCell>Actions</Table.HeadCell>
                    </Table.Head>
                    <Table.Body>
                        {alerts.map((alert) => (
                            <Table.Row key={alert.id} className="text-sm">
                                <Table.Cell>{formatDate(alert.createdAt)}</Table.Cell>
                                <Table.Cell>
                                    <span className="capitalize">{alert.severity.replace('_', ' ')}</span>
                                </Table.Cell>
                                <Table.Cell>
                                    <span className="capitalize">{alert.type.replace(/_/g, ' ')}</span>
                                </Table.Cell>
                                <Table.Cell>
                                    <p className="font-semibold text-slate-900">{alert.title}</p>
                                    <p className="text-slate-600">{alert.description}</p>
                                </Table.Cell>
                                <Table.Cell>
                                    <span className="capitalize">{alert.status.replace('_', ' ')}</span>
                                </Table.Cell>
                                <Table.Cell>
                                    <div className="flex flex-wrap gap-2">
                                        {alert.status === 'open' && (
                                            <Button
                                                size="xs"
                                                color="warning"
                                                onClick={() => handleReview(alert.id, 'under_review')}
                                                isProcessing={reviewingAlertId === alert.id}
                                                disabled={reviewingAlertId === alert.id}
                                            >
                                                Review
                                            </Button>
                                        )}
                                        {alert.status !== 'resolved' && (
                                            <Button
                                                size="xs"
                                                color="success"
                                                onClick={() => handleReview(alert.id, 'resolved')}
                                                isProcessing={reviewingAlertId === alert.id}
                                                disabled={reviewingAlertId === alert.id}
                                            >
                                                Resolve
                                            </Button>
                                        )}
                                        {alert.status !== 'dismissed' && (
                                            <Button
                                                size="xs"
                                                color="gray"
                                                onClick={() => handleReview(alert.id, 'dismissed')}
                                                isProcessing={reviewingAlertId === alert.id}
                                                disabled={reviewingAlertId === alert.id}
                                            >
                                                Dismiss
                                            </Button>
                                        )}
                                    </div>
                                </Table.Cell>
                            </Table.Row>
                        ))}
                    </Table.Body>
                </Table>
            </div>
        </AdminLayout>
    );
}
