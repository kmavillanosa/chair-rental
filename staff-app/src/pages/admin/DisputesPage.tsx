import { useEffect, useMemo, useState } from 'react';
import { Button, Modal, Select, Table, TextInput } from 'flowbite-react';
import toast from 'react-hot-toast';
import AdminLayout from '../../components/layout/AdminLayout';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { getAdminDisputes, reviewDispute } from '../../api/disputes';
import type {
    BookingDispute,
    BookingDisputeOutcome,
    BookingDisputeStatus,
} from '../../types';
import { formatCurrency, formatDate } from '../../utils/format';

const statusOptions: Array<{ value: '' | BookingDisputeStatus; label: string }> = [
    { value: '', label: 'All statuses' },
    { value: 'open', label: 'Open' },
    { value: 'under_review', label: 'Under review' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'rejected', label: 'Rejected' },
];

export default function DisputesPage() {
    const [loading, setLoading] = useState(true);
    const [disputes, setDisputes] = useState<BookingDispute[]>([]);
    const [statusFilter, setStatusFilter] = useState<'' | BookingDisputeStatus>('');
    const [selectedDispute, setSelectedDispute] = useState<BookingDispute | null>(null);
    const [resolving, setResolving] = useState(false);
    const [resolutionOutcome, setResolutionOutcome] =
        useState<BookingDisputeOutcome>('release_payment_to_vendor');
    const [resolutionNote, setResolutionNote] = useState('');
    const [refundAmount, setRefundAmount] = useState('');

    const load = async () => {
        const response = await getAdminDisputes(statusFilter || undefined);
        setDisputes(response);
    };

    useEffect(() => {
        setLoading(true);
        load()
            .catch(() => toast.error('Failed to load disputes.'))
            .finally(() => setLoading(false));
    }, [statusFilter]);

    const openCount = useMemo(
        () => disputes.filter((dispute) => dispute.status === 'open').length,
        [disputes],
    );

    const underReviewCount = useMemo(
        () => disputes.filter((dispute) => dispute.status === 'under_review').length,
        [disputes],
    );

    const handleResolve = async () => {
        if (!selectedDispute) return;

        setResolving(true);
        try {
            await reviewDispute(selectedDispute.id, {
                outcome: resolutionOutcome,
                resolutionNote: resolutionNote.trim() || undefined,
                refundAmount:
                    resolutionOutcome === 'partial_refund'
                        ? Number(refundAmount)
                        : resolutionOutcome === 'refund_customer'
                            ? Number(refundAmount || selectedDispute.booking?.totalPaidAmount || 0)
                            : undefined,
            });

            toast.success('Dispute resolution saved.');
            setSelectedDispute(null);
            setResolutionNote('');
            setRefundAmount('');
            await load();
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to resolve dispute.');
        } finally {
            setResolving(false);
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
                    <h1 className="text-xl font-semibold text-slate-800">Disputes</h1>
                    <p className="mt-2 text-sm text-slate-600">
                        Review customer-vendor disputes and issue decisions.
                    </p>
                </div>
            </div>

            <div className="mb-4 grid gap-3 md:grid-cols-3">
                <div className="rounded border border-slate-200 bg-white p-3">
                    <p className="text-xs text-slate-500">Total</p>
                    <p className="text-2xl font-bold text-slate-800">{disputes.length}</p>
                </div>
                <div className="rounded border border-slate-200 bg-white p-3">
                    <p className="text-xs text-slate-500">Open</p>
                    <p className="text-2xl font-bold text-slate-800">{openCount}</p>
                </div>
                <div className="rounded border border-slate-200 bg-white p-3">
                    <p className="text-xs text-slate-500">Under Review</p>
                    <p className="text-2xl font-bold text-slate-800">{underReviewCount}</p>
                </div>
            </div>

            <div className="mb-4 max-w-sm">
                <Select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as '' | BookingDisputeStatus)}
                >
                    {statusOptions.map((option) => (
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
                        <Table.HeadCell>Booking</Table.HeadCell>
                        <Table.HeadCell>Opened By</Table.HeadCell>
                        <Table.HeadCell>Reason</Table.HeadCell>
                        <Table.HeadCell>Status</Table.HeadCell>
                        <Table.HeadCell>Actions</Table.HeadCell>
                    </Table.Head>
                    <Table.Body>
                        {disputes.map((dispute) => (
                            <Table.Row key={dispute.id} className="text-sm">
                                <Table.Cell>{formatDate(dispute.createdAt)}</Table.Cell>
                                <Table.Cell>{dispute.bookingId.slice(0, 8)}...</Table.Cell>
                                <Table.Cell className="capitalize">{dispute.openedByRole}</Table.Cell>
                                <Table.Cell>{dispute.reason}</Table.Cell>
                                <Table.Cell>
                                    <span className="capitalize">{dispute.status.replace('_', ' ')}</span>
                                </Table.Cell>
                                <Table.Cell>
                                    {['open', 'under_review'].includes(dispute.status) ? (
                                        <Button
                                            size="xs"
                                            color="warning"
                                            onClick={() => {
                                                setSelectedDispute(dispute);
                                                setResolutionOutcome('release_payment_to_vendor');
                                                setResolutionNote('');
                                                setRefundAmount('');
                                            }}
                                        >
                                            Resolve
                                        </Button>
                                    ) : (
                                        <div className="space-y-1 text-xs text-slate-600">
                                            <p className="capitalize">{dispute.outcome?.replace(/_/g, ' ') || 'N/A'}</p>
                                            {dispute.refundAmount ? (
                                                <p>Refund: {formatCurrency(dispute.refundAmount)}</p>
                                            ) : null}
                                        </div>
                                    )}
                                </Table.Cell>
                            </Table.Row>
                        ))}
                    </Table.Body>
                </Table>
            </div>

            <Modal show={Boolean(selectedDispute)} onClose={() => !resolving && setSelectedDispute(null)}>
                <Modal.Header>Resolve Dispute</Modal.Header>
                <Modal.Body className="space-y-4">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                        {selectedDispute?.reason}
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-800">
                            Resolution Outcome
                        </label>
                        <Select
                            value={resolutionOutcome}
                            onChange={(event) =>
                                setResolutionOutcome(event.target.value as BookingDisputeOutcome)
                            }
                        >
                            <option value="release_payment_to_vendor">Release payment to vendor</option>
                            <option value="refund_customer">Refund customer</option>
                            <option value="partial_refund">Partial refund</option>
                        </Select>
                    </div>

                    {(resolutionOutcome === 'partial_refund' ||
                        resolutionOutcome === 'refund_customer') && (
                            <div>
                                <label className="mb-2 block text-sm font-semibold text-slate-800">
                                    Refund Amount
                                </label>
                                <TextInput
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={refundAmount}
                                    onChange={(event) => setRefundAmount(event.target.value)}
                                />
                            </div>
                        )}

                    <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-800">
                            Resolution Note
                        </label>
                        <TextInput
                            value={resolutionNote}
                            onChange={(event) => setResolutionNote(event.target.value)}
                            placeholder="Optional notes for audit trail"
                        />
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        onClick={handleResolve}
                        isProcessing={resolving}
                        disabled={resolving}
                    >
                        Save Resolution
                    </Button>
                    <Button color="gray" onClick={() => setSelectedDispute(null)} disabled={resolving}>
                        Cancel
                    </Button>
                </Modal.Footer>
            </Modal>
        </AdminLayout>
    );
}
