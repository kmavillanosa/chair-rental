import { useEffect, useMemo, useState } from 'react';
import { Button, Modal, Select, Table, TextInput } from 'flowbite-react';
import toast from 'react-hot-toast';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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

const PAYMENT_TABS = [
  {
    key: 'overview',
    label: 'Overview',
    description: 'KPIs and high-level payment health',
  },
  {
    key: 'earnings',
    label: 'Rental Partner Earnings',
    description: 'Gross, fee, and release balances per rental partner',
  },
  {
    key: 'billing',
    label: 'Billing Records',
    description: 'Manual billing entries and payment states',
  },
  {
    key: 'payouts',
    label: 'Payout Queue',
    description: 'Upcoming and ready-to-release rental partner payouts',
  },
] as const;

type PaymentTabKey = (typeof PAYMENT_TABS)[number]['key'];
const paymentTabKeys = new Set<PaymentTabKey>(PAYMENT_TABS.map((tab) => tab.key));

export default function AdminPayments() {
  const location = useLocation();
  const navigate = useNavigate();
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

  const activeTab = useMemo<PaymentTabKey>(() => {
    const pathParts = location.pathname.split('/').filter(Boolean);
    const candidate = pathParts[2] as PaymentTabKey | undefined;
    return candidate && paymentTabKeys.has(candidate) ? candidate : 'overview';
  }, [location.pathname]);

  const toAmount = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const formatPayoutDestination = (vendor?: Vendor) => {
    if (!vendor) {
      return 'Not provided';
    }

    const payoutMethod = String(vendor.bankName || '').trim();
    const payoutAccountName = String(vendor.bankAccountName || '').trim();
    const payoutAccountMasked = String(vendor.bankAccountNumberMasked || '').trim() ||
      (vendor.bankAccountLast4 ? `****${vendor.bankAccountLast4}` : '');

    if (!payoutMethod && !payoutAccountName && !payoutAccountMasked) {
      return 'Not provided';
    }

    return [payoutMethod || 'Account', payoutAccountName || 'Unnamed', payoutAccountMasked]
      .filter(Boolean)
      .join(' | ');
  };

  const load = () => Promise.all([
    getAllPayments().then(setPayments),
    getAllPayouts().then(setPayouts),
    getAllVendors().then(setVendors),
  ]).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const pathParts = location.pathname.split('/').filter(Boolean);
    const candidate = pathParts[2] as PaymentTabKey | undefined;

    if (!candidate || !paymentTabKeys.has(candidate)) {
      navigate('/admin/payments/overview', { replace: true });
    }
  }, [location.pathname, navigate]);

  const handleCreate = async () => {
    const amount = Number(form.amount);
    if (!form.vendorId || !Number.isFinite(amount) || amount <= 0 || !form.dueDate) {
      toast.error('Rental Partner, amount, and due date are required.');
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

  const payoutSummary = useMemo(() => {
    const settledStatuses = new Set<VendorPayout['status']>(['held', 'ready', 'released']);
    const reversedStatuses = new Set<VendorPayout['status']>(['refunded', 'cancelled']);

    return payouts.reduce(
      (acc, payout) => {
        const gross = toAmount(payout.grossAmount);
        const platformFee = toAmount(payout.platformFeeAmount);
        const net = toAmount(payout.netAmount);

        if (settledStatuses.has(payout.status)) {
          acc.grossCollected += gross;
          acc.platformAccrued += platformFee;
        }

        if (payout.status === 'held') {
          acc.vendorPending += net;
        }
        if (payout.status === 'ready') {
          acc.vendorReady += net;
          acc.readyCount += 1;
        }
        if (payout.status === 'released') {
          acc.vendorReleased += net;
          acc.releasedCount += 1;
        }
        if (reversedStatuses.has(payout.status)) {
          acc.reversed += net;
        }

        return acc;
      },
      {
        grossCollected: 0,
        platformAccrued: 0,
        vendorPending: 0,
        vendorReady: 0,
        vendorReleased: 0,
        reversed: 0,
        readyCount: 0,
        releasedCount: 0,
      },
    );
  }, [payouts]);

  const vendorEarnings = useMemo(() => {
    const settledStatuses = new Set<VendorPayout['status']>(['held', 'ready', 'released']);
    const byVendor = new Map<
      string,
      {
        vendorId: string;
        vendorName: string;
        grossCollected: number;
        platformAccrued: number;
        pendingBalance: number;
        readyBalance: number;
        releasedTotal: number;
        records: number;
      }
    >();

    for (const payout of payouts) {
      const vendorId = payout.vendorId;
      const vendorName =
        payout.vendor?.businessName ||
        vendors.find((vendor) => vendor.id === vendorId)?.businessName ||
        vendorId;

      if (!byVendor.has(vendorId)) {
        byVendor.set(vendorId, {
          vendorId,
          vendorName,
          grossCollected: 0,
          platformAccrued: 0,
          pendingBalance: 0,
          readyBalance: 0,
          releasedTotal: 0,
          records: 0,
        });
      }

      const row = byVendor.get(vendorId)!;
      const gross = toAmount(payout.grossAmount);
      const platformFee = toAmount(payout.platformFeeAmount);
      const net = toAmount(payout.netAmount);

      row.records += 1;

      if (settledStatuses.has(payout.status)) {
        row.grossCollected += gross;
        row.platformAccrued += platformFee;
      }

      if (payout.status === 'held') {
        row.pendingBalance += net;
      }
      if (payout.status === 'ready') {
        row.readyBalance += net;
      }
      if (payout.status === 'released') {
        row.releasedTotal += net;
      }
    }

    return Array.from(byVendor.values()).sort(
      (a, b) => b.platformAccrued - a.platformAccrued,
    );
  }, [payouts, vendors]);

  if (loading) return <AdminLayout><LoadingSpinner /></AdminLayout>;

  return (
    <AdminLayout>
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-800">Payments and Payouts</h1>
            <p className="mt-1 text-sm text-slate-500">Organized by financial workflow to help you act faster.</p>
          </div>
          {activeTab === 'billing' && (
            <Button size="sm" className="!bg-slate-800 hover:!bg-slate-900" onClick={() => setShowCreateModal(true)}>
              + Add Payment
            </Button>
          )}
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {PAYMENT_TABS.map((tab) => {
            const selected = activeTab === tab.key;
            return (
              <Link
                key={tab.key}
                to={`/admin/payments/${tab.key}`}
                className={`rounded-xl border px-3 py-3 transition ${selected
                  ? 'border-slate-800 bg-slate-800 text-white shadow-sm'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                  }`}
              >
                <p className={`text-sm font-semibold ${selected ? 'text-white' : 'text-slate-800'}`}>
                  {tab.label}
                </p>
                <p className={`mt-1 text-xs ${selected ? 'text-slate-200' : 'text-slate-500'}`}>
                  {tab.description}
                </p>
              </Link>
            );
          })}
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Platform Earnings (Accrued)</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(payoutSummary.platformAccrued)}</p>
            <p className="mt-1 text-xs text-slate-500">From held, ready, and released bookings</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Gross Collected</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(payoutSummary.grossCollected)}</p>
            <p className="mt-1 text-xs text-slate-500">Full payments collected by platform</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rental Partner Pending Balance</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(payoutSummary.vendorPending)}</p>
            <p className="mt-1 text-xs text-slate-500">Held until completion/payout release window</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rental Partner Ready To Release</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(payoutSummary.vendorReady)}</p>
            <p className="mt-1 text-xs text-slate-500">{payoutSummary.readyCount} payout(s) ready</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rental Partner Released Total</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(payoutSummary.vendorReleased)}</p>
            <p className="mt-1 text-xs text-slate-500">{payoutSummary.releasedCount} payout(s) released</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Refunded/Cancelled Reversals</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(payoutSummary.reversed)}</p>
            <p className="mt-1 text-xs text-slate-500">Net rental partner payouts reversed</p>
          </div>
        </div>
      )}

      {activeTab === 'earnings' && (
        <div>
          <h2 className="mb-3 text-base font-semibold text-slate-800">Rental Partner Earnings Breakdown</h2>
          <div className="overflow-x-auto rounded-xl shadow">
            <Table striped>
              <Table.Head>
                <Table.HeadCell>Rental Partner</Table.HeadCell>
                <Table.HeadCell>Gross Collected</Table.HeadCell>
                <Table.HeadCell>Platform Earnings</Table.HeadCell>
                <Table.HeadCell>Pending</Table.HeadCell>
                <Table.HeadCell>Ready</Table.HeadCell>
                <Table.HeadCell>Released</Table.HeadCell>
                <Table.HeadCell>Transactions</Table.HeadCell>
              </Table.Head>
              <Table.Body>
                {vendorEarnings.map((row) => (
                  <Table.Row key={row.vendorId} className="text-sm">
                    <Table.Cell>{row.vendorName}</Table.Cell>
                    <Table.Cell className="font-semibold">{formatCurrency(row.grossCollected)}</Table.Cell>
                    <Table.Cell>{formatCurrency(row.platformAccrued)}</Table.Cell>
                    <Table.Cell>{formatCurrency(row.pendingBalance)}</Table.Cell>
                    <Table.Cell>{formatCurrency(row.readyBalance)}</Table.Cell>
                    <Table.Cell>{formatCurrency(row.releasedTotal)}</Table.Cell>
                    <Table.Cell>{row.records}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
        </div>
      )}

      {activeTab === 'billing' && (
        <div>
          <h2 className="mb-3 text-base font-semibold text-slate-800">Billing Records</h2>
          <div className="overflow-x-auto rounded-xl shadow">
            <Table striped>
              <Table.Head>
                <Table.HeadCell>Rental Partner</Table.HeadCell>
                <Table.HeadCell>Amount</Table.HeadCell>
                <Table.HeadCell>Due Date</Table.HeadCell>
                <Table.HeadCell>Status</Table.HeadCell>
                <Table.HeadCell>Actions</Table.HeadCell>
              </Table.Head>
              <Table.Body>
                {payments.map((payment) => (
                  <Table.Row key={payment.id} className="text-sm">
                    <Table.Cell>{payment.vendor?.businessName}</Table.Cell>
                    <Table.Cell className="font-semibold">{formatCurrency(payment.amount)}</Table.Cell>
                    <Table.Cell>{formatDate(payment.dueDate)}</Table.Cell>
                    <Table.Cell><PaymentStatusBadge status={payment.status} /></Table.Cell>
                    <Table.Cell>
                      <div className="flex gap-2">
                        {payment.status !== 'paid' && (
                          <Button
                            size="sm"
                            color="light"
                            className="!border-emerald-200 !bg-emerald-50 !text-emerald-800 hover:!bg-emerald-100"
                            onClick={() => markPaid(payment.id).then(() => { toast.success('Marked paid!'); load(); })}
                          >
                            Mark Paid
                          </Button>
                        )}
                        {payment.status === 'pending' && (
                          <Button
                            size="sm"
                            color="light"
                            className="!border-rose-200 !bg-rose-50 !text-rose-700 hover:!bg-rose-100"
                            onClick={() => markOverdue(payment.id).then(() => { toast.success('Marked overdue!'); load(); })}
                          >
                            Mark Overdue
                          </Button>
                        )}
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
        </div>
      )}

      {activeTab === 'payouts' && (
        <div>
          <h2 className="mb-3 text-base font-semibold text-slate-800">Rental Partner Payout Queue</h2>
          <div className="overflow-x-auto rounded-xl shadow">
            <Table striped>
              <Table.Head>
                <Table.HeadCell>Rental Partner</Table.HeadCell>
                <Table.HeadCell>Booking</Table.HeadCell>
                <Table.HeadCell>Gross</Table.HeadCell>
                <Table.HeadCell>Platform Fee</Table.HeadCell>
                <Table.HeadCell>Net Amount</Table.HeadCell>
                <Table.HeadCell>Outstanding</Table.HeadCell>
                <Table.HeadCell>Release On</Table.HeadCell>
                <Table.HeadCell>Payout Destination</Table.HeadCell>
                <Table.HeadCell>Status</Table.HeadCell>
                <Table.HeadCell>Actions</Table.HeadCell>
              </Table.Head>
              <Table.Body>
                {payouts.map((payout) => {
                  const payoutVendor =
                    payout.vendor || vendors.find((vendor) => vendor.id === payout.vendorId);
                  const payoutDestination = formatPayoutDestination(payoutVendor);

                  return (
                    <Table.Row key={payout.id} className="text-sm">
                      <Table.Cell>{payoutVendor?.businessName || payout.vendorId}</Table.Cell>
                      <Table.Cell>{payout.bookingId.slice(0, 8)}...</Table.Cell>
                      <Table.Cell>{formatCurrency(toAmount(payout.grossAmount))}</Table.Cell>
                      <Table.Cell>{formatCurrency(toAmount(payout.platformFeeAmount))}</Table.Cell>
                      <Table.Cell className="font-semibold">{formatCurrency(payout.netAmount)}</Table.Cell>
                      <Table.Cell>{formatCurrency(payout.outstandingBalanceAmount)}</Table.Cell>
                      <Table.Cell>{payout.releaseOn ? formatDate(payout.releaseOn) : 'Immediate'}</Table.Cell>
                      <Table.Cell className="max-w-[260px] truncate" title={payoutDestination}>
                        {payoutDestination}
                      </Table.Cell>
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
                  );
                })}
              </Table.Body>
            </Table>
          </div>
        </div>
      )}

      <Modal show={showCreateModal} onClose={() => !submitting && setShowCreateModal(false)}>
        <Modal.Header>Add Payment</Modal.Header>
        <Modal.Body className="space-y-4">
          <Select
            value={form.vendorId}
            onChange={(event) => setForm((current) => ({ ...current, vendorId: event.target.value }))}
          >
            <option value="">Select Rental Partner</option>
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
