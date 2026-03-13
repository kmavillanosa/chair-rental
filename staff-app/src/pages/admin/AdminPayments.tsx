import { useEffect, useState } from 'react';
import { Button, Modal, Select, Table, TextInput } from 'flowbite-react';
import toast from 'react-hot-toast';
import AdminLayout from '../../components/layout/AdminLayout';
import { createPayment, getAllPayments, markPaid, markOverdue } from '../../api/payments';
import { getAllVendors } from '../../api/vendors';
import type { Vendor, VendorPayment } from '../../types';
import { PaymentStatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatDate } from '../../utils/format';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export default function AdminPayments() {
  const [payments, setPayments] = useState<VendorPayment[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    vendorId: '',
    amount: '',
    dueDate: '',
    period: '',
  });

  const load = () => Promise.all([
    getAllPayments().then(setPayments),
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

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-4xl font-bold text-slate-900">Vendor Payments</h1>
        <Button size="lg" className="!bg-slate-800 hover:!bg-slate-900" onClick={() => setShowCreateModal(true)}>
          + Add Payment
        </Button>
      </div>
      <div className="overflow-x-auto rounded-xl shadow">
        <Table striped>
          <Table.Head>
            <Table.HeadCell className="text-lg">Vendor</Table.HeadCell>
            <Table.HeadCell className="text-lg">Amount</Table.HeadCell>
            <Table.HeadCell className="text-lg">Due Date</Table.HeadCell>
            <Table.HeadCell className="text-lg">Status</Table.HeadCell>
            <Table.HeadCell className="text-lg">Actions</Table.HeadCell>
          </Table.Head>
          <Table.Body>
            {payments.map(p => (
              <Table.Row key={p.id} className="text-lg">
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
