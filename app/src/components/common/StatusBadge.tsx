import type { BookingStatus, PaymentStatus } from '../../types';
import { Badge } from 'flowbite-react';

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
  return <Badge color={bookingColors[status]} className="text-base px-3 py-1">{status.toUpperCase()}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge color={paymentColors[status]} className="text-base px-3 py-1">{status.toUpperCase()}</Badge>;
}
