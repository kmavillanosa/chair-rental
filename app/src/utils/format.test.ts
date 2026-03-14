import { describe, expect, it } from 'vitest';
import { calcDays, formatCurrency, formatDate, formatDateTime } from './format';

describe('format utilities', () => {
  it('formats currency in PHP style', () => {
    const result = formatCurrency(1234.5);
    expect(result).toContain('1,234.50');
    expect(result.replace(/\s/g, '')).toContain('₱');
  });

  it('formats dates as MMM dd, yyyy', () => {
    const value = new Date(2024, 0, 15, 12, 30, 0);
    expect(formatDate(value)).toBe('Jan 15, 2024');
  });

  it('formats date-time as MMM dd, yyyy h:mm a', () => {
    const value = new Date(2024, 0, 15, 12, 30, 0);
    expect(formatDateTime(value)).toBe('Jan 15, 2024 12:30 PM');
  });

  it('calculates inclusive day count and clamps minimum to 1', () => {
    expect(calcDays('2024-01-01', '2024-01-01')).toBe(1);
    expect(calcDays('2024-01-01', '2024-01-03')).toBe(3);
    expect(calcDays('2024-01-05', '2024-01-03')).toBe(1);
  });
});
