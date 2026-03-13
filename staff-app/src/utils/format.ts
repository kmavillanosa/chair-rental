import { format, differenceInDays } from 'date-fns';

export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);

export const formatDate = (date: string | Date) => format(new Date(date), 'MMM dd, yyyy');

export const formatDateTime = (date: string | Date) => format(new Date(date), 'MMM dd, yyyy h:mm a');

export const calcDays = (start: string | Date, end: string | Date) =>
  Math.max(1, differenceInDays(new Date(end), new Date(start)) + 1);
