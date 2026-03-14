import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./entities/vendor-payment.entity', () => ({
  VendorPayment: class VendorPayment {},
  PaymentStatus: {
    PENDING: 'pending',
    PAID: 'paid',
    OVERDUE: 'overdue',
  },
}));

vi.mock('./entities/delivery-rate.entity', () => ({
  DeliveryRate: class DeliveryRate {},
}));

let PaymentsService: any;

function createService() {
  const paymentsRepo = {
    find: vi.fn(),
    save: vi.fn(async (value) => value),
    create: vi.fn((value) => value),
    update: vi.fn(),
    findOne: vi.fn(),
    delete: vi.fn(),
  };

  const deliveryRatesRepo = {
    find: vi.fn(),
    save: vi.fn(async (value) => value),
    create: vi.fn((value) => value),
    findOne: vi.fn(),
    merge: vi.fn((existing, update) => ({ ...existing, ...update })),
    delete: vi.fn(),
  };

  const service = new PaymentsService(
    paymentsRepo as any,
    deliveryRatesRepo as any,
  );

  return {
    service,
    mocks: {
      paymentsRepo,
      deliveryRatesRepo,
    },
  };
}

describe('PaymentsService', () => {
  beforeAll(async () => {
    ({ PaymentsService } = await import('./payments.service'));
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects delivery rate creation with negative charge', async () => {
    const { service } = createService();

    await expect(
      service.upsertDeliveryRate('vendor-1', {
        distanceKm: 5,
        chargeAmount: -10,
        helpersCount: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws not found when updating missing delivery rate', async () => {
    const { service, mocks } = createService();
    mocks.deliveryRatesRepo.findOne.mockResolvedValue(null);

    await expect(
      service.updateDeliveryRate('vendor-1', 'rate-1', { chargeAmount: 100 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('normalizes numeric fields when updating delivery rate', async () => {
    const { service, mocks } = createService();
    mocks.deliveryRatesRepo.findOne.mockResolvedValue({
      id: 'rate-1',
      vendorId: 'vendor-1',
      distanceKm: 5,
      chargeAmount: 200,
      helpersCount: 1,
    });

    const saved = await service.updateDeliveryRate('vendor-1', 'rate-1', {
      distanceKm: '10.5' as any,
      chargeAmount: '450.25' as any,
      helpersCount: '2' as any,
    });

    expect(saved).toEqual(
      expect.objectContaining({
        distanceKm: 10.5,
        chargeAmount: 450.25,
        helpersCount: 2,
      }),
    );
  });

  it('throws not found when deleting missing delivery rate', async () => {
    const { service, mocks } = createService();
    mocks.deliveryRatesRepo.delete.mockResolvedValue({ affected: 0 });

    await expect(
      service.deleteDeliveryRate('vendor-1', 'rate-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
