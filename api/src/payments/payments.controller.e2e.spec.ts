import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./payments.service', () => ({
  PaymentsService: class PaymentsService {},
}));

vi.mock('../vendors/vendors.service', () => ({
  VendorsService: class VendorsService {},
}));

vi.mock('./entities/vendor-payment.entity', () => ({
  VendorPayment: class VendorPayment {},
  PaymentStatus: {
    PENDING: 'pending',
    PAID: 'paid',
    OVERDUE: 'overdue',
  },
}));

vi.mock('../users/entities/user.entity', () => ({
  UserRole: {
    ADMIN: 'admin',
    VENDOR: 'vendor',
    CUSTOMER: 'customer',
  },
}));

let PaymentsController: any;
let PaymentsServiceToken: any;
let VendorsServiceToken: any;
let JwtAuthGuardToken: any;
let RolesGuardToken: any;
let UserRole: any;
let CreatePaymentDto: any;
let MarkPaidDto: any;
let CreateDeliveryRateDto: any;
let UpdateDeliveryRateDto: any;

const authUser = {
  id: 'vendor-user-1',
  role: 'vendor',
};

const paymentsServiceMock = {
  findAllPayments: vi.fn(),
  findByVendor: vi.fn(),
  createPayment: vi.fn(),
  markPaid: vi.fn(),
  markOverdue: vi.fn(),
  getDeliveryRates: vi.fn(),
  upsertDeliveryRate: vi.fn(),
  updateDeliveryRate: vi.fn(),
  deleteDeliveryRate: vi.fn(),
};

const vendorsServiceMock = {
  findByUserId: vi.fn(),
};

