import { useEffect, useState } from 'react';
import { Button, Modal, Select, Table, TextInput } from 'flowbite-react';
import toast from 'react-hot-toast';
import AdminLayout from '../../components/layout/AdminLayout';
import {
  createPayment,
  getAllPayments,
  getAllPayouts,
  markPaid,
  markOverdue,
  releasePayout,
} from '../../api/payments';
import { getAllVendors } from '../../api/vendors';
import type { Vendor, VendorPayment, VendorPayout } from '../../types';
import { PaymentStatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatDate } from '../../utils/format';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export default function AdminPayments() {
  const [payments, setPayments] = useState<VendorPayment[]>([]);
  const [payouts, setPayouts] = useState<VendorPayout[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [releasingPayoutId, setReleasingPayoutId] = useState<string | null>(null);
  const [form, setForm] = useState({
    vendorId: '',
    amount: '',
    dueDate: '',
    period: '',
  });

  const load = () => Promise.all([
    getAllPayments().then(setPayments),
    getAllPayouts().then(setPayouts),
    getAllVendors().then(setVendors),
  ]).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    const amount = Number(form.amount);
    if (!form.vendorId || !Number.isFinite(amount) || amount <= 0 || !form.dueDate) {
      toast.error('Vendor, amount, and due date are required.');
      return;
    }

    setSubmitting(true);
    try {
      await createPayment({
        vendorId: form.vendorId,
        amount,
        dueDate: form.dueDate,
        period: form.period.trim() || undefined,
      });
      toast.success('Payment record created.');
      setShowCreateModal(false);
      setForm({ vendorId: '', amount: '', dueDate: '', period: '' });
      load();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to create payment record.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <AdminLayout><LoadingSpinner /></AdminLayout>;

  const handleReleasePayout = async (payout: VendorPayout) => {
    setReleasingPayoutId(payout.id);
    try {
      await releasePayout(payout.id);
      toast.success('Payout released successfully.');
      await load();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to release payout.');
    } finally {
      setReleasingPayoutId(null);
    }
  };

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-800">Payments and Payouts</h1>
        <Button size="sm" className="!bg-slate-800 hover:!bg-slate-900" onClick={() => setShowCreateModal(true)}>
          + Add Payment
        </Button>
      </div>

      <h2 className="mb-3 text-base font-semibold text-slate-800">Billing Records</h2>
      <div className="overflow-x-auto rounded-xl shadow">
        <Table striped>
          <Table.Head>
            <Table.HeadCell>Vendor</Table.HeadCell>
            <Table.HeadCell>Amount</Table.HeadCell>
            <Table.HeadCell>Due Date</Table.HeadCell>
            <Table.HeadCell>Status</Table.HeadCell>
            <Table.HeadCell>Actions</Table.HeadCell>
          </Table.Head>
          <Table.Body>
            {payments.map(p => (
              <Table.Row key={p.id} className="text-sm">
                <Table.Cell>{p.vendor?.businessName}</Table.Cell>
                <Table.Cell className="font-semibold">{formatCurrency(p.amount)}</Table.Cell>
                <Table.Cell>{formatDate(p.dueDate)}</Table.Cell>
                <Table.Cell><PaymentStatusBadge status={p.status} /></Table.Cell>
                <Table.Cell>
                  <div className="flex gap-2">
                    {p.status !== 'paid' && (
                      <Button size="sm" color="light" className="!border-emerald-200 !bg-emerald-50 !text-emerald-800 hover:!bg-emerald-100" onClick={() => markPaid(p.id).then(() => { toast.success('Marked paid!'); load(); })}>Mark Paid</Button>
                    )}
                    {p.status === 'pending' && (
                      <Button size="sm" color="light" className="!border-rose-200 !bg-rose-50 !text-rose-700 hover:!bg-rose-100" onClick={() => markOverdue(p.id).then(() => { toast.success('Marked overdue!'); load(); })}>Mark Overdue</Button>
                    )}
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </div>

      <h2 className="mb-3 mt-6 text-base font-semibold text-slate-800">Vendor Payout Queue</h2>
      <div className="overflow-x-auto rounded-xl shadow">
        <Table striped>
          <Table.Head>
            <Table.HeadCell>Vendor</Table.HeadCell>
            <Table.HeadCell>Booking</Table.HeadCell>
            <Table.HeadCell>Net Amount</Table.HeadCell>
            <Table.HeadCell>Outstanding</Table.HeadCell>
            <Table.HeadCell>Release On</Table.HeadCell>
            <Table.HeadCell>Status</Table.HeadCell>
            <Table.HeadCell>Actions</Table.HeadCell>
          </Table.Head>
          <Table.Body>
            {payouts.map((payout) => (
              <Table.Row key={payout.id} className="text-sm">
                <Table.Cell>{payout.vendor?.businessName || payout.vendorId}</Table.Cell>
                <Table.Cell>{payout.bookingId.slice(0, 8)}...</Table.Cell>
                <Table.Cell className="font-semibold">{formatCurrency(payout.netAmount)}</Table.Cell>
                <Table.Cell>{formatCurrency(payout.outstandingBalanceAmount)}</Table.Cell>
                <Table.Cell>{payout.releaseOn ? formatDate(payout.releaseOn) : 'Immediate'}</Table.Cell>
                <Table.Cell className="capitalize">{payout.status.replace('_', ' ')}</Table.Cell>
                <Table.Cell>
                  {payout.status === 'ready' ? (
                    <Button
                      size="sm"
                      color="success"
                      onClick={() => handleReleasePayout(payout)}
                      isProcessing={releasingPayoutId === payout.id}
                      disabled={releasingPayoutId === payout.id}
                    >
                      Release
                    </Button>
                  ) : (
                    <span className="text-sm text-slate-500">No action</span>
                  )}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </div>

      <Modal show={showCreateModal} onClose={() => !submitting && setShowCreateModal(false)}>
        <Modal.Header>Add Payment</Modal.Header>
        <Modal.Body className="space-y-4">
          <Select
            value={form.vendorId}
            onChange={(event) => setForm((current) => ({ ...current, vendorId: event.target.value }))}
          >
            <option value="">Select Vendor</option>
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>{vendor.businessName}</option>
            ))}
          </Select>
          <TextInput
            type="number"
            min={0}
            step="0.01"
            placeholder="Amount"
            value={form.amount}
            onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
            sizing="lg"
          />
          <TextInput
            type="date"
            value={form.dueDate}
            onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))}
            sizing="lg"
          />
          <TextInput
            placeholder="Period (optional)"
            value={form.period}
            onChange={(event) => setForm((current) => ({ ...current, period: event.target.value }))}
            sizing="lg"
          />
        </Modal.Body>
        <Modal.Footer>
          <Button size="lg" onClick={handleCreate} isProcessing={submitting} disabled={submitting}>Save</Button>
          <Button color="gray" size="lg" onClick={() => setShowCreateModal(false)} disabled={submitting}>Cancel</Button>
        </Modal.Footer>
      </Modal>
    </AdminLayout>
  );
}
