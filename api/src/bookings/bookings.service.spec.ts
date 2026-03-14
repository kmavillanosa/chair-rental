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
});