describe('PaymentsController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ PaymentsController } = await import('./payments.controller'));
    ({ PaymentsService: PaymentsServiceToken } = await import('./payments.service'));
    ({ VendorsService: VendorsServiceToken } = await import('../vendors/vendors.service'));
    ({ JwtAuthGuard: JwtAuthGuardToken } = await import('../auth/jwt-auth.guard'));
    ({ RolesGuard: RolesGuardToken } = await import('../auth/roles.guard'));
    ({ UserRole } = await import('../users/entities/user.entity'));
    ({ CreatePaymentDto } = await import('./dto/create-payment.dto'));
    ({ MarkPaidDto } = await import('./dto/mark-paid.dto'));
    ({ CreateDeliveryRateDto } = await import('./dto/create-delivery-rate.dto'));
    ({ UpdateDeliveryRateDto } = await import('./dto/update-delivery-rate.dto'));

    // Vitest transpilation here omits design-time constructor metadata.
    Reflect.defineMetadata(
      'design:paramtypes',
      [PaymentsServiceToken, VendorsServiceToken],
      PaymentsController,
    );

    Reflect.defineMetadata(
      'design:paramtypes',
      [CreatePaymentDto],
      PaymentsController.prototype,
      'createPayment',
    );
    Reflect.defineMetadata(
      'design:paramtypes',
      [String, MarkPaidDto],
      PaymentsController.prototype,
      'markPaid',
    );
    Reflect.defineMetadata(
      'design:paramtypes',
      [Object, CreateDeliveryRateDto],
      PaymentsController.prototype,
      'addDeliveryRate',
    );
    Reflect.defineMetadata(
      'design:paramtypes',
      [Object, String, UpdateDeliveryRateDto],
      PaymentsController.prototype,
      'updateDeliveryRate',
    );
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    authUser.id = 'vendor-user-1';
    authUser.role = UserRole.VENDOR;

    const moduleRef = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        { provide: PaymentsServiceToken, useValue: paymentsServiceMock },
        { provide: VendorsServiceToken, useValue: vendorsServiceMock },
      ],
    })
      .overrideGuard(JwtAuthGuardToken)
      .useValue({
        canActivate: (ctx: any) => {
          const req = ctx.switchToHttp().getRequest();
          req.user = { ...authUser };
          return true;
        },
      })
      .overrideGuard(RolesGuardToken)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects invalid create payment payloads before service call', async () => {
    authUser.role = UserRole.ADMIN;

    const response = await request(app.getHttpServer())
      .post('/payments')
      .send({
        vendorId: 'vendor-1',
        amount: -10,
        dueDate: '2026-05-30',
      });

    expect(response.status).toBe(400);
    expect(paymentsServiceMock.createPayment).not.toHaveBeenCalled();
  });

  it('creates payment with transformed amount', async () => {
    authUser.role = UserRole.ADMIN;
    paymentsServiceMock.createPayment.mockResolvedValue({ id: 'pay-1' });

    const response = await request(app.getHttpServer())
      .post('/payments')
      .send({
        vendorId: 'vendor-1',
        amount: '1500.25',
        dueDate: '2026-05-30',
      });

    expect(response.status).toBe(201);
    expect(paymentsServiceMock.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        vendorId: 'vendor-1',
        amount: 1500.25,
      }),
    );
  });

  it('marks payment as paid with transaction reference', async () => {
    authUser.role = UserRole.ADMIN;
    paymentsServiceMock.markPaid.mockResolvedValue({ id: 'pay-1', status: 'paid' });

    const response = await request(app.getHttpServer())
      .patch('/payments/pay-1/paid')
      .send({ transactionRef: 'txn_123' });

    expect(response.status).toBe(200);
    expect(paymentsServiceMock.markPaid).toHaveBeenCalledWith('pay-1', 'txn_123');
  });

  it('returns current vendor payments using vendor profile id', async () => {
    vendorsServiceMock.findByUserId.mockResolvedValue({ id: 'vendor-1' });
    paymentsServiceMock.findByVendor.mockResolvedValue([{ id: 'pay-1' }]);

    const response = await request(app.getHttpServer()).get('/payments/vendor/my');

    expect(response.status).toBe(200);
    expect(vendorsServiceMock.findByUserId).toHaveBeenCalledWith('vendor-user-1');
    expect(paymentsServiceMock.findByVendor).toHaveBeenCalledWith('vendor-1');
  });

  it('creates delivery rate with normalized numeric values', async () => {
    vendorsServiceMock.findByUserId.mockResolvedValue({ id: 'vendor-1' });
    paymentsServiceMock.upsertDeliveryRate.mockResolvedValue({ id: 'rate-1' });

    const response = await request(app.getHttpServer())
      .post('/payments/delivery-rates')
      .send({
        distanceKm: '10.5',
        chargeAmount: '300',
        helpersCount: '2',
      });

    expect(response.status).toBe(201);
    expect(paymentsServiceMock.upsertDeliveryRate).toHaveBeenCalledWith(
      'vendor-1',
      expect.objectContaining({
        distanceKm: 10.5,
        chargeAmount: 300,
        helpersCount: 2,
      }),
    );
  });

  it('rejects invalid delivery rate updates before service call', async () => {
    const response = await request(app.getHttpServer())
      .patch('/payments/delivery-rates/rate-1')
      .send({ helpersCount: 1.25 });

    expect(response.status).toBe(400);
    expect(paymentsServiceMock.updateDeliveryRate).not.toHaveBeenCalled();
  });

  it('returns all payments for admin', async () => {
    authUser.role = UserRole.ADMIN;
    paymentsServiceMock.findAllPayments.mockResolvedValue([{ id: 'pay-1' }, { id: 'pay-2' }]);

    const response = await request(app.getHttpServer()).get('/payments');

    expect(response.status).toBe(200);
    expect(paymentsServiceMock.findAllPayments).toHaveBeenCalled();
    expect(response.body).toHaveLength(2);
  });

  it('returns delivery rates for current vendor', async () => {
    vendorsServiceMock.findByUserId.mockResolvedValue({ id: 'vendor-1' });
    paymentsServiceMock.getDeliveryRates.mockResolvedValue([
      { id: 'rate-1', distanceKm: 5, chargeAmount: 150 },
    ]);

    const response = await request(app.getHttpServer()).get('/payments/delivery-rates');

    expect(response.status).toBe(200);
    expect(vendorsServiceMock.findByUserId).toHaveBeenCalledWith('vendor-user-1');
    expect(paymentsServiceMock.getDeliveryRates).toHaveBeenCalledWith('vendor-1');
  });

  it('returns delivery rates for a public vendor id', async () => {
    paymentsServiceMock.getDeliveryRates.mockResolvedValue([{ id: 'rate-1', distanceKm: 10 }]);

    const response = await request(app.getHttpServer())
      .get('/payments/delivery-rates/vendor/vendor-99');

    expect(response.status).toBe(200);
    expect(paymentsServiceMock.getDeliveryRates).toHaveBeenCalledWith('vendor-99');
  });

  it('updates delivery rate for current vendor', async () => {
    vendorsServiceMock.findByUserId.mockResolvedValue({ id: 'vendor-1' });
    paymentsServiceMock.updateDeliveryRate.mockResolvedValue({ id: 'rate-1', chargeAmount: 200 });

    const response = await request(app.getHttpServer())
      .patch('/payments/delivery-rates/rate-1')
      .send({ chargeAmount: '200', helpersCount: '1' });

    expect(response.status).toBe(200);
    expect(paymentsServiceMock.updateDeliveryRate).toHaveBeenCalledWith(
      'vendor-1',
      'rate-1',
      expect.objectContaining({ chargeAmount: 200, helpersCount: 1 }),
    );
  });

  it('deletes delivery rate for current vendor', async () => {
    vendorsServiceMock.findByUserId.mockResolvedValue({ id: 'vendor-1' });
    paymentsServiceMock.deleteDeliveryRate.mockResolvedValue(undefined);

    const response = await request(app.getHttpServer())
      .delete('/payments/delivery-rates/rate-1');

    expect(response.status).toBe(200);
    expect(paymentsServiceMock.deleteDeliveryRate).toHaveBeenCalledWith('vendor-1', 'rate-1');
  });

  it('marks payment as overdue', async () => {
    authUser.role = UserRole.ADMIN;
    paymentsServiceMock.markOverdue.mockResolvedValue({ id: 'pay-1', status: 'overdue' });

    const response = await request(app.getHttpServer())
      .patch('/payments/pay-1/overdue');

    expect(response.status).toBe(200);
    expect(paymentsServiceMock.markOverdue).toHaveBeenCalledWith('pay-1');
  });
});