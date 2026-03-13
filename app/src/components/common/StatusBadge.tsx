import type { BookingStatus, PaymentStatus } from '../../types';
import { Badge } from 'flowbite-react';
import { useTranslation } from 'react-i18next';

const bookingColors: Record<BookingStatus, 'warning' | 'success' | 'failure' | 'indigo'> = {
  pending: 'warning',
  confirmed: 'success',
  cancelled: 'failure',
  completed: 'indigo',
};

const paymentColors: Record<PaymentStatus, 'warning' | 'success' | 'failure'> = {
  pending: 'warning',
  paid: 'success',
  overdue: 'failure',
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const { t } = useTranslation();
  return <Badge color={bookingColors[status]} className="text-base px-3 py-1">{t(`status.booking.${status}`)}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const { t } = useTranslation();
  return <Badge color={paymentColors[status]} className="text-base px-3 py-1">{t(`status.payment.${status}`)}</Badge>;
}
