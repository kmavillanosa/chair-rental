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

vi.mock('./entities/vendor-payout.entity', () => ({
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

  const payoutsRepo = {
    find: vi.fn(),
    save: vi.fn(async (value) => value),
    create: vi.fn((value) => value),
    update: vi.fn(),
    findOne: vi.fn(),
  };

  const service = new PaymentsService(
    paymentsRepo as any,
    payoutsRepo as any,
    deliveryRatesRepo as any,
  );

  return {
    service,
    mocks: {
      paymentsRepo,
      payoutsRepo,
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

  it('findByVendor delegates to repo with correct filters', async () => {
    const { service, mocks } = createService();
    mocks.paymentsRepo.find.mockResolvedValue([{ id: 'pay-1' }]);

    const result = await service.findByVendor('vendor-1');

    expect(mocks.paymentsRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { vendorId: 'vendor-1' } }),
    );
    expect(result).toHaveLength(1);
  });

  it('findAllPayments returns all payments with vendor relation', async () => {
    const { service, mocks } = createService();
    mocks.paymentsRepo.find.mockResolvedValue([{ id: 'pay-1' }, { id: 'pay-2' }]);

    const result = await service.findAllPayments();

    expect(mocks.paymentsRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ relations: ['vendor'] }),
    );
    expect(result).toHaveLength(2);
  });

  it('findAllPayouts returns payouts with vendor and booking relations', async () => {
    const { service, mocks } = createService();
    mocks.payoutsRepo.find.mockResolvedValue([{ id: 'payout-1' }]);

    const result = await service.findAllPayouts();

    expect(mocks.payoutsRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ relations: ['vendor', 'booking'] }),
    );
    expect(result).toHaveLength(1);
  });

  it('releasePayout throws when payout is not ready', async () => {
    const { service, mocks } = createService();
    mocks.payoutsRepo.findOne.mockResolvedValue({
      id: 'payout-1',
      status: 'held',
    });

    await expect(service.releasePayout('payout-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('releasePayout updates ready payout status to released', async () => {
    const { service, mocks } = createService();
    mocks.payoutsRepo.findOne
      .mockResolvedValueOnce({
        id: 'payout-1',
        status: 'ready',
        notes: null,
        releaseOn: null,
      })
      .mockResolvedValueOnce({
        id: 'payout-1',
        status: 'released',
      });

    const result = await service.releasePayout('payout-1', 'Released by admin');

    expect(mocks.payoutsRepo.update).toHaveBeenCalledWith(
      'payout-1',
      expect.objectContaining({
        status: 'released',
        notes: 'Released by admin',
      }),
    );
    expect(result).toMatchObject({ id: 'payout-1', status: 'released' });
  });

  it('createPayment creates and saves the entity', async () => {
    const { service, mocks } = createService();
    mocks.paymentsRepo.create.mockReturnValue({ vendorId: 'vendor-1', amount: 500 });
    mocks.paymentsRepo.save.mockResolvedValue({ id: 'pay-1', vendorId: 'vendor-1', amount: 500 });

    const result = await service.createPayment({ vendorId: 'vendor-1', amount: 500 } as any);

    expect(mocks.paymentsRepo.create).toHaveBeenCalled();
    expect(mocks.paymentsRepo.save).toHaveBeenCalled();
    expect(result).toMatchObject({ vendorId: 'vendor-1' });
  });

  it('markPaid updates status and returns the updated record', async () => {
    const { service, mocks } = createService();
    mocks.paymentsRepo.findOne.mockResolvedValue({ id: 'pay-1', status: 'paid' });

    const result = await service.markPaid('pay-1', 'txn_abc');

    expect(mocks.paymentsRepo.update).toHaveBeenCalledWith(
      'pay-1',
      expect.objectContaining({ status: 'paid', transactionRef: 'txn_abc' }),
    );
    expect(result).toMatchObject({ id: 'pay-1' });
  });

  it('markPaid without transactionRef still updates status', async () => {
    const { service, mocks } = createService();
    mocks.paymentsRepo.findOne.mockResolvedValue({ id: 'pay-1', status: 'paid' });

    await service.markPaid('pay-1');

    expect(mocks.paymentsRepo.update).toHaveBeenCalledWith(
      'pay-1',
      expect.objectContaining({ status: 'paid' }),
    );
  });

  it('markOverdue updates status to overdue', async () => {
    const { service, mocks } = createService();
    mocks.paymentsRepo.findOne.mockResolvedValue({ id: 'pay-1', status: 'overdue' });

    const result = await service.markOverdue('pay-1');

    expect(mocks.paymentsRepo.update).toHaveBeenCalledWith('pay-1', { status: 'overdue' });
    expect(result).toMatchObject({ id: 'pay-1' });
  });

  it('getDeliveryRates returns sorted rates for vendor', async () => {
    const { service, mocks } = createService();
    mocks.deliveryRatesRepo.find.mockResolvedValue([{ id: 'rate-1', distanceKm: 5 }]);

    const result = await service.getDeliveryRates('vendor-1');

    expect(mocks.deliveryRatesRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { vendorId: 'vendor-1' } }),
    );
    expect(result).toHaveLength(1);
  });

  it('upsertDeliveryRate creates and saves valid rate with default helpersCount', async () => {
    const { service, mocks } = createService();
    mocks.deliveryRatesRepo.create.mockReturnValue({ vendorId: 'vendor-1', distanceKm: 5, chargeAmount: 100, helpersCount: 1 });
    mocks.deliveryRatesRepo.save.mockResolvedValue({ id: 'rate-1', distanceKm: 5, chargeAmount: 100, helpersCount: 1 });

    const result = await service.upsertDeliveryRate('vendor-1', {
      distanceKm: 5,
      chargeAmount: 100,
    } as any);

    expect(mocks.deliveryRatesRepo.save).toHaveBeenCalled();
    expect(result).toMatchObject({ distanceKm: 5 });
  });

  it('deleteDeliveryRate succeeds when record is found', async () => {
    const { service, mocks } = createService();
    mocks.deliveryRatesRepo.delete.mockResolvedValue({ affected: 1 });

    await expect(service.deleteDeliveryRate('vendor-1', 'rate-1')).resolves.toBeUndefined();
  });

  it('rejects delivery rate with non-integer helpersCount', async () => {
    const { service } = createService();

    await expect(
      service.upsertDeliveryRate('vendor-1', {
        distanceKm: 5,
        chargeAmount: 100,
        helpersCount: 1.5,
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
