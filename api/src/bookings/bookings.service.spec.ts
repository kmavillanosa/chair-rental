import { BadRequestException } from '@nestjs/common';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./entities/booking.entity', () => ({
  Booking: class Booking {},
  BookingStatus: {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    CANCELLED: 'cancelled',
    COMPLETED: 'completed',
  },
  BookingPaymentStatus: {
    UNPAID: 'unpaid',
    CHECKOUT_PENDING: 'checkout_pending',
    PAID: 'paid',
    FAILED: 'failed',
    REFUNDED: 'refunded',
  },
}));

vi.mock('./entities/booking-item.entity', () => ({
  BookingItem: class BookingItem {},
}));

vi.mock('../inventory/entities/inventory-item.entity', () => ({
  InventoryItem: class InventoryItem {},
}));

vi.mock('../payments/entities/vendor-payment.entity', () => ({
  VendorPayment: class VendorPayment {},
  PaymentStatus: {
    PENDING: 'pending',
    PAID: 'paid',
    OVERDUE: 'overdue',
  },
}));

vi.mock('../vendors/entities/vendor.entity', () => ({
  Vendor: class Vendor {},
}));

vi.mock('../users/entities/user.entity', () => ({
  UserRole: {
    ADMIN: 'admin',
    VENDOR: 'vendor',
    CUSTOMER: 'customer',
  },
}));

let BookingsService: any;

function createService() {
  const bookingsRepo = {
    findOne: vi.fn(),
    update: vi.fn(),
    find: vi.fn(),
  };
  const bookingItemsRepo = {};
  const inventoryRepo = {};
  const paymentsRepo = {
    findOne: vi.fn(),
  };
  const vendorsRepo = {
    findOne: vi.fn(),
  };
  const dataSource = {
    transaction: vi.fn(),
  };
  const settingsService = {
    getFeatureFlagsSettings: vi.fn(),
  };

  const service = new BookingsService(
    bookingsRepo as any,
    bookingItemsRepo as any,
    inventoryRepo as any,
    paymentsRepo as any,
    vendorsRepo as any,
    dataSource as any,
    settingsService as any,
  );

  return {
    service,
    mocks: {
      bookingsRepo,
      paymentsRepo,
      vendorsRepo,
      dataSource,
      settingsService,
    },
  };
}

describe('BookingsService', () => {
  const fetchMock = vi.fn();
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    ({ BookingsService } = await import('./bookings.service'));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    process.env = {
      ...originalEnv,
      PAYMONGO_ENABLED: 'true',
      PAYMONGO_SECRET_KEY: 'sk_test_mock',
    };
  });

  it('rejects booking creation when endDate is before startDate', async () => {
    const { service } = createService();

    await expect(
      service.create('customer-1', {
        vendorId: 'vendor-1',
        startDate: '2026-05-10',
        endDate: '2026-05-09',
        items: [{ inventoryItemId: 'inv-1', quantity: 1 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects booking creation when item quantity is non-positive', async () => {
    const { service } = createService();

    await expect(
      service.create('customer-1', {
        vendorId: 'vendor-1',
        startDate: '2026-05-09',
        endDate: '2026-05-10',
        items: [{ inventoryItemId: 'inv-1', quantity: 0 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects booking creation when delivery charge is negative', async () => {
    const { service } = createService();

    await expect(
      service.create('customer-1', {
        vendorId: 'vendor-1',
        startDate: '2026-05-09',
        endDate: '2026-05-10',
        items: [{ inventoryItemId: 'inv-1', quantity: 1 }],
        deliveryCharge: -50,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects payment verification when provided checkoutSessionId mismatches stored session', async () => {
    const { service } = createService();
    const booking = {
      id: 'booking-1',
      customerId: 'customer-1',
      status: 'pending',
      paymentStatus: 'checkout_pending',
      paymentProvider: 'paymongo',
      paymentCheckoutSessionId: 'cs_test_123',
      paymentReference: 'booking_booking-1',
    };

    vi.spyOn(service, 'findById').mockResolvedValue(booking as any);

    await expect(
      service.verifyPayMongoCheckout('booking-1', 'customer-1', 'cs_wrong_456'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects payment verification when checkout reference does not match booking', async () => {
    const { service } = createService();
    const booking = {
      id: 'booking-1',
      customerId: 'customer-1',
      status: 'pending',
      paymentStatus: 'checkout_pending',
      paymentProvider: 'paymongo',
      paymentCheckoutSessionId: 'cs_test_123',
      paymentReference: 'booking_booking-1',
    };

    vi.spyOn(service, 'findById').mockResolvedValue(booking as any);

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          attributes: {
            status: 'paid',
            reference_number: 'booking_other',
            payments: [{ id: 'pay_123', attributes: { status: 'paid' } }],
          },
        },
      }),
    });

    await expect(
      service.verifyPayMongoCheckout('booking-1', 'customer-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('marks payment as paid when session is valid and belongs to booking', async () => {
    const { service, mocks } = createService();
    const booking = {
      id: 'booking-1',
      customerId: 'customer-1',
      status: 'pending',
      paymentStatus: 'checkout_pending',
      paymentProvider: 'paymongo',
      paymentCheckoutSessionId: 'cs_test_123',
      paymentReference: null,
    };

    vi.spyOn(service, 'findById')
      .mockResolvedValueOnce(booking as any)
      .mockResolvedValueOnce({
        ...booking,
        paymentStatus: 'paid',
      } as any);

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          attributes: {
            status: 'paid',
            reference_number: 'booking_booking-1',
            payments: [{ id: 'pay_123', attributes: { status: 'paid' } }],
          },
        },
      }),
    });

    const result = await service.verifyPayMongoCheckout('booking-1', 'customer-1');

    expect(mocks.bookingsRepo.update).toHaveBeenCalledWith(
      'booking-1',
      expect.objectContaining({
        paymentStatus: 'paid',
        paymentReference: 'pay_123',
      }),
    );
    expect(result.paymentStatus).toBe('paid');
  });

  it('rejects unsafe split configurations where fixed+percentage exceed safe net', () => {
    const { service } = createService();

    expect(() =>
      (service as any).assertFixedSplitsWithinSafeNet(100, [
        { merchant_id: 'delivery', split_type: 'fixed', value: 6000 },
        { merchant_id: 'platform', split_type: 'percentage_net', value: 5000 },
      ]),
    ).toThrow(BadRequestException);
  });

  it('throws NotFoundException from getCancellationPreview when booking is missing', async () => {
    const { service, mocks } = createService();
    vi.spyOn(service, 'findById').mockResolvedValue(null);

    await expect(
      service.getCancellationPreview('booking-x', 'user-1', 'customer' as any),
    ).rejects.toThrow('Booking not found');
  });

  it('throws BadRequestException from getCancellationPreview when booking is already cancelled', async () => {
    const { service } = createService();
    vi.spyOn(service, 'findById').mockResolvedValue({
      id: 'booking-1',
      customerId: 'user-1',
      status: 'cancelled',
      vendor: null,
    } as any);

    await expect(
      service.getCancellationPreview('booking-1', 'user-1', 'admin' as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('getCancellationPreview returns full refund for admin/vendor actor', async () => {
    const { service, mocks } = createService();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 10);
    const booking = {
      id: 'booking-1',
      customerId: 'user-1',
      status: 'pending',
      paymentStatus: 'unpaid',
      totalAmount: 500,
      startDate: startDate.toISOString(),
      vendor: { userId: 'vendor-user-1' },
    };
    vi.spyOn(service, 'findById').mockResolvedValue(booking as any);

    const result = await service.getCancellationPreview('booking-1', 'vendor-user-1', 'vendor' as any);

    expect(result.policyCode).toBe('vendor_or_admin_full_refund');
    expect(result.refundPercent).toBe(100);
  });

  it('getCancellationPreview returns full refund for customer >= 3 days from start', async () => {
    const { service, mocks } = createService();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 5);
    const booking = {
      id: 'booking-1',
      customerId: 'customer-1',
      status: 'pending',
      paymentStatus: 'paid',
      totalAmount: 1000,
      startDate: startDate.toISOString(),
      vendor: null,
    };
    vi.spyOn(service, 'findById').mockResolvedValue(booking as any);
    mocks.settingsService.getFeatureFlagsSettings.mockResolvedValue({
      cancellationFullRefundMinDays: 3,
      cancellationHalfRefundMinDays: 1,
      cancellationHalfRefundPercent: 50,
    });

    const result = await service.getCancellationPreview('booking-1', 'customer-1', 'customer' as any);

    expect(result.policyCode).toBe('full_refund_3_days');
    expect(result.refundPercent).toBe(100);
    expect(result.refundAmount).toBe(1000);
  });

  it('getCancellationPreview returns half refund for customer 1 day before start', async () => {
    const { service, mocks } = createService();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 1);
    const booking = {
      id: 'booking-1',
      customerId: 'customer-1',
      status: 'pending',
      paymentStatus: 'paid',
      totalAmount: 1000,
      startDate: startDate.toISOString(),
      vendor: null,
    };
    vi.spyOn(service, 'findById').mockResolvedValue(booking as any);
    mocks.settingsService.getFeatureFlagsSettings.mockResolvedValue({
      cancellationFullRefundMinDays: 3,
      cancellationHalfRefundMinDays: 1,
      cancellationHalfRefundPercent: 50,
    });

    const result = await service.getCancellationPreview('booking-1', 'customer-1', 'customer' as any);

    expect(result.policyCode).toBe('half_refund_24_hours');
    expect(result.refundPercent).toBe(50);
    expect(result.refundAmount).toBe(500);
  });

  it('getCancellationPreview returns no refund on same-day cancellation', async () => {
    const { service, mocks } = createService();
    const today = new Date();
    const booking = {
      id: 'booking-1',
      customerId: 'customer-1',
      status: 'pending',
      paymentStatus: 'paid',
      totalAmount: 1000,
      startDate: today.toISOString(),
      vendor: null,
    };
    vi.spyOn(service, 'findById').mockResolvedValue(booking as any);
    mocks.settingsService.getFeatureFlagsSettings.mockResolvedValue({
      cancellationFullRefundMinDays: 3,
      cancellationHalfRefundMinDays: 1,
      cancellationHalfRefundPercent: 50,
    });

    const result = await service.getCancellationPreview('booking-1', 'customer-1', 'customer' as any);

    expect(result.policyCode).toBe('same_day_no_refund');
    expect(result.refundPercent).toBe(0);
    expect(result.refundAmount).toBe(0);
  });

  it('updateStatus throws NotFoundException when booking is missing', async () => {
    const { service } = createService();
    vi.spyOn(service, 'findById').mockResolvedValue(null);

    await expect(
      service.updateStatus('booking-x', 'confirmed' as any, 'user-1', 'admin' as any),
    ).rejects.toThrow('Booking not found');
  });

  it('updateStatus throws ForbiddenException when customer tries to confirm a booking', async () => {
    const { service } = createService();
    const booking = {
      id: 'booking-1',
      customerId: 'customer-1',
      status: 'pending',
      paymentStatus: 'unpaid',
      vendor: null,
    };
    vi.spyOn(service, 'findById').mockResolvedValue(booking as any);

    await expect(
      service.updateStatus('booking-1', 'confirmed' as any, 'customer-1', 'customer' as any),
    ).rejects.toBeInstanceOf(Error);
  });

  it('updateStatus allows admin to confirm a booking directly', async () => {
    const { service, mocks } = createService();
    const booking = {
      id: 'booking-1',
      customerId: 'customer-1',
      status: 'pending',
      paymentStatus: 'unpaid',
      paymentProvider: '',
      vendor: null,
    };
    vi.spyOn(service, 'findById')
      .mockResolvedValueOnce(booking as any)
      .mockResolvedValueOnce({ ...booking, status: 'confirmed' } as any);

    const result = await service.updateStatus('booking-1', 'confirmed' as any, 'admin-1', 'admin' as any);

    expect(mocks.bookingsRepo.update).toHaveBeenCalledWith('booking-1', { status: 'confirmed' });
    expect(result.status).toBe('confirmed');
  });

  it('assertCanAccessBooking throws ForbiddenException for unrelated customer', () => {
    const { service } = createService();
    const booking = {
      id: 'booking-1',
      customerId: 'customer-owner',
      vendor: { userId: 'vendor-owner' },
    };

    expect(() =>
      (service as any).assertCanAccessBooking(booking, 'unrelated-user', 'customer'),
    ).toThrow();
  });

  it('assertCanAccessBooking allows admin to access any booking', () => {
    const { service } = createService();
    const booking = { id: 'booking-1', customerId: 'customer-1', vendor: null };

    expect(() =>
      (service as any).assertCanAccessBooking(booking, 'admin-1', 'admin'),
    ).not.toThrow();
  });

  it('assertCanAccessBooking allows matching vendor to access booking', () => {
    const { service } = createService();
    const booking = {
      id: 'booking-1',
      customerId: 'customer-1',
      vendor: { userId: 'vendor-user-1' },
    };

    expect(() =>
      (service as any).assertCanAccessBooking(booking, 'vendor-user-1', 'vendor'),
    ).not.toThrow();
  });

  it('parseCommissionRate converts percentage (>1) to decimal', () => {
    const { service } = createService();
    expect((service as any).parseCommissionRate(15)).toBeCloseTo(0.15);
  });

  it('parseCommissionRate keeps decimal values as-is', () => {
    const { service } = createService();
    expect((service as any).parseCommissionRate(0.1)).toBeCloseTo(0.1);
  });

  it('parseCommissionRate returns fallback for invalid value', () => {
    const { service } = createService();
    expect((service as any).parseCommissionRate('not-a-number', 0.05)).toBeCloseTo(0.05);
  });

  it('isNoCommissionWindowActive returns true when until is null', () => {
    const { service } = createService();
    expect((service as any).isNoCommissionWindowActive(null)).toBe(true);
  });

  it('isNoCommissionWindowActive returns true when until is a future date', () => {
    const { service } = createService();
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    expect((service as any).isNoCommissionWindowActive(future)).toBe(true);
  });

  it('isNoCommissionWindowActive returns false when until is a past date', () => {
    const { service } = createService();
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    expect((service as any).isNoCommissionWindowActive(past)).toBe(false);
  });
});
