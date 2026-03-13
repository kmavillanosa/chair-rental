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
import { useTranslation } from 'react-i18next';

export default function AdminPayments() {
  const { t } = useTranslation();
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

  const handleCreatePayment = async () => {
    const amount = Number(form.amount);
    if (!form.vendorId || !Number.isFinite(amount) || amount <= 0 || !form.dueDate) {
      toast.error(t('adminPayments.toastCreateRequiredFields'));
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
      toast.success(t('adminPayments.toastCreated'));
      setShowCreateModal(false);
      setForm({ vendorId: '', amount: '', dueDate: '', period: '' });
      load();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t('adminPayments.toastCreateFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <AdminLayout><LoadingSpinner /></AdminLayout>;

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-4xl font-bold text-gray-900">💰 {t('adminPayments.title')}</h1>
        <Button size="xl" onClick={() => setShowCreateModal(true)}>+ {t('adminPayments.addPayment')}</Button>
      </div>
      <div className="overflow-x-auto rounded-xl shadow">
        <Table striped>
          <Table.Head>
            <Table.HeadCell className="text-lg">{t('common.vendor')}</Table.HeadCell>
            <Table.HeadCell className="text-lg">{t('common.amount')}</Table.HeadCell>
            <Table.HeadCell className="text-lg">{t('common.dueDate')}</Table.HeadCell>
            <Table.HeadCell className="text-lg">{t('common.status')}</Table.HeadCell>
            <Table.HeadCell className="text-lg">{t('common.actions')}</Table.HeadCell>
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
                      <Button size="sm" color="success" onClick={() => markPaid(p.id).then(() => { toast.success(t('adminPayments.toastMarkedPaid')); load(); })}>{t('adminPayments.markPaid')}</Button>
                    )}
                    {p.status === 'pending' && (
                      <Button size="sm" color="failure" onClick={() => markOverdue(p.id).then(() => { toast.success(t('adminPayments.toastMarkedOverdue')); load(); })}>{t('adminPayments.markOverdue')}</Button>
                    )}
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </div>

      <Modal show={showCreateModal} onClose={() => !submitting && setShowCreateModal(false)}>
        <Modal.Header>{t('adminPayments.addPayment')}</Modal.Header>
        <Modal.Body className="space-y-4">
          <Select
            value={form.vendorId}
            onChange={(event) => setForm((current) => ({ ...current, vendorId: event.target.value }))}
          >
            <option value="">{t('adminPayments.selectVendor')}</option>
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.businessName}
              </option>
            ))}
          </Select>
          <TextInput
            type="number"
            min={0}
            step="0.01"
            placeholder={t('adminPayments.amountPlaceholder')}
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
            placeholder={t('adminPayments.periodPlaceholder')}
            value={form.period}
            onChange={(event) => setForm((current) => ({ ...current, period: event.target.value }))}
            sizing="lg"
          />
        </Modal.Body>
        <Modal.Footer>
          <Button size="xl" onClick={handleCreatePayment} disabled={submitting} isProcessing={submitting}>
            {t('common.save')}
          </Button>
          <Button color="gray" size="xl" onClick={() => setShowCreateModal(false)} disabled={submitting}>
            {t('common.cancel')}
          </Button>
        </Modal.Footer>
      </Modal>
    </AdminLayout>
  );
}
