import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./bookings.service', () => ({
  BookingsService: class BookingsService {},
}));

vi.mock('../vendors/vendors.service', () => ({
  VendorsService: class VendorsService {},
}));

vi.mock('./entities/booking.entity', () => ({
  Booking: class Booking {},
  BookingStatus: {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    CANCELLED: 'cancelled',
    COMPLETED: 'completed',
  },
}));

vi.mock('../users/entities/user.entity', () => ({
  UserRole: {
    ADMIN: 'admin',
    VENDOR: 'vendor',
    CUSTOMER: 'customer',
  },
}));

let BookingsController: any;
let BookingsServiceToken: any;
let VendorsServiceToken: any;
let JwtAuthGuardToken: any;
let RolesGuardToken: any;
let BookingStatus: any;
let UserRole: any;
let CreateBookingDto: any;
let VerifyPaymentDto: any;
let UpdateBookingStatusDto: any;

const authUser = {
  id: 'customer-1',
  role: 'customer',
};

const bookingsServiceMock = {
  findByCustomer: vi.fn(),
  findByVendor: vi.fn(),
  checkAvailability: vi.fn(),
  create: vi.fn(),
  createOrRefreshCheckout: vi.fn(),
  verifyPayMongoCheckout: vi.fn(),
  getCancellationPreview: vi.fn(),
  updateStatus: vi.fn(),
};

const vendorsServiceMock = {
  findByUserId: vi.fn(),
};

describe('BookingsController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ BookingsController } = await import('./bookings.controller'));
    ({ BookingsService: BookingsServiceToken } = await import('./bookings.service'));
    ({ VendorsService: VendorsServiceToken } = await import('../vendors/vendors.service'));
    ({ JwtAuthGuard: JwtAuthGuardToken } = await import('../auth/jwt-auth.guard'));
    ({ RolesGuard: RolesGuardToken } = await import('../auth/roles.guard'));
    ({ BookingStatus } = await import('./entities/booking.entity'));
    ({ UserRole } = await import('../users/entities/user.entity'));
    ({ CreateBookingDto } = await import('./dto/create-booking.dto'));
    ({ VerifyPaymentDto } = await import('./dto/verify-payment.dto'));
    ({ UpdateBookingStatusDto } = await import('./dto/update-booking-status.dto'));

    // Vitest transpilation here omits design-time constructor metadata.
    Reflect.defineMetadata(
      'design:paramtypes',
      [BookingsServiceToken, VendorsServiceToken],
      BookingsController,
    );

    Reflect.defineMetadata(
      'design:paramtypes',
      [Object, CreateBookingDto],
      BookingsController.prototype,
      'create',
    );
    Reflect.defineMetadata(
      'design:paramtypes',
      [Object, String, VerifyPaymentDto],
      BookingsController.prototype,
      'verifyPayment',
    );
    Reflect.defineMetadata(
      'design:paramtypes',
      [Object, String, UpdateBookingStatusDto],
      BookingsController.prototype,
      'updateStatus',
    );
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    authUser.id = 'customer-1';
    authUser.role = UserRole.CUSTOMER;

    const moduleRef = await Test.createTestingModule({
      controllers: [BookingsController],
      providers: [
        { provide: BookingsServiceToken, useValue: bookingsServiceMock },
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

  it('rejects invalid booking payloads before service create', async () => {
    const response = await request(app.getHttpServer())
      .post('/bookings')
      .send({
        startDate: '2026-05-20',
        endDate: '2026-05-21',
        items: [{ inventoryItemId: 'inv-1', quantity: 0 }],
      });

    expect(response.status).toBe(400);
    expect(bookingsServiceMock.create).not.toHaveBeenCalled();
  });

  it('creates booking with transformed payload and customer id', async () => {
    bookingsServiceMock.create.mockResolvedValue({ id: 'booking-1' });

    const response = await request(app.getHttpServer())
      .post('/bookings')
      .send({
        vendorId: 'vendor-1',
        startDate: '2026-05-20',
        endDate: '2026-05-21',
        items: [{ inventoryItemId: 'inv-1', quantity: '2' }],
        deliveryCharge: '250.75',
        serviceCharge: '50',
      });

    expect(response.status).toBe(201);
    expect(bookingsServiceMock.create).toHaveBeenCalledWith(
      'customer-1',
      expect.objectContaining({
        vendorId: 'vendor-1',
        items: [{ inventoryItemId: 'inv-1', quantity: 2 }],
        deliveryCharge: 250.75,
        serviceCharge: 50,
      }),
    );
  });

  it('passes checkout session id when verifying payment', async () => {
    bookingsServiceMock.verifyPayMongoCheckout.mockResolvedValue({
      id: 'booking-1',
      paymentStatus: 'paid',
    });

    const response = await request(app.getHttpServer())
      .post('/bookings/booking-1/payment/verify')
      .send({ checkoutSessionId: 'cs_test_123' });

    expect(response.status).toBe(201);
    expect(bookingsServiceMock.verifyPayMongoCheckout).toHaveBeenCalledWith(
      'booking-1',
      'customer-1',
      'cs_test_123',
    );
  });

  it('validates booking status enum before update', async () => {
    const response = await request(app.getHttpServer())
      .patch('/bookings/booking-1/status')
      .send({ status: 'invalid_status' });

    expect(response.status).toBe(400);
    expect(bookingsServiceMock.updateStatus).not.toHaveBeenCalled();
  });

  it('updates booking status with actor context', async () => {
    bookingsServiceMock.updateStatus.mockResolvedValue({
      id: 'booking-1',
      status: BookingStatus.CONFIRMED,
    });

    const response = await request(app.getHttpServer())
      .patch('/bookings/booking-1/status')
      .send({ status: BookingStatus.CONFIRMED });

    expect(response.status).toBe(200);
    expect(bookingsServiceMock.updateStatus).toHaveBeenCalledWith(
      'booking-1',
      BookingStatus.CONFIRMED,
      'customer-1',
      UserRole.CUSTOMER,
    );
  });

  it('resolves vendor bookings through vendor profile lookup', async () => {
    authUser.id = 'vendor-user-1';
    authUser.role = UserRole.VENDOR;
    vendorsServiceMock.findByUserId.mockResolvedValue({ id: 'vendor-1' });
    bookingsServiceMock.findByVendor.mockResolvedValue([{ id: 'booking-1' }]);

    const response = await request(app.getHttpServer()).get('/bookings/vendor');

    expect(response.status).toBe(200);
    expect(vendorsServiceMock.findByUserId).toHaveBeenCalledWith('vendor-user-1');
    expect(bookingsServiceMock.findByVendor).toHaveBeenCalledWith('vendor-1');
  });
});