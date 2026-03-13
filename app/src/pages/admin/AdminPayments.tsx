import { useEffect, useState } from 'react';
import { Button, Table } from 'flowbite-react';
import toast from 'react-hot-toast';
import AdminLayout from '../../components/layout/AdminLayout';
import { getAllPayments, markPaid, markOverdue } from '../../api/payments';
import type { VendorPayment } from '../../types';
import { PaymentStatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatDate } from '../../utils/format';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useTranslation } from 'react-i18next';

export default function AdminPayments() {
  const { t } = useTranslation();
  const [payments, setPayments] = useState<VendorPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const load = () => getAllPayments().then(setPayments).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  if (loading) return <AdminLayout><LoadingSpinner /></AdminLayout>;

  return (
    <AdminLayout>
      <h1 className="text-4xl font-bold text-gray-900 mb-6">💰 {t('adminPayments.title')}</h1>
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
    </AdminLayout>
  );
}
