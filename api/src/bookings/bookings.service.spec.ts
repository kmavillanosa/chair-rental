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
    PENDING: 'pending',
    UNPAID: 'unpaid',
    CHECKOUT_PENDING: 'checkout_pending',
    PAID: 'paid',
    DOWNPAYMENT_PAID: 'downpayment_paid',
    HELD: 'held',
    COMPLETED: 'completed',
    FAILED: 'failed',
    REFUNDED: 'refunded',
    DISPUTED: 'disputed',
  },
}));

vi.mock('./entities/booking-item.entity', () => ({
  BookingItem: class BookingItem {},
}));

vi.mock('./entities/booking-message.entity', () => ({
  BookingMessage: class BookingMessage {},
}));

vi.mock('./entities/booking-review.entity', () => ({
  BookingReview: class BookingReview {},
}));

vi.mock('./entities/booking-delivery-proof.entity', () => ({
  BookingDeliveryProof: class BookingDeliveryProof {},
}));

vi.mock('./entities/booking-document.entity', () => ({
  BookingDocument: class BookingDocument {},
  BookingDocumentType: {
    CONTRACT: 'contract',
    RECEIPT: 'receipt',
  },
  BookingDocumentIssuedTo: {
    CUSTOMER: 'customer',
    VENDOR: 'vendor',
    BOTH: 'both',
  },
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

vi.mock('../payments/entities/vendor-payout.entity', () => ({
  VendorPayout: class VendorPayout {},
  VendorPayoutStatus: {
    PENDING: 'pending',
    HELD: 'held',
    READY: 'ready',
    RELEASED: 'released',
    REFUNDED: 'refunded',
    DISPUTED: 'disputed',
    CANCELLED: 'cancelled',
  },
}));

vi.mock('../vendors/entities/vendor.entity', () => ({
  Vendor: class Vendor {},
  VendorPaymentMode: {
    FULL_PAYMENT: 'full_payment',
    DOWNPAYMENT_REQUIRED: 'downpayment_required',
  },
}));

vi.mock('../users/entities/user.entity', () => ({
  User: class User {},
  UserRole: {
    ADMIN: 'admin',
    VENDOR: 'vendor',
    CUSTOMER: 'customer',
  },
}));

vi.mock('../fraud/entities/fraud-alert.entity', () => ({
  FraudAlertSeverity: {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical',
  },
  FraudAlertType: {
    BOOKING_RISK: 'booking_risk',
    OFF_PLATFORM_MESSAGE: 'off_platform_message',
    VENDOR_KYC: 'vendor_kyc',
    DISPUTE: 'dispute',
    LOW_RATING_VENDOR: 'low_rating_vendor',
    IP_REUSE: 'ip_reuse',
    CANCELLATION_PATTERN: 'cancellation_pattern',
    UNUSUAL_BOOKING_FREQUENCY: 'unusual_booking_frequency',
  },
}));

let BookingsService: any;

function createService() {
  const bookingsRepo = {
    findOne: vi.fn(),
    update: vi.fn(),
    find: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
  };
  const bookingItemsRepo = {
    find: vi.fn(),
  };
  const inventoryRepo = {
    findOne: vi.fn(),
  };
  const bookingMessagesRepo = {
    find: vi.fn(),
    save: vi.fn(async (value) => value),
    create: vi.fn((value) => value),
  };
  const bookingReviewsRepo = {
    find: vi.fn().mockResolvedValue([]),
    findOne: vi.fn(),
    save: vi.fn(async (value) => value),
    create: vi.fn((value) => value),
  };
  const bookingDeliveryProofRepo = {
    count: vi.fn().mockResolvedValue(0),
    save: vi.fn(async (value) => value),
    create: vi.fn((value) => value),
  };
  const bookingDocumentsRepo = {
    find: vi.fn().mockResolvedValue([]),
    findOne: vi.fn().mockResolvedValue(null),
    save: vi.fn(async (value) => value),
    create: vi.fn((value) => value),
  };
  const paymentsRepo = {
    findOne: vi.fn(),
  };
  const vendorPayoutsRepo = {
    findOne: vi.fn(),
    update: vi.fn(),
    save: vi.fn(async (value) => value),
    create: vi.fn((value) => value),
  };
  const vendorsRepo = {
    findOne: vi.fn(),
    increment: vi.fn(),
    update: vi.fn(),
  };
  const vendorReviewsRepo = {
    find: vi.fn().mockResolvedValue([]),
  };
  const usersRepo = {
    update: vi.fn(),
  };
  const dataSource = {
    transaction: vi.fn(),
  };
  const settingsService = {
    getFeatureFlagsSettings: vi.fn(),
  };
  const fraudService = {
    analyzeMessageContent: vi.fn(() => ({
      redactedContent: '',
      isFlagged: false,
      reasons: [],
    })),
    createAlert: vi.fn(),
  };
  const rocketchatService = {
    ensureBookingRoom: vi.fn(),
  };
  const pricingBootstrapService = {
    ensureVendorPricingConfig: vi.fn(),
  };
  const pricingCalculationService = {
    calculateBookingPricing: vi.fn(),
  };
  const notificationsService = {
    sendNotification: vi.fn(),
  };

  const service = new BookingsService(
    bookingsRepo as any,
    bookingItemsRepo as any,
    inventoryRepo as any,
    bookingMessagesRepo as any,
    bookingReviewsRepo as any,
    bookingDeliveryProofRepo as any,
    bookingDocumentsRepo as any,
    paymentsRepo as any,
    vendorPayoutsRepo as any,
    vendorsRepo as any,
    vendorReviewsRepo as any,
    usersRepo as any,
    dataSource as any,
    settingsService as any,
    fraudService as any,
    rocketchatService as any,
    pricingBootstrapService as any,
    pricingCalculationService as any,
    notificationsService as any,
  );

  return {
    service,
    mocks: {
      bookingsRepo,
      bookingMessagesRepo,
      bookingReviewsRepo,
      bookingDeliveryProofRepo,
      bookingDocumentsRepo,
      paymentsRepo,
      vendorPayoutsRepo,
      vendorsRepo,
      vendorReviewsRepo,
      usersRepo,
      dataSource,
      settingsService,
      fraudService,
      rocketchatService,
      pricingBootstrapService,
      pricingCalculationService,
      notificationsService,
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

  it('marks payment as HELD for a full-payment booking (remainingBalance = 0)', async () => {
    const { service, mocks } = createService();
    const booking = {
      id: 'booking-1',
      customerId: 'customer-1',
      status: 'pending',
      paymentStatus: 'checkout_pending',
      paymentProvider: 'paymongo',
      paymentCheckoutSessionId: 'cs_test_123',
      paymentReference: null,
      totalAmount: 1000,
      depositAmount: 1000,
      totalPaidAmount: 0,
      remainingBalanceAmount: 0,
      depositPaidAt: null,
    };

    vi.spyOn(service, 'findById')
      .mockResolvedValueOnce(booking as any)
      .mockResolvedValueOnce({ ...booking, paymentStatus: 'held' } as any);

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
        paymentStatus: 'held',
        paymentReference: 'pay_123',
        remainingBalanceAmount: 0,
        finalPaymentPaidAt: expect.any(Date),
      }),
    );
    expect(result.paymentStatus).toBe('held');
  });

  it('marks first payment as DOWNPAYMENT_PAID for a downpayment booking', async () => {
    const { service, mocks } = createService();
    const booking = {
      id: 'booking-2',
      customerId: 'customer-1',
      status: 'pending',
      paymentStatus: 'checkout_pending',
      paymentProvider: 'paymongo',
      paymentCheckoutSessionId: 'cs_down_123',
      paymentReference: null,
      totalAmount: 1000,
      depositAmount: 300,
      totalPaidAmount: 0,
      remainingBalanceAmount: 700,
      depositPaidAt: null,
    };

    vi.spyOn(service, 'findById')
      .mockResolvedValueOnce(booking as any)
      .mockResolvedValueOnce({ ...booking, paymentStatus: 'downpayment_paid' } as any);

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          attributes: {
            status: 'paid',
            reference_number: 'booking_booking-2',
            payments: [{ id: 'pay_down', attributes: { status: 'paid' } }],
          },
        },
      }),
    });

    const result = await service.verifyPayMongoCheckout('booking-2', 'customer-1');

    expect(mocks.bookingsRepo.update).toHaveBeenCalledWith(
      'booking-2',
      expect.objectContaining({
        paymentStatus: 'downpayment_paid',
        totalPaidAmount: 300,
        escrowHeldAmount: 300,
        depositPaidAt: expect.any(Date),
        depositPaymentReference: 'pay_down', // first-leg ref stored for refund split
      }),
    );
    // remainingBalanceAmount should NOT be zeroed out
    const updateCall = mocks.bookingsRepo.update.mock.calls[0]?.[1];
    expect(updateCall).not.toHaveProperty('remainingBalanceAmount');
    expect(result.paymentStatus).toBe('downpayment_paid');
  });

  it('marks remaining balance payment as HELD for a downpayment booking', async () => {
    const { service, mocks } = createService();
    // Booking is in DOWNPAYMENT_PAID state — downpayment already captured
    const booking = {
      id: 'booking-2',
      customerId: 'customer-1',
      status: 'confirmed',
      paymentStatus: 'checkout_pending', // set to CHECKOUT_PENDING when remaining checkout created
      paymentProvider: 'paymongo',
      paymentCheckoutSessionId: 'cs_final_456',
      paymentReference: 'booking_booking-2_final',
      totalAmount: 1000,
      depositAmount: 300,
      totalPaidAmount: 300,   // downpayment already paid
      remainingBalanceAmount: 700,
      depositPaidAt: new Date('2026-03-01'),
    };

    vi.spyOn(service, 'findById')
      .mockResolvedValueOnce(booking as any)
      .mockResolvedValueOnce({ ...booking, paymentStatus: 'held' } as any);

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          attributes: {
            status: 'paid',
            reference_number: 'booking_booking-2_final',
            payments: [{ id: 'pay_final', attributes: { status: 'paid' } }],
          },
        },
      }),
    });

    const result = await service.verifyPayMongoCheckout('booking-2', 'customer-1');

    expect(mocks.bookingsRepo.update).toHaveBeenCalledWith(
      'booking-2',
      expect.objectContaining({
        paymentStatus: 'held',
        totalPaidAmount: 1000,
        escrowHeldAmount: 1000,
        remainingBalanceAmount: 0,
        finalPaymentPaidAt: expect.any(Date),
      }),
    );
    // depositPaidAt should be preserved (already set from downpayment)
    const updateCall = mocks.bookingsRepo.update.mock.calls[0]?.[1];
    expect(updateCall.depositPaidAt).toEqual(booking.depositPaidAt);
    expect(result.paymentStatus).toBe('held');
  });

  it('createRemainingBalanceCheckout throws when booking is not in DOWNPAYMENT_PAID status', async () => {
    const { service } = createService();
    const booking = {
      id: 'booking-1',
      customerId: 'customer-1',
      status: 'pending',
      paymentStatus: 'checkout_pending',
    };
    vi.spyOn(service, 'findById').mockResolvedValue(booking as any);

    await expect(
      service.createRemainingBalanceCheckout('booking-1', 'customer-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('createRemainingBalanceCheckout throws when booking owner mismatches', async () => {
    const { service } = createService();
    vi.spyOn(service, 'findById').mockResolvedValue(null);

    await expect(
      service.createRemainingBalanceCheckout('booking-1', 'wrong-customer'),
    ).rejects.toBeInstanceOf(Error);
  });

  it('createRemainingBalanceCheckout creates checkout when booking is DOWNPAYMENT_PAID', async () => {
    const { service } = createService();
    const booking = {
      id: 'booking-2',
      customerId: 'customer-1',
      status: 'confirmed',
      paymentStatus: 'downpayment_paid',
      remainingBalanceAmount: 700,
    };
    const refreshed = { ...booking, paymentStatus: 'checkout_pending' };

    const findByIdSpy = vi.spyOn(service, 'findById')
      .mockResolvedValueOnce(booking as any)  // initial lookup
      .mockResolvedValueOnce(refreshed as any); // after checkout created

    const checkoutSpy = vi
      .spyOn(service as any, 'createPayMongoCheckoutForBooking')
      .mockResolvedValue(undefined);

    const tryDocSpy = vi
      .spyOn(service as any, 'tryEnsureBookingDocuments')
      .mockResolvedValue(undefined);

    const result = await service.createRemainingBalanceCheckout('booking-2', 'customer-1');

    expect(checkoutSpy).toHaveBeenCalledWith('booking-2', 'customer-1', true, true);
    expect(tryDocSpy).toHaveBeenCalledWith('booking-2');
    expect(result).toEqual(refreshed);
  });

  it('deposits and remaining amounts are calculated correctly for a 30% downpayment', () => {
    const { service } = createService();
    // Access private toMoney helper through the service
    const toMoney = (v: number) => (service as any).toMoney(v);
    const total = 1500;
    const depositPct = 30;
    const depositAmount = toMoney(total * (depositPct / 100));
    const remainingAmount = toMoney(total - depositAmount);

    expect(depositAmount).toBe(450);
    expect(remainingAmount).toBe(1050);
    expect(depositAmount + remainingAmount).toBe(total);
  });

  it('clampDownpaymentPercent clamps out-of-range values to 30', () => {
    const { service } = createService();
    const clamp = (v: number) => (service as any).clampDownpaymentPercent(v);

    expect(clamp(0)).toBe(30);      // below minimum
    expect(clamp(100)).toBe(30);    // at/above maximum (must be < 100)
    expect(clamp(-5)).toBe(30);     // negative
    expect(clamp(NaN)).toBe(30);    // NaN
    expect(clamp(50)).toBe(50);     // valid
    expect(clamp(1)).toBe(1);       // minimum boundary
    expect(clamp(99)).toBe(99);     // maximum boundary
  });

  it('cancellation refund uses only totalPaidAmount when only downpayment was paid', async () => {
    const { service, mocks } = createService();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 10);

    const booking = {
      id: 'booking-3',
      customerId: 'customer-1',
      status: 'confirmed',
      paymentStatus: 'downpayment_paid',
      paymentProvider: 'paymongo',
      paymentReference: null,       // no pay_ reference so refund is skipped
      totalAmount: 1000,
      depositAmount: 300,
      totalPaidAmount: 300,          // only downpayment collected
      remainingBalanceAmount: 700,
      startDate: startDate.toISOString(),
      vendor: { userId: 'vendor-user-1' },
      escrowHeldAmount: 300,
    };

    vi.spyOn(service, 'findById')
      .mockResolvedValueOnce(booking as any)
      .mockResolvedValueOnce({ ...booking, status: 'cancelled' } as any);

    mocks.settingsService.getFeatureFlagsSettings.mockResolvedValue({
      cancellationFullRefundMinDays: 3,
      cancellationHalfRefundMinDays: 1,
      cancellationHalfRefundPercent: 50,
    });

    await service.updateStatus('booking-3', 'cancelled' as any, 'customer-1', 'customer' as any);

    // Cancellation refund should be 100% of the 300 paid (>= 3 days before start)
    const updateCall = mocks.bookingsRepo.update.mock.calls.find(
      (call: any[]) => call[1]?.cancellationRefundAmount !== undefined,
    );
    expect(updateCall).toBeDefined();
    expect(updateCall![1].cancellationRefundAmount).toBe(300);
    expect(updateCall![1].cancellationRefundPercent).toBe(100);
  });

  it('two-leg cancellation issues separate PayMongo refund calls for each leg (100% refund)', async () => {
    // Total 1000: leg1 pay_xxx1=300 (deposit), leg2 pay_xxx2=700 (remaining)
    // Full refund (admin cancels) → refund 700 from pay_xxx2, then 300 from pay_xxx1
    const { service, mocks } = createService();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 10);

    mocks.settingsService.getFeatureFlagsSettings.mockResolvedValue({
      cancellationFullRefundMinDays: 3,
      cancellationHalfRefundMinDays: 1,
      cancellationHalfRefundPercent: 50,
    });

    const booking = {
      id: 'booking-tl',
      customerId: 'customer-1',
      status: 'confirmed',
      paymentStatus: 'held',
      paymentProvider: 'paymongo',
      paymentReference: 'pay_leg2',
      depositPaymentReference: 'pay_leg1',
      totalAmount: 1000,
      depositAmount: 300,
      totalPaidAmount: 1000,
      remainingBalanceAmount: 0,
      startDate: startDate.toISOString(),
      vendor: { userId: 'vendor-user-1' },
      escrowHeldAmount: 1000,
      cancellationPolicyCode: null,
    };

    vi.spyOn(service, 'findById')
      .mockResolvedValueOnce(booking as any)
      .mockResolvedValueOnce({ ...booking, status: 'cancelled' } as any);

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: 'ref_ok', attributes: {} } }),
    });

    // Admin/vendor cancel → 100% refund
    await service.updateStatus('booking-tl', 'cancelled' as any, 'vendor-user-1', 'vendor' as any);

    const fetchCalls = fetchMock.mock.calls as any[][];
    // Two refund calls expected
    expect(fetchCalls.length).toBe(2);

    // First call: leg2 (700 = totalAmount - depositAmount)
    const body1 = JSON.parse(fetchCalls[0][1].body);
    expect(body1.data.attributes.payment_id).toBe('pay_leg2');
    expect(body1.data.attributes.amount).toBe(70000); // 700 * 100 minor units

    // Second call: leg1 (300 = depositAmount remainder)
    const body2 = JSON.parse(fetchCalls[1][1].body);
    expect(body2.data.attributes.payment_id).toBe('pay_leg1');
    expect(body2.data.attributes.amount).toBe(30000); // 300 * 100 minor units
  });

  it('two-leg cancellation with 50% refund splits correctly across both legs', async () => {
    // Total 1000: leg1=300, leg2=700. 50% refund = 500.
    // Refund first from leg2: min(500, 700) = 500, remainder = 0 → no leg1 refund
    const { service, mocks } = createService();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 1); // 1 day away → 50% refund tier

    mocks.settingsService.getFeatureFlagsSettings.mockResolvedValue({
      cancellationFullRefundMinDays: 3,
      cancellationHalfRefundMinDays: 1,
      cancellationHalfRefundPercent: 50,
    });

    const booking = {
      id: 'booking-tl2',
      customerId: 'customer-1',
      status: 'confirmed',
      paymentStatus: 'held',
      paymentProvider: 'paymongo',
      paymentReference: 'pay_leg2b',
      depositPaymentReference: 'pay_leg1b',
      totalAmount: 1000,
      depositAmount: 300,
      totalPaidAmount: 1000,
      remainingBalanceAmount: 0,
      startDate: startDate.toISOString(),
      vendor: { userId: 'vendor-user-1' },
      escrowHeldAmount: 1000,
      cancellationPolicyCode: null,
    };

    vi.spyOn(service, 'findById')
      .mockResolvedValueOnce(booking as any)
      .mockResolvedValueOnce({ ...booking, status: 'cancelled' } as any);

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: 'ref_ok', attributes: {} } }),
    });

    // Customer cancels 1 day out → 50% refund = 500
    // settings mock default returns 50% for half-refund
    await service.updateStatus('booking-tl2', 'cancelled' as any, 'customer-1', 'customer' as any);

    const fetchCalls = fetchMock.mock.calls as any[][];
    // Only one refund call because 500 fits entirely within leg2 (700)
    expect(fetchCalls.length).toBe(1);
    const body = JSON.parse(fetchCalls[0][1].body);
    expect(body.data.attributes.payment_id).toBe('pay_leg2b');
    expect(body.data.attributes.amount).toBe(50000); // 500 * 100
  });

  it('updateStatus allows vendor to confirm booking when status is DOWNPAYMENT_PAID', async () => {
    const { service, mocks } = createService();
    const booking = {
      id: 'booking-4',
      customerId: 'customer-1',
      status: 'pending',
      paymentStatus: 'downpayment_paid',
      paymentProvider: 'paymongo',
      vendor: { userId: 'vendor-user-1' },
    };

    vi.spyOn(service, 'findById')
      .mockResolvedValueOnce(booking as any)
      .mockResolvedValueOnce({ ...booking, status: 'confirmed' } as any);

    const result = await service.updateStatus(
      'booking-4',
      'confirmed' as any,
      'vendor-user-1',
      'vendor' as any,
    );

    expect(mocks.bookingsRepo.update).toHaveBeenCalledWith('booking-4', { status: 'confirmed' });
    expect(result.status).toBe('confirmed');
  });

  it('updateStatus blocks vendor from confirming booking with UNPAID status (PayMongo)', async () => {
    const { service } = createService();
    const booking = {
      id: 'booking-5',
      customerId: 'customer-1',
      status: 'pending',
      paymentStatus: 'unpaid',
      paymentProvider: 'paymongo',
      vendor: { userId: 'vendor-user-1' },
    };
    vi.spyOn(service, 'findById').mockResolvedValue(booking as any);

    await expect(
      service.updateStatus('booking-5', 'confirmed' as any, 'vendor-user-1', 'vendor' as any),
    ).rejects.toBeInstanceOf(BadRequestException);
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

  it('updateStatus blocks confirming an unpaid PayMongo booking even when test mode flag is enabled', async () => {
    const { service, mocks } = createService();
    const booking = {
      id: 'booking-1',
      customerId: 'customer-1',
      status: 'pending',
      paymentStatus: 'unpaid',
      paymentProvider: 'paymongo',
      vendor: null,
    };

    mocks.settingsService.getFeatureFlagsSettings.mockResolvedValue({
      allowOrdersWithoutPayment: true,
    });

    vi.spyOn(service, 'findById').mockResolvedValue(booking as any);

    await expect(
      service.updateStatus('booking-1', 'confirmed' as any, 'admin-1', 'admin' as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updateStatus keeps blocking unpaid PayMongo confirmation when test mode flag is disabled', async () => {
    const { service, mocks } = createService();
    const booking = {
      id: 'booking-1',
      customerId: 'customer-1',
      status: 'pending',
      paymentStatus: 'unpaid',
      paymentProvider: 'paymongo',
      vendor: null,
    };

    mocks.settingsService.getFeatureFlagsSettings.mockResolvedValue({
      allowOrdersWithoutPayment: false,
    });

    vi.spyOn(service, 'findById').mockResolvedValue(booking as any);

    await expect(
      service.updateStatus('booking-1', 'confirmed' as any, 'admin-1', 'admin' as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create starts automatic checkout when PayMongo is enabled', async () => {
    const { service, mocks } = createService();
    const manager = {
      findOne: vi.fn().mockResolvedValue({
        id: 'inv-1',
        quantity: 10,
        ratePerDay: 100,
      }),
      createQueryBuilder: vi.fn(() => ({
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        getRawOne: vi.fn().mockResolvedValue({ total: 0 }),
      })),
      create: vi.fn((_: unknown, value: any) => value),
      save: vi
        .fn()
        .mockImplementationOnce(async (value: any) => ({ ...value, id: 'booking-1' }))
        .mockImplementation(async (value: any) => value),
    };

    mocks.vendorsRepo.findOne.mockResolvedValue({
      id: 'vendor-1',
      commissionRate: 0.1,
    });
    mocks.paymentsRepo.findOne.mockResolvedValue(null);
    mocks.settingsService.getFeatureFlagsSettings.mockResolvedValue({
      launchNoCommissionEnabled: false,
      launchNoCommissionUntil: null,
      defaultPlatformCommissionRatePercent: 10,
    });
    mocks.dataSource.transaction.mockImplementation(async (callback: any) =>
      callback(manager),
    );

    vi.spyOn(service, 'findById').mockResolvedValue({
      id: 'booking-1',
      customerId: 'customer-1',
      vendorId: 'vendor-1',
      paymentProvider: 'paymongo',
      paymentStatus: 'pending',
    } as any);

    const checkoutSpy = vi
      .spyOn(service as any, 'createPayMongoCheckoutForBooking')
      .mockResolvedValue(undefined);

    await service.create('customer-1', {
      vendorId: 'vendor-1',
      startDate: '2026-05-09',
      endDate: '2026-05-10',
      items: [{ inventoryItemId: 'inv-1', quantity: 1 }],
    });

    expect(checkoutSpy).toHaveBeenCalledWith('booking-1', 'customer-1', false, false);
    expect(manager.create.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        paymentProvider: 'paymongo',
        paymentStatus: 'pending',
      }),
    );
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
