import { useEffect, useState } from 'react';
import { Table } from 'flowbite-react';
import VendorLayout from '../../components/layout/VendorLayout';
import { getMyPayments, getMyPayouts } from '../../api/payments';
import type { VendorPayment, VendorPayout } from '../../types';
import { PaymentStatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatDate } from '../../utils/format';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export default function VendorPayments() {
  const [payments, setPayments] = useState<VendorPayment[]>([]);
  const [payouts, setPayouts] = useState<VendorPayout[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    Promise.all([getMyPayments().then(setPayments), getMyPayouts().then(setPayouts)])
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <VendorLayout><LoadingSpinner /></VendorLayout>;

  const overdue = payments.filter(p => p.status === 'overdue');

  return (
    <VendorLayout>
      <h1 className="mb-4 text-xl font-semibold text-slate-800">Payments</h1>
      {overdue.length > 0 && (
        <div className="mb-4 rounded border-l-4 border-red-400 bg-red-50 p-3 text-sm text-red-700">
          You have {overdue.length} overdue payment(s) totaling {formatCurrency(overdue.reduce((s, p) => s + p.amount, 0))}.
          Please contact the administrator to resolve this.
        </div>
      )}
      <div className="overflow-x-auto rounded-xl shadow">
        <Table striped>
          <Table.Head>
            <Table.HeadCell>Period</Table.HeadCell>
            <Table.HeadCell>Amount</Table.HeadCell>
            <Table.HeadCell>Due Date</Table.HeadCell>
            <Table.HeadCell>Status</Table.HeadCell>
            <Table.HeadCell>Paid At</Table.HeadCell>
          </Table.Head>
          <Table.Body>
            {payments.map(p => (
              <Table.Row key={p.id} className="text-sm">
                <Table.Cell>{p.period || 'N/A'}</Table.Cell>
                <Table.Cell className="font-semibold">{formatCurrency(p.amount)}</Table.Cell>
                <Table.Cell>{formatDate(p.dueDate)}</Table.Cell>
                <Table.Cell><PaymentStatusBadge status={p.status} /></Table.Cell>
                <Table.Cell>{p.paidAt ? formatDate(p.paidAt) : '—'}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </div>

      <h2 className="mt-6 mb-3 text-base font-semibold text-slate-800">Payout Queue</h2>
      <div className="overflow-x-auto rounded-xl shadow">
        <Table striped>
          <Table.Head>
            <Table.HeadCell>Booking</Table.HeadCell>
            <Table.HeadCell>Net Amount</Table.HeadCell>
            <Table.HeadCell>Outstanding</Table.HeadCell>
            <Table.HeadCell>Release On</Table.HeadCell>
            <Table.HeadCell>Status</Table.HeadCell>
          </Table.Head>
          <Table.Body>
            {payouts.map((payout) => (
              <Table.Row key={payout.id} className="text-sm">
                <Table.Cell>{payout.bookingId.slice(0, 8)}...</Table.Cell>
                <Table.Cell className="font-semibold">{formatCurrency(payout.netAmount)}</Table.Cell>
                <Table.Cell>{formatCurrency(payout.outstandingBalanceAmount)}</Table.Cell>
                <Table.Cell>{payout.releaseOn ? formatDate(payout.releaseOn) : 'Immediate'}</Table.Cell>
                <Table.Cell className="capitalize">{payout.status.replace('_', ' ')}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </div>
    </VendorLayout>
  );
}
