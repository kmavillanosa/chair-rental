import { useEffect, useState } from 'react';
import { Table } from 'flowbite-react';
import VendorLayout from '../../components/layout/VendorLayout';
import { getMyPayments } from '../../api/payments';
import type { VendorPayment } from '../../types';
import { PaymentStatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatDate } from '../../utils/format';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useTranslation } from 'react-i18next';

export default function VendorPayments() {
  const { t } = useTranslation();
  const [payments, setPayments] = useState<VendorPayment[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { getMyPayments().then(setPayments).finally(() => setLoading(false)); }, []);

  if (loading) return <VendorLayout><LoadingSpinner /></VendorLayout>;

  const overdue = payments.filter(p => p.status === 'overdue');

  return (
    <VendorLayout>
      <h1 className="text-4xl font-bold text-gray-900 mb-6">💰 {t('vendorPaymentsPage.title')}</h1>
      {overdue.length > 0 && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-lg text-xl">
          ❌ {t('vendorPaymentsPage.overdueBanner', {
            count: overdue.length,
            amount: formatCurrency(overdue.reduce((s, p) => s + p.amount, 0)),
          })}
        </div>
      )}
      <div className="overflow-x-auto rounded-xl shadow">
        <Table striped>
          <Table.Head>
            <Table.HeadCell className="text-lg">{t('common.period')}</Table.HeadCell>
            <Table.HeadCell className="text-lg">{t('common.amount')}</Table.HeadCell>
            <Table.HeadCell className="text-lg">{t('common.dueDate')}</Table.HeadCell>
            <Table.HeadCell className="text-lg">{t('common.status')}</Table.HeadCell>
            <Table.HeadCell className="text-lg">{t('common.paidAt')}</Table.HeadCell>
          </Table.Head>
          <Table.Body>
            {payments.map(p => (
              <Table.Row key={p.id} className="text-lg">
                <Table.Cell>{p.period || t('common.na')}</Table.Cell>
                <Table.Cell className="font-semibold">{formatCurrency(p.amount)}</Table.Cell>
                <Table.Cell>{formatDate(p.dueDate)}</Table.Cell>
                <Table.Cell><PaymentStatusBadge status={p.status} /></Table.Cell>
                <Table.Cell>{p.paidAt ? formatDate(p.paidAt) : t('vendorPaymentsPage.emptyPaidAt')}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </div>
    </VendorLayout>
  );
}
