import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  Booking,
  BookingPaymentStatus,
  BookingStatus,
} from './entities/booking.entity';
import { BookingItem } from './entities/booking-item.entity';
import { BookingMessage } from './entities/booking-message.entity';
import { BookingReview } from './entities/booking-review.entity';
import { BookingDeliveryProof } from './entities/booking-delivery-proof.entity';
import {
  BookingDocument,
  BookingDocumentIssuedTo,
  BookingDocumentType,
} from './entities/booking-document.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { VendorPayment, PaymentStatus } from '../payments/entities/vendor-payment.entity';
import { VendorPayout, VendorPayoutStatus } from '../payments/entities/vendor-payout.entity';
import { PricingCalculationService } from '../payments/services/pricing-calculation.service';
import { PricingConfigBootstrapService } from '../payments/services/pricing-config-bootstrap.service';
import { differenceInDays } from 'date-fns';
import { Vendor } from '../vendors/entities/vendor.entity';
import { SettingsService } from '../settings/settings.service';
import { User, UserRole } from '../users/entities/user.entity';
import { FraudService } from '../fraud/fraud.service';
import { FraudAlertSeverity, FraudAlertType } from '../fraud/entities/fraud-alert.entity';
import { RocketChatService } from '../chat/rocketchat.service';
import { createHash, createHmac } from 'crypto';
import { promises as fs } from 'fs';
import { dirname, isAbsolute, join } from 'path';

type CreateBookingPayload = {
  vendorId: string;
  startDate: string;
  endDate: string;
  items: { inventoryItemId: string; quantity: number }[];
  deliveryAddress?: string;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  deliveryCharge?: number;
  serviceCharge?: number;
  distanceKm?: number;
  helperCount?: number;
  waitingHours?: number;
  isNightDelivery?: boolean;
  notes?: string;
  depositPercentage?: number;
};

type NormalizedBookingItem = {
  inventoryItemId: string;
  quantity: number;
};

type PayMongoCheckoutResponse = {
  data?: {
    id?: string;
    attributes?: {
      checkout_url?: string;
      status?: string;
      payments?: Array<{ id?: string; attributes?: { status?: string } }>;
      payment_intent?: {
        id?: string;
        status?: string;
        attributes?: { status?: string };
      };
    };
  };
  errors?: Array<{ detail?: string; code?: string }>;
};

type CancellationPolicyCode =
  | 'full_refund_3_days'
  | 'half_refund_24_hours'
  | 'same_day_no_refund'
  | 'vendor_or_admin_full_refund';

type CancellationPreview = {
  bookingId: string;
  policyCode: CancellationPolicyCode;
  refundPercent: number;
  refundAmount: number;
  daysBeforeStartDate: number;
  isSameDayBooking: boolean;
  isPaidBooking: boolean;
};

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    @InjectRepository(Booking) private readonly bookingsRepo: Repository<Booking>,
    @InjectRepository(BookingItem) private readonly bookingItemsRepo: Repository<BookingItem>,
    @InjectRepository(InventoryItem) private readonly inventoryRepo: Repository<InventoryItem>,
    @InjectRepository(BookingMessage)
    private readonly bookingMessagesRepo: Repository<BookingMessage>,
    @InjectRepository(BookingReview)
    private readonly bookingReviewsRepo: Repository<BookingReview>,
    @InjectRepository(BookingDeliveryProof)
    private readonly bookingDeliveryProofRepo: Repository<BookingDeliveryProof>,
    @InjectRepository(BookingDocument)
    private readonly bookingDocumentsRepo: Repository<BookingDocument>,
    @InjectRepository(VendorPayment) private readonly paymentsRepo: Repository<VendorPayment>,
    @InjectRepository(VendorPayout) private readonly vendorPayoutsRepo: Repository<VendorPayout>,
    @InjectRepository(Vendor) private readonly vendorsRepo: Repository<Vendor>,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly settingsService: SettingsService,
    private readonly fraudService: FraudService,
    private readonly rocketchatService: RocketChatService,
    private readonly pricingBootstrapService: PricingConfigBootstrapService,
    private readonly pricingCalculationService: PricingCalculationService,
  ) {}

  findByVendor(vendorId: string) {
    return this.bookingsRepo.find({
      where: { vendorId },
      relations: [
        'customer',
        'items',
        'items.inventoryItem',
        'items.inventoryItem.itemType',
        'items.inventoryItem.brand',
      ],
      order: { createdAt: 'DESC' },
    });
  }

  findByCustomer(customerId: string) {
    return this.bookingsRepo.find({
      where: { customerId },
      relations: [
        'vendor',
        'items',
        'items.inventoryItem',
        'items.inventoryItem.itemType',
        'items.inventoryItem.brand',
      ],
      order: { createdAt: 'DESC' },
    });
  }

  findById(id: string) {
    return this.bookingsRepo.findOne({
      where: { id },
      relations: [
        'customer',
        'vendor',
        'vendor.user',
        'items',
        'items.inventoryItem',
        'items.inventoryItem.itemType',
        'items.inventoryItem.brand',
        'deliveryProofs',
      ],
    });
  }

  async create(customerId: string, data: CreateBookingPayload, createdFromIp?: string) {
    if (!Array.isArray(data.items) || data.items.length === 0) {
      throw new BadRequestException('At least one booking item is required');
    }

    const { startDate, endDate } = this.parseBookingDateRange(
      data.startDate,
      data.endDate,
    );
    const normalizedItems = this.normalizeBookingItems(data.items);
    const requestedDeliveryCharge = this.parseNonNegativeMoney(
      data.deliveryCharge,
      'deliveryCharge',
    );
    const requestedServiceCharge = this.parseNonNegativeMoney(
      data.serviceCharge,
      'serviceCharge',
    );
    const helperCount =
      this.parseOptionalNonNegativeInteger(data.helperCount, 'helperCount') || 0;
    const waitingHours =
      this.parseOptionalNonNegativeNumber(data.waitingHours, 'waitingHours') || 0;
    const isNightDelivery = this.parseOptionalBoolean(data.isNightDelivery, false);
    const { deliveryLatitude, deliveryLongitude } =
      this.normalizeDeliveryCoordinates(
        data.deliveryLatitude,
        data.deliveryLongitude,
      );

    const vendor = await this.vendorsRepo.findOne({ where: { id: data.vendorId } });
    if (!vendor) {
      throw new BadRequestException('Vendor not found');
    }

    const resolvedDistanceKm = this.resolveDistanceKmForPricing(
      data.distanceKm,
      vendor,
      deliveryLatitude,
      deliveryLongitude,
    );

    // Check vendor has no overdue payments
    const overduePayment = await this.paymentsRepo.findOne({
      where: { vendorId: data.vendorId, status: PaymentStatus.OVERDUE },
    });
    if (overduePayment) {
      throw new BadRequestException(
        'Vendor has overdue payments and cannot accept bookings',
      );
    }

    const commissionRate = await this.resolveCommissionRateForBooking(
      vendor.commissionRate,
    );

    const fraudSignals = await this.detectFraudSignalsOnCreate({
      customerId,
      vendor,
      totalAmountEstimate: normalizedItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
      createdFromIp,
    });

    // Full-payment flow: collect 100% at checkout, no remaining balance.
    const depositPercentage = 100;

    const createdBooking = await this.dataSource.transaction(async (manager) => {
      const days = Math.max(1, differenceInDays(endDate, startDate) + 1);

      let subtotalItems = 0;
      const bookingItems: Partial<BookingItem>[] = [];

      for (const item of normalizedItems) {
        const invItem = await manager.findOne(InventoryItem, {
          where: { id: item.inventoryItemId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!invItem) {
          throw new BadRequestException(`Item ${item.inventoryItemId} not found`);
        }

        const bookedQuantityRaw = await manager
          .createQueryBuilder(BookingItem, 'bookingItem')
          .innerJoin(Booking, 'booking', 'booking.id = bookingItem.bookingId')
          .where('booking.vendorId = :vendorId', { vendorId: data.vendorId })
          .andWhere('bookingItem.inventoryItemId = :inventoryItemId', {
            inventoryItemId: item.inventoryItemId,
          })
          .andWhere('booking.status IN (:...statuses)', {
            statuses: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
          })
          .andWhere('booking.endDate >= :requestedStartDate', {
            requestedStartDate: startDate,
          })
          .andWhere('booking.startDate <= :requestedEndDate', {
            requestedEndDate: endDate,
          })
          .select('COALESCE(SUM(bookingItem.quantity), 0)', 'total')
          .getRawOne<{ total: string | number }>();

        const bookedQuantity = Number(bookedQuantityRaw?.total || 0);

        const availableQuantity = Number(invItem.quantity) - bookedQuantity;

        if (availableQuantity < item.quantity) {
          throw new BadRequestException(`Insufficient availability for item ${item.inventoryItemId}. Only ${availableQuantity} available for the selected dates.`);
        }

        const subtotal = Number(invItem.ratePerDay) * item.quantity * days;
        subtotalItems += subtotal;
        bookingItems.push({ inventoryItemId: item.inventoryItemId, quantity: item.quantity, ratePerDay: invItem.ratePerDay, subtotal });
      }

      let delivery = requestedDeliveryCharge;
      let service = requestedServiceCharge;

      if (resolvedDistanceKm !== null) {
        await this.pricingBootstrapService.bootstrapPricingConfigForVendor(
          data.vendorId,
        );

        const quote = await this.pricingCalculationService.calculateQuote(
          data.vendorId,
          subtotalItems,
          resolvedDistanceKm,
          helperCount,
          waitingHours,
          isNightDelivery,
        );

        delivery = this.toMoney(quote.deliveryFee);
        service = this.toMoney(
          quote.helperFee + quote.waitingFee + quote.nightSurcharge,
        );
      } else if (helperCount > 0 || waitingHours > 0 || isNightDelivery) {
        throw new BadRequestException(
          'distanceKm or delivery coordinates are required to calculate helper and surcharge fees',
        );
      }

      const totalAmount = subtotalItems + delivery + service;
      const platformFee = totalAmount * commissionRate;
      const depositAmount = this.toMoney(totalAmount);
      const remainingBalanceAmount = 0;

      const booking = manager.create(Booking, {
        customerId,
        vendorId: data.vendorId,
        startDate,
        endDate,
        deliveryAddress: data.deliveryAddress,
        deliveryLatitude,
        deliveryLongitude,
        deliveryCharge: delivery,
        serviceCharge: service,
        platformFee,
        totalAmount,
        depositPercentage,
        depositAmount,
        remainingBalanceAmount,
        totalPaidAmount: 0,
        escrowHeldAmount: 0,
        escrowReleasedAmount: 0,
        notes: data.notes,
        status: BookingStatus.PENDING,
        paymentStatus: this.isPayMongoEnabled()
          ? BookingPaymentStatus.PENDING
          : BookingPaymentStatus.UNPAID,
        paymentProvider: this.isPayMongoEnabled() ? 'paymongo' : null,
        fraudRiskScore: fraudSignals.score,
        createdFromIp: createdFromIp || null,
      });
      const savedBooking = await manager.save(booking);

      for (const bi of bookingItems) {
        bi.bookingId = savedBooking.id;
        await manager.save(manager.create(BookingItem, bi));
      }

      return savedBooking;
    });

    await this.ensureVendorPayoutRecord(createdBooking.id);

    if (fraudSignals.score >= 45) {
      await this.fraudService.createAlert({
        type: FraudAlertType.BOOKING_RISK,
        severity: fraudSignals.score >= 75 ? FraudAlertSeverity.CRITICAL : FraudAlertSeverity.HIGH,
        title: 'High-risk booking detected',
        description: `Booking ${createdBooking.id} triggered fraud checks: ${fraudSignals.reasons.join(', ')}`,
        userId: customerId,
        vendorId: createdBooking.vendorId,
        bookingId: createdBooking.id,
        metadata: {
          score: fraudSignals.score,
          reasons: fraudSignals.reasons,
          createdFromIp: createdFromIp || null,
        },
      });
    }

    if (this.isPayMongoEnabled()) {
      try {
        await this.createPayMongoCheckoutForBooking(
          createdBooking.id,
          customerId,
          false,
          false,
        );
      } catch (error) {
        this.logger.error(
          `PayMongo checkout failed for booking ${createdBooking.id}`,
          error instanceof Error ? error.stack : String(error),
        );

        await this.bookingsRepo.update(createdBooking.id, {
          status: BookingStatus.CANCELLED,
          paymentStatus: BookingPaymentStatus.FAILED,
        });

        throw error;
      }
    }

    const createdBookingWithRelations = await this.findById(createdBooking.id);
    if (createdBookingWithRelations) {
      await this.tryEnsureBookingDocuments(createdBookingWithRelations.id);
    }

    // Provision Rocket.Chat room — fire-and-forget so RC downtime never
    // blocks booking creation.
    this.provisionBookingChatRoom(
      createdBooking.id,
      customerId,
      vendor.userId,
    ).catch((err: unknown) => {
      this.logger.warn(
        `RC room provisioning failed for booking ${createdBooking.id}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    });

    return createdBookingWithRelations;
  }

  private async provisionBookingChatRoom(
    bookingId: string,
    customerId: string,
    vendorUserId: string,
  ): Promise<void> {
    const [customer, vendorUser] = await Promise.all([
      this.usersRepo.findOne({ where: { id: customerId } }),
      this.usersRepo.findOne({ where: { id: vendorUserId } }),
    ]);

    if (!customer || !vendorUser) {
      this.logger.warn(
        `Cannot provision RC room for booking ${bookingId}: user(s) not found`,
      );
      return;
    }

    const roomId = await this.rocketchatService.ensureBookingRoom(
      bookingId,
      customerId,
      customer.name,
      customer.email,
      vendorUserId,
      vendorUser.name,
      vendorUser.email,
    );

    await this.bookingsRepo.update(bookingId, { rocketchatRoomId: roomId });
    this.logger.log(
      `RC room provisioned for booking ${bookingId}: roomId=${roomId}`,
    );
  }

  async setRocketchatRoomId(bookingId: string, roomId: string): Promise<void> {
    await this.bookingsRepo.update(bookingId, { rocketchatRoomId: roomId });
  }

  async createOrRefreshCheckout(bookingId: string, customerId: string) {
    const booking = await this.findById(bookingId);
    if (!booking || booking.customerId !== customerId) {
      throw new NotFoundException('Booking not found');
    }

    if ([BookingStatus.CANCELLED, BookingStatus.COMPLETED].includes(booking.status)) {
      throw new BadRequestException('Checkout is unavailable for this booking status');
    }

    if (!this.isPayMongoEnabled()) {
      throw new BadRequestException('Online payment checkout is not enabled');
    }

    if (
      [
        BookingPaymentStatus.PAID,
        BookingPaymentStatus.HELD,
        BookingPaymentStatus.COMPLETED,
      ].includes(booking.paymentStatus)
    ) {
      return booking;
    }

    await this.createPayMongoCheckoutForBooking(booking.id, customerId, true, false);
    const verifiedBooking = await this.findById(booking.id);
    if (verifiedBooking) {
      await this.tryEnsureBookingDocuments(verifiedBooking.id);
    }

    return verifiedBooking;
  }

  async createRemainingBalanceCheckout(bookingId: string, customerId: string) {
    const booking = await this.findById(bookingId);
    if (!booking || booking.customerId !== customerId) {
      throw new NotFoundException('Booking not found');
    }

    throw new BadRequestException(
      'Remaining-balance checkout is no longer supported. Full payment is required at booking checkout.',
    );
  }

  async verifyPayMongoCheckout(
    bookingId: string,
    customerId: string,
    checkoutSessionId?: string,
  ) {
    const booking = await this.findById(bookingId);
    if (!booking || booking.customerId !== customerId) {
      throw new NotFoundException('Booking not found');
    }

    if ([BookingStatus.CANCELLED, BookingStatus.COMPLETED].includes(booking.status)) {
      throw new BadRequestException('Payment verification is unavailable for this booking status');
    }

    if (
      [BookingPaymentStatus.HELD, BookingPaymentStatus.COMPLETED].includes(
        booking.paymentStatus,
      )
    ) {
      return booking;
    }

    if (booking.paymentStatus === BookingPaymentStatus.PAID) {
      return booking;
    }

    if (!this.isPayMongoEnabled()) {
      throw new BadRequestException('Online payment checkout is not enabled');
    }

    if ((booking.paymentProvider || '').toLowerCase() !== 'paymongo') {
      throw new BadRequestException('Booking is not linked to PayMongo checkout');
    }

    const storedSessionId = String(booking.paymentCheckoutSessionId || '').trim();
    if (!storedSessionId) {
      throw new BadRequestException('Missing checkout session ID');
    }

    const requestedSessionId = String(checkoutSessionId || '').trim();
    if (requestedSessionId && requestedSessionId !== storedSessionId) {
      throw new BadRequestException(
        'Provided checkout session does not match this booking',
      );
    }

    const sessionPayload = await this.fetchPayMongoCheckoutSession(storedSessionId);
    const checkoutReference = this.extractPayMongoCheckoutReference(sessionPayload);
    if (checkoutReference && checkoutReference !== `booking_${booking.id}`) {
      throw new BadRequestException(
        'Checkout session reference does not belong to this booking',
      );
    }

    if (!this.checkoutLooksPaid(sessionPayload)) {
      throw new BadRequestException('Payment is not completed yet');
    }

    const paymentReference =
      this.extractPayMongoPaymentReference(sessionPayload) ||
      booking.paymentReference ||
      storedSessionId;

    const paidAt = new Date();
    const nextTotalPaid = this.toMoney(booking.totalAmount);

    await this.bookingsRepo.update(booking.id, {
      paymentStatus: BookingPaymentStatus.HELD,
      paymentPaidAt: paidAt,
      paymentReference,
      totalPaidAmount: nextTotalPaid,
      escrowHeldAmount: nextTotalPaid,
      remainingBalanceAmount: 0,
      depositPaidAt: paidAt,
      finalPaymentPaidAt: paidAt,
      escrowHeldAt: paidAt,
      paymentCheckoutSessionId: null,
      paymentCheckoutUrl: null,
    });

    await this.vendorPayoutsRepo.update(
      { bookingId: booking.id },
      {
        status: VendorPayoutStatus.HELD,
        heldAt: paidAt,
        outstandingBalanceAmount: 0,
      },
    );

    return this.findById(booking.id);
  }

  async verifyRemainingBalancePayment(
    bookingId: string,
    customerId: string,
    checkoutSessionId?: string,
  ) {
    return this.verifyPayMongoCheckout(bookingId, customerId, checkoutSessionId);
  }

  async getCancellationPreview(
    id: string,
    actorUserId: string,
    actorRole: UserRole,
  ): Promise<CancellationPreview> {
    const booking = await this.findById(id);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    this.assertCanAccessBooking(booking, actorUserId, actorRole);

    if ([BookingStatus.CANCELLED, BookingStatus.COMPLETED].includes(booking.status)) {
      throw new BadRequestException('Cancellation preview is unavailable for this booking status');
    }

    return this.buildCancellationPreview(booking, actorRole);
  }

  async updateStatus(
    id: string,
    status: BookingStatus,
    actorUserId: string,
    actorRole: UserRole,
  ) {
    const booking = await this.findById(id);
    if (!booking) throw new NotFoundException('Booking not found');

    this.assertCanAccessBooking(booking, actorUserId, actorRole);

    if (status === BookingStatus.CANCELLED) {
      return this.cancelBooking(booking, actorUserId, actorRole);
    }

    this.assertCanUpdateStatus(booking, status, actorRole);

    if (
      status === BookingStatus.CONFIRMED &&
      (booking.paymentProvider || '').toLowerCase() === 'paymongo' &&
      ![
        BookingPaymentStatus.PAID,
        BookingPaymentStatus.HELD,
        BookingPaymentStatus.COMPLETED,
      ].includes(booking.paymentStatus)
    ) {
      throw new BadRequestException(
        'Booking cannot be confirmed until payment is completed',
      );
    }

    if (status === BookingStatus.COMPLETED) {
      const proofCount = await this.bookingDeliveryProofRepo.count({
        where: { bookingId: id },
      });
      if (!proofCount) {
        throw new BadRequestException(
          'Delivery proof must be uploaded before marking booking as completed',
        );
      }

      if (
        ![
          BookingPaymentStatus.PAID,
          BookingPaymentStatus.HELD,
          BookingPaymentStatus.COMPLETED,
        ].includes(booking.paymentStatus)
      ) {
        throw new BadRequestException(
          'Booking must be paid before completing this booking',
        );
      }
    }

    await this.bookingsRepo.update(id, { status });

    if (status === BookingStatus.COMPLETED) {
      if (booking.customerConfirmedDeliveryAt) {
        await this.vendorPayoutsRepo.update(
          { bookingId: id },
          {
            status: VendorPayoutStatus.READY,
            releaseOn: await this.computeVendorPayoutReleaseOn(booking.vendorId),
          },
        );
      } else {
        await this.vendorPayoutsRepo.update(
          { bookingId: id },
          {
            status: VendorPayoutStatus.HELD,
            heldAt: booking.escrowHeldAt || new Date(),
          },
        );
      }
    }

    const updatedBooking = await this.findById(id);
    if (updatedBooking) {
      await this.tryEnsureBookingDocuments(updatedBooking.id);
    }

    return updatedBooking;
  }

  async uploadDeliveryProof(
    bookingId: string,
    vendorUserId: string,
    payload: {
      photoUrl?: string;
      signatureUrl?: string;
      note?: string;
      capturedAt?: string;
    },
  ) {
    const booking = await this.findById(bookingId);
    if (!booking || booking.vendor?.userId !== vendorUserId) {
      throw new NotFoundException('Booking not found');
    }

    if ([BookingStatus.CANCELLED].includes(booking.status)) {
      throw new BadRequestException('Cannot upload delivery proof for cancelled booking');
    }

    if (
      ![BookingStatus.CONFIRMED, BookingStatus.COMPLETED].includes(booking.status)
    ) {
      throw new BadRequestException(
        'Delivery proof can only be uploaded after booking is confirmed',
      );
    }

    const photoUrl = String(payload.photoUrl || '').trim();
    if (!photoUrl) {
      throw new BadRequestException('Delivery proof photo is required');
    }

    const capturedAt = payload.capturedAt ? new Date(payload.capturedAt) : new Date();
    if (Number.isNaN(capturedAt.getTime())) {
      throw new BadRequestException('capturedAt must be a valid datetime');
    }

    await this.bookingDeliveryProofRepo.save(
      this.bookingDeliveryProofRepo.create({
        bookingId,
        vendorId: booking.vendorId,
        photoUrl,
        signatureUrl: payload.signatureUrl || null,
        note: payload.note || null,
        capturedAt,
      }),
    );

    await this.bookingsRepo.update(bookingId, {
      vendorMarkedDeliveredAt: new Date(),
    });

    const confirmedBooking = await this.findById(bookingId);
    if (confirmedBooking) {
      await this.tryEnsureBookingDocuments(confirmedBooking.id);
    }

    return confirmedBooking;
  }

  async confirmDelivery(
    bookingId: string,
    actorUserId: string,
    actorRole: UserRole,
  ) {
    const booking = await this.findById(bookingId);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    this.assertCanAccessBooking(booking, actorUserId, actorRole);
    if (actorRole !== UserRole.CUSTOMER || booking.customerId !== actorUserId) {
      throw new ForbiddenException('Only the booking customer can confirm delivery');
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('Cancelled bookings cannot be confirmed');
    }

    if (booking.customerConfirmedDeliveryAt) {
      return booking;
    }

    if (
      ![
        BookingPaymentStatus.PAID,
        BookingPaymentStatus.HELD,
        BookingPaymentStatus.COMPLETED,
      ].includes(booking.paymentStatus)
    ) {
      throw new BadRequestException(
        'Payment must be settled before delivery can be confirmed',
      );
    }

    const proofCount = await this.bookingDeliveryProofRepo.count({
      where: { bookingId },
    });
    if (!proofCount) {
      throw new BadRequestException('Vendor delivery proof is required before confirmation');
    }

    await this.bookingsRepo.update(bookingId, {
      status: BookingStatus.COMPLETED,
      customerConfirmedDeliveryAt: new Date(),
      customerConfirmedDeliveryByUserId: actorUserId,
      paymentStatus: BookingPaymentStatus.COMPLETED,
      totalPaidAmount: this.toMoney(booking.totalAmount),
      remainingBalanceAmount: 0,
      escrowReleasedAt: new Date(),
      escrowReleasedAmount: booking.escrowHeldAmount,
    });

    await this.vendorPayoutsRepo.update(
      { bookingId },
      {
        status: VendorPayoutStatus.READY,
        releaseOn: await this.computeVendorPayoutReleaseOn(booking.vendorId),
        outstandingBalanceAmount: 0,
      },
    );

    await this.vendorsRepo.increment(
      { id: booking.vendorId },
      'successfulCompletedOrders',
      1,
    );

    return this.findById(bookingId);
  }

  async listMessages(bookingId: string, actorUserId: string, actorRole: UserRole) {
    const booking = await this.findById(bookingId);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    this.assertCanAccessBooking(booking, actorUserId, actorRole);

    return this.bookingMessagesRepo.find({
      where: { bookingId },
      order: { createdAt: 'ASC' },
    });
  }

  async sendMessage(
    bookingId: string,
    actorUserId: string,
    actorRole: UserRole,
    contentInput: string,
  ) {
    const booking = await this.findById(bookingId);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    this.assertCanAccessBooking(booking, actorUserId, actorRole);

    const content = String(contentInput || '').trim();
    if (!content) {
      throw new BadRequestException('Message content is required');
    }

    const analysis = this.fraudService.analyzeMessageContent(content);
    const saved = await this.bookingMessagesRepo.save(
      this.bookingMessagesRepo.create({
        bookingId,
        senderUserId: actorUserId,
        senderRole: actorRole,
        content,
        redactedContent: analysis.redactedContent,
        isFlagged: analysis.isFlagged,
        flagReasons: analysis.reasons.length
          ? JSON.stringify(analysis.reasons)
          : null,
      }),
    );

    if (analysis.isFlagged) {
      await this.fraudService.createAlert({
        type: FraudAlertType.OFF_PLATFORM_MESSAGE,
        severity: FraudAlertSeverity.HIGH,
        title: 'Potential off-platform transaction attempt',
        description: `Flagged message in booking ${bookingId}: ${analysis.reasons.join(', ')}`,
        userId: actorUserId,
        vendorId: booking.vendorId,
        bookingId,
        messageId: saved.id,
        metadata: {
          reasons: analysis.reasons,
        },
      });
    }

    return saved;
  }

  async listReviews(bookingId: string, actorUserId: string, actorRole: UserRole) {
    const booking = await this.findById(bookingId);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    this.assertCanAccessBooking(booking, actorUserId, actorRole);

    return this.bookingReviewsRepo.find({
      where: { bookingId },
      relations: ['reviewerUser', 'revieweeUser'],
      order: { createdAt: 'ASC' },
    });
  }

  async submitReview(
    bookingId: string,
    actorUserId: string,
    actorRole: UserRole,
    ratingInput: number,
    commentInput?: string,
  ) {
    const booking = await this.findById(bookingId);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    this.assertCanAccessBooking(booking, actorUserId, actorRole);

    if (booking.status !== BookingStatus.COMPLETED) {
      throw new BadRequestException('Reviews are allowed only after booking completion');
    }

    const rating = Math.round(Number(ratingInput));
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new BadRequestException('rating must be between 1 and 5');
    }

    let revieweeUserId: string;
    let revieweeRole: UserRole;

    if (actorRole === UserRole.CUSTOMER && booking.customerId === actorUserId) {
      revieweeUserId = booking.vendor?.userId;
      revieweeRole = UserRole.VENDOR;
    } else if (actorRole === UserRole.VENDOR && booking.vendor?.userId === actorUserId) {
      revieweeUserId = booking.customerId;
      revieweeRole = UserRole.CUSTOMER;
    } else {
      throw new ForbiddenException('Only booking customer/vendor can review each other');
    }

    if (!revieweeUserId) {
      throw new BadRequestException('Unable to determine review recipient');
    }

    const existingReview = await this.bookingReviewsRepo.findOne({
      where: {
        bookingId,
        reviewerUserId: actorUserId,
      },
    });

    if (existingReview) {
      existingReview.rating = rating;
      existingReview.comment = String(commentInput || '').trim() || null;
      existingReview.revieweeUserId = revieweeUserId;
      existingReview.revieweeRole = revieweeRole;
      await this.bookingReviewsRepo.save(existingReview);
    } else {
      await this.bookingReviewsRepo.save(
        this.bookingReviewsRepo.create({
          bookingId,
          reviewerUserId: actorUserId,
          reviewerRole: actorRole,
          revieweeUserId,
          revieweeRole,
          rating,
          comment: String(commentInput || '').trim() || null,
        }),
      );
    }

    await this.refreshReputationForReviewee(revieweeUserId, revieweeRole);
    return this.listReviews(bookingId, actorUserId, actorRole);
  }

  async listDocuments(
    bookingId: string,
    actorUserId: string,
    actorRole: UserRole,
  ) {
    const booking = await this.findById(bookingId);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    this.assertCanAccessBooking(booking, actorUserId, actorRole);

    await this.tryEnsureBookingDocuments(booking.id);

    const documents = await this.bookingDocumentsRepo.find({
      where: { bookingId },
      order: { generatedAt: 'DESC' },
    });

    if (actorRole === UserRole.ADMIN) {
      return documents;
    }

    if (actorRole === UserRole.CUSTOMER) {
      return documents.filter((document) =>
        [BookingDocumentIssuedTo.CUSTOMER, BookingDocumentIssuedTo.BOTH].includes(
          document.issuedTo,
        ),
      );
    }

    return documents.filter((document) =>
      [BookingDocumentIssuedTo.VENDOR, BookingDocumentIssuedTo.BOTH].includes(
        document.issuedTo,
      ),
    );
  }

  async generateDocumentsForBooking(
    bookingId: string,
    actorUserId: string,
    actorRole: UserRole,
  ) {
    const booking = await this.findById(bookingId);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    this.assertCanAccessBooking(booking, actorUserId, actorRole);

    await this.ensureBookingDocuments(booking.id, true);
    return this.listDocuments(booking.id, actorUserId, actorRole);
  }

  async getDocumentDownloadPayload(
    bookingId: string,
    documentId: string,
    actorUserId: string,
    actorRole: UserRole,
  ) {
    const booking = await this.findById(bookingId);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    this.assertCanAccessBooking(booking, actorUserId, actorRole);

    const document = await this.bookingDocumentsRepo.findOne({
      where: { id: documentId, bookingId },
    });
    if (!document) {
      throw new NotFoundException('Booking document not found');
    }

    this.assertCanAccessDocument(document, actorRole);

    const absolutePath = this.resolveAbsoluteDocumentPath(document.filePath);
    try {
      await fs.access(absolutePath);
    } catch {
      throw new NotFoundException('Booking document file is unavailable');
    }

    return {
      absolutePath,
      fileName: document.fileName,
      mimeType: 'application/pdf',
    };
  }

  async checkAvailability(vendorId: string, startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Get all active bookings for this vendor that overlap with the requested date range
    const overlappingBookings = await this.bookingsRepo.find({
      where: { vendorId },
      relations: ['items'],
    });

    // Filter to only active bookings that overlap with the requested dates
    const activeOverlappingBookings = overlappingBookings.filter(b =>
      [BookingStatus.PENDING, BookingStatus.CONFIRMED].includes(b.status) &&
      new Date(b.endDate) >= start &&
      new Date(b.startDate) <= end
    );

    // Get all inventory items for this vendor
    const inventory = await this.inventoryRepo.find({ where: { vendorId }, relations: ['itemType', 'brand'] });

    // Calculate available quantities for each item considering overlapping bookings
    const availabilityMap = new Map<string, { inventory: InventoryItem; available: number }>();

    for (const item of inventory) {
      const bookedQuantity = activeOverlappingBookings.reduce((sum, booking) => {
        const bookingItem = booking.items?.find(bi => bi.inventoryItemId === item.id);
        return sum + (bookingItem?.quantity || 0);
      }, 0);

      availabilityMap.set(item.id, {
        inventory: item,
        available: Math.max(0, Number(item.quantity) - bookedQuantity),
      });
    }

    // Convert to array format
    return Array.from(availabilityMap.values());
  }

  private async resolveCommissionRateForBooking(rawRate?: number | string | null) {
    const fallbackRate = this.parseCommissionRate(rawRate, 0.1);

    try {
      const flags = await this.settingsService.getFeatureFlagsSettings();

      if (
        flags.launchNoCommissionEnabled &&
        this.isNoCommissionWindowActive(flags.launchNoCommissionUntil)
      ) {
        return 0;
      }

      return this.parseCommissionRate(
        flags.defaultPlatformCommissionRatePercent,
        fallbackRate,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to resolve feature-flag commission rate, falling back to vendor rate: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return fallbackRate;
    }
  }

  private isNoCommissionWindowActive(until: string | null) {
    if (!until) return true;
    const timestamp = Date.parse(until);
    if (Number.isNaN(timestamp)) return true;
    return Date.now() <= timestamp;
  }

  private parseCommissionRate(rawRate?: number | string | null, fallback = 0.1) {
    const parsed = Number(rawRate);
    if (!Number.isFinite(parsed) || parsed < 0) return fallback;

    if (parsed <= 1) {
      return parsed;
    }

    return parsed / 100;
  }

  private async cancelBooking(
    booking: Booking,
    actorUserId: string,
    actorRole: UserRole,
  ) {
    if ([BookingStatus.CANCELLED, BookingStatus.COMPLETED].includes(booking.status)) {
      throw new BadRequestException('Booking cannot be cancelled from its current status');
    }

    const preview = await this.buildCancellationPreview(booking, actorRole);
    const paidAmount = this.resolvePaidAmountForRefund(booking);
    const shouldMarkFullyRefunded =
      paidAmount > 0 &&
      preview.refundAmount >= paidAmount;

    // Attempt PayMongo refund (best-effort — booking is cancelled regardless of refund outcome)
    if (
      paidAmount > 0 &&
      preview.refundAmount > 0
    ) {
      await this.executePayMongoRefund(booking, preview.refundAmount);
    }

    await this.bookingsRepo.update(booking.id, {
      status: BookingStatus.CANCELLED,
      cancelledAt: new Date(),
      cancellationRequestedByUserId: actorUserId,
      cancellationRequestedByRole: actorRole,
      cancellationPolicyCode: preview.policyCode,
      cancellationRefundPercent: preview.refundPercent,
      cancellationRefundAmount: preview.refundAmount,
      paymentStatus: shouldMarkFullyRefunded
        ? BookingPaymentStatus.REFUNDED
        : booking.paymentStatus,
      paymentCheckoutSessionId: null,
      paymentCheckoutUrl: null,
    });

    await this.vendorPayoutsRepo.update(
      { bookingId: booking.id },
      {
        status: shouldMarkFullyRefunded
          ? VendorPayoutStatus.REFUNDED
          : VendorPayoutStatus.CANCELLED,
        notes: preview.refundAmount > 0
          ? `Cancelled with refund ${preview.refundAmount} (${preview.refundPercent}%).`
          : 'Cancelled without refund.',
      },
    );

    return this.findById(booking.id);
  }

  private async buildCancellationPreview(
    booking: Booking,
    actorRole: UserRole,
  ): Promise<CancellationPreview> {
    const startDate = this.toDateOnly(booking.startDate);
    const today = this.toDateOnly(new Date());
    const daysBeforeStartDate = this.diffCalendarDays(startDate, today);
    const isSameDayBooking = daysBeforeStartDate <= 0;
    const paidAmount = this.resolvePaidAmountForRefund(booking);
    const isPaidBooking = paidAmount > 0;

    const policy = await this.resolveCancellationPolicy(actorRole, daysBeforeStartDate);
    const refundAmount = isPaidBooking
      ? this.toMoney((paidAmount * policy.refundPercent) / 100)
      : 0;

    return {
      bookingId: booking.id,
      policyCode: policy.policyCode,
      refundPercent: policy.refundPercent,
      refundAmount,
      daysBeforeStartDate,
      isSameDayBooking,
      isPaidBooking,
    };
  }

  private async resolveCancellationPolicy(
    actorRole: UserRole,
    daysBeforeStartDate: number,
  ): Promise<{ policyCode: CancellationPolicyCode; refundPercent: number }> {
    if (actorRole !== UserRole.CUSTOMER) {
      return {
        policyCode: 'vendor_or_admin_full_refund',
        refundPercent: 100,
      };
    }

    let fullRefundMinDays = 3;
    let halfRefundMinDays = 1;
    let halfRefundPercent = 50;
    try {
      const flags = await this.settingsService.getFeatureFlagsSettings();
      fullRefundMinDays = flags.cancellationFullRefundMinDays;
      halfRefundMinDays = flags.cancellationHalfRefundMinDays;
      halfRefundPercent = flags.cancellationHalfRefundPercent;
    } catch {
      this.logger.warn('Failed to load cancellation policy settings, using defaults');
    }

    if (daysBeforeStartDate >= fullRefundMinDays) {
      return {
        policyCode: 'full_refund_3_days',
        refundPercent: 100,
      };
    }

    if (daysBeforeStartDate >= halfRefundMinDays) {
      return {
        policyCode: 'half_refund_24_hours',
        refundPercent: halfRefundPercent,
      };
    }

    return {
      policyCode: 'same_day_no_refund',
      refundPercent: 0,
    };
  }

  private async executePayMongoRefund(
    booking: Booking,
    refundAmount: number,
  ): Promise<void> {
    if (!this.isPayMongoEnabled()) return;

    const rawRef = String(booking.paymentReference || '').trim();
    if (!rawRef || !rawRef.startsWith('pay_')) {
      this.logger.warn(
        `Skipping PayMongo refund for booking ${booking.id}: stored reference "${rawRef}" is not a payment ID (pay_xxx)`,
      );
      return;
    }

    const secretKey = String(process.env.PAYMONGO_SECRET_KEY || '').trim();
    if (!secretKey) return;

    const baseApi = String(
      process.env.PAYMONGO_API_BASE_URL || 'https://api.paymongo.com/v1',
    ).replace(/\/$/, '');
    const amountMinor = this.toMinorUnits(refundAmount);
    if (amountMinor <= 0) return;

    const payload = {
      data: {
        attributes: {
          amount: amountMinor,
          payment_id: rawRef,
          reason: 'others',
          notes: `Booking ${booking.id} cancelled. Policy: ${
            booking.cancellationPolicyCode || 'unknown'
          }`,
        },
      },
    };

    try {
      const response = await fetch(`${baseApi}/refunds`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as Record<string, any>;
      if (!response.ok) {
        this.logger.error(
          `PayMongo refund failed for booking ${booking.id}: ${JSON.stringify(data?.errors || data)}`,
        );
        return;
      }

      this.logger.log(
        `PayMongo refund initiated for booking ${booking.id}: refund ID ${
          data?.data?.id
        }, amount ${refundAmount}`,
      );
    } catch (error) {
      this.logger.error(
        `PayMongo refund exception for booking ${booking.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private assertCanAccessBooking(
    booking: Booking,
    actorUserId: string,
    actorRole: UserRole,
  ) {
    if (actorRole === UserRole.ADMIN) {
      return;
    }

    if (actorRole === UserRole.CUSTOMER && booking.customerId === actorUserId) {
      return;
    }

    if (actorRole === UserRole.VENDOR && booking.vendor?.userId === actorUserId) {
      return;
    }

    throw new ForbiddenException('You do not have access to this booking');
  }

  private assertCanUpdateStatus(
    booking: Booking,
    nextStatus: BookingStatus,
    actorRole: UserRole,
  ) {
    if (actorRole === UserRole.ADMIN) {
      return;
    }

    if (actorRole === UserRole.CUSTOMER) {
      throw new ForbiddenException('Customers can only cancel their own bookings');
    }

    if (actorRole === UserRole.VENDOR) {
      if (
        ![
          BookingStatus.CONFIRMED,
          BookingStatus.COMPLETED,
          BookingStatus.CANCELLED,
        ].includes(nextStatus)
      ) {
        throw new ForbiddenException('Vendors cannot set this booking status');
      }

      if (nextStatus === BookingStatus.COMPLETED && booking.status !== BookingStatus.CONFIRMED) {
        throw new BadRequestException('Only confirmed bookings can be marked completed');
      }

      return;
    }

    throw new ForbiddenException('You do not have permission to update this booking');
  }

  private toDateOnly(value: Date | string) {
    const date = new Date(value);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private resolvePaidAmountForRefund(booking: Booking) {
    const totalPaid = this.toMoney(booking.totalPaidAmount);
    if (totalPaid > 0) {
      return totalPaid;
    }

    if (
      [
        BookingPaymentStatus.PAID,
        BookingPaymentStatus.HELD,
        BookingPaymentStatus.COMPLETED,
        BookingPaymentStatus.REFUNDED,
        BookingPaymentStatus.DISPUTED,
      ].includes(booking.paymentStatus)
    ) {
      return this.toMoney(booking.totalAmount);
    }

    return 0;
  }

  private diffCalendarDays(laterDate: Date, earlierDate: Date) {
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.floor((laterDate.getTime() - earlierDate.getTime()) / msPerDay);
  }

  private toMoney(value: number | string | null | undefined) {
    const parsed = Number(value || 0);
    if (!Number.isFinite(parsed)) return 0;
    return Math.round(parsed * 100) / 100;
  }

  private isPayMongoEnabled() {
    const flag = String(process.env.PAYMONGO_ENABLED || '').trim().toLowerCase();
    return ['1', 'true', 'yes', 'on'].includes(flag);
  }

  private async allowOrdersWithoutPayment() {
    try {
      const flags = await this.settingsService.getFeatureFlagsSettings();
      return Boolean(flags.allowOrdersWithoutPayment);
    } catch (error) {
      this.logger.warn(
        `Failed to resolve unpaid-order feature flag, defaulting to payment required: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return false;
    }
  }

  private async createPayMongoCheckoutForBooking(
    bookingId: string,
    customerId: string,
    forceNew = false,
    _forRemainingBalance = false,
  ) {
    const booking = await this.findById(bookingId);
    if (!booking || booking.customerId !== customerId) {
      throw new NotFoundException('Booking not found');
    }

    if (
      !forceNew &&
      booking.paymentStatus === BookingPaymentStatus.CHECKOUT_PENDING &&
      booking.paymentCheckoutUrl
    ) {
      return booking;
    }

    if (!booking.vendor) {
      throw new BadRequestException('Booking vendor details are unavailable');
    }
    if (!booking.customer) {
      throw new BadRequestException('Booking customer details are unavailable');
    }

    if (
      [
        BookingPaymentStatus.HELD,
        BookingPaymentStatus.COMPLETED,
        BookingPaymentStatus.REFUNDED,
      ].includes(booking.paymentStatus)
    ) {
      throw new BadRequestException('This booking is already settled');
    }

    const secretKey = String(process.env.PAYMONGO_SECRET_KEY || '').trim();
    if (!secretKey) {
      throw new BadRequestException('PAYMONGO_SECRET_KEY is not configured');
    }

    const payableAmount = this.toMoney(
      Math.max(0, Number(booking.totalAmount || 0) - Number(booking.totalPaidAmount || 0)),
    );

    const payableMinor = this.toMinorUnits(payableAmount);
    if (payableMinor <= 0) {
      throw new BadRequestException('Booking amount must be greater than zero');
    }

    // Resolve current commission rate for embedding in split payload (bps).
    // Uses the same rate-resolution logic as booking creation.
    const commissionRateForSplit = await this.resolveCommissionRateForBooking(
      booking.vendor.commissionRate,
    );

    const baseApi = String(process.env.PAYMONGO_API_BASE_URL || 'https://api.paymongo.com/v1').replace(/\/$/, '');
    const successUrl = this.withBookingQuery(
      process.env.PAYMONGO_SUCCESS_URL || `${process.env.FRONTEND_URL || 'http://127.0.0.1:43171'}/my-bookings`,
      booking.id,
      'success',
    );
    const cancelUrl = this.withBookingQuery(
      process.env.PAYMONGO_CANCEL_URL || `${process.env.FRONTEND_URL || 'http://127.0.0.1:43171'}/my-bookings`,
      booking.id,
      'cancel',
    );

    const methodTypes = String(process.env.PAYMONGO_PAYMENT_METHOD_TYPES || 'gcash')
      .split(',')
      .map((method) => method.trim())
      .filter(Boolean);

    // Build split_payment payload when split is enabled and both merchant IDs are present.
    // Vendor is set as transfer_to (receives remainder after fees and platform commission).
    // Platform commission is configured as a percentage_net recipient in basis points.
    const splitPaymentBlock = this.buildSplitPaymentBlock(booking, commissionRateForSplit);

    const payload = {
      data: {
        attributes: {
          billing: {
            name: booking.customer.name || booking.customer.email,
            email: booking.customer.email,
          },
          cancel_url: cancelUrl,
          description: `Booking ${booking.id} - ${booking.vendor.businessName}`,
          payment_method_types: methodTypes,
          line_items: [
            {
              amount: payableMinor,
              quantity: 1,
              name: `Booking Payment - ${booking.vendor.businessName}`,
              description: `Booking #${booking.id}`,
              currency: 'PHP',
            },
          ],
          merchant: booking.vendor.businessName,
          reference_number: `booking_${booking.id}`,
          send_email_receipt: false,
          show_description: true,
          show_line_items: true,
          success_url: successUrl,
          ...(splitPaymentBlock ? { split_payment: splitPaymentBlock } : {}),
        },
      },
    };

    const response = await fetch(`${baseApi}/checkout_sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseJson = (await response.json()) as PayMongoCheckoutResponse;
    if (!response.ok) {
      throw new BadRequestException(this.extractPayMongoErrorMessage(responseJson));
    }

    const checkoutSessionId = String(responseJson?.data?.id || '').trim();
    const checkoutUrl = String(
      responseJson?.data?.attributes?.checkout_url || '',
    ).trim();

    if (!checkoutSessionId || !checkoutUrl) {
      throw new BadRequestException(
        'PayMongo checkout session was created without a checkout URL',
      );
    }

    const snapshotForStorage = splitPaymentBlock
      ? JSON.stringify({
          transferTo: splitPaymentBlock.transfer_to,
          recipients: splitPaymentBlock.recipients,
          commissionRateBps: this.commissionRateToBps(commissionRateForSplit),
          commissionBasis: 'total_booking_amount',
          grossBookingAmountMinor: payableMinor,
          capturedAt: new Date().toISOString(),
        })
      : null;

    await this.bookingsRepo.update(booking.id, {
      paymentStatus: BookingPaymentStatus.CHECKOUT_PENDING,
      paymentProvider: 'paymongo',
      paymentReference: `booking_${booking.id}`,
      paymentCheckoutSessionId: checkoutSessionId,
      paymentCheckoutUrl: checkoutUrl,
      paymentPaidAt: null,
      ...(snapshotForStorage !== null ? { splitPaymentSnapshot: snapshotForStorage } : {}),
    });
  }

  /**
   * Returns a PayMongo `split_payment` block when split mode is enabled.
   * Vendor is always set as `transfer_to` (receives the net remainder).
   * Platform commission is a `percentage_net` recipient entry in basis points.
   * Returns null only when split mode is disabled.
   */
  private buildSplitPaymentBlock(
    booking: { vendor: { paymongoMerchantId?: string | null }; totalAmount: number; platformFee: number },
    commissionRate: number,
  ): { transfer_to: string; recipients: { merchant_id: string; split_type: string; value: number }[] } | null {
    const splitEnabled = ['1', 'true', 'yes', 'on'].includes(
      String(process.env.PAYMONGO_SPLIT_ENABLED || '').trim().toLowerCase(),
    );
    if (!splitEnabled) return null;

    const platformMerchantId = String(process.env.PAYMONGO_PLATFORM_MERCHANT_ID || '').trim();
    if (!platformMerchantId) {
      throw new BadRequestException(
        'Payment split is enabled but PAYMONGO_PLATFORM_MERCHANT_ID is missing. Please contact support.',
      );
    }

    const vendorMerchantId = String(booking.vendor.paymongoMerchantId || '').trim();
    if (!vendorMerchantId) {
      throw new BadRequestException(
        'This vendor has no PayMongo merchant ID configured yet. Please request the vendor to provide their merchant ID before checkout.',
      );
    }

    const commissionBps = this.commissionRateToBps(commissionRate);

    // Safety guard: zero commission means the platform gets nothing, return transfer-to only.
    if (commissionBps <= 0) {
      return { transfer_to: vendorMerchantId, recipients: [] };
    }

    // Guard: bps cannot be >= 10000 (would exhaust entire net or more).
    if (commissionBps >= 10000) {
      this.logger.warn(
        `Commission bps ${commissionBps} is >= 10000; clamping to 9500 to preserve safe vendor remainder`,
      );
    }
    const safeBps = Math.min(commissionBps, 9500);

    return {
      transfer_to: vendorMerchantId,
      recipients: [
        {
          merchant_id: platformMerchantId,
          split_type: 'percentage_net',
          value: safeBps,
        },
      ],
    };
  }

  /** Converts a decimal commission rate (e.g. 0.10 or 10) to PayMongo basis points (e.g. 1000). */
  private commissionRateToBps(rate: number): number {
    const normalised = rate <= 1 ? rate : rate / 100;
    return Math.round(normalised * 10000);
  }

  private toMinorUnits(amount: number) {
    const parsed = Number(amount || 0);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.round(parsed * 100));
  }

  private withBookingQuery(baseUrl: string, bookingId: string, status: string) {
    const safeBase = String(baseUrl || '').trim();
    if (!safeBase) {
      throw new BadRequestException('Missing payment redirect URL configuration');
    }

    const separator = safeBase.includes('?') ? '&' : '?';
    return `${safeBase}${separator}payment=${encodeURIComponent(status)}&bookingId=${encodeURIComponent(bookingId)}`;
  }

  private extractPayMongoErrorMessage(payload: PayMongoCheckoutResponse) {
    if (Array.isArray(payload?.errors) && payload.errors.length) {
      const details = payload.errors
        .map((error) => error.detail || error.code)
        .filter(Boolean);
      if (details.length) {
        return details.join('; ');
      }
    }

    return 'Unable to create PayMongo checkout session';
  }

  private async fetchPayMongoCheckoutSession(checkoutSessionId: string) {
    const secretKey = String(process.env.PAYMONGO_SECRET_KEY || '').trim();
    if (!secretKey) {
      throw new BadRequestException('PayMongo secret key is not configured');
    }

    const baseApi = String(process.env.PAYMONGO_API_BASE_URL || 'https://api.paymongo.com/v1').replace(/\/$/, '');
    const response = await fetch(
      `${baseApi}/checkout_sessions/${encodeURIComponent(checkoutSessionId)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const responseJson = (await response.json()) as PayMongoCheckoutResponse;
    if (!response.ok) {
      throw new BadRequestException(this.extractPayMongoErrorMessage(responseJson));
    }

    return responseJson;
  }

  private checkoutLooksPaid(payload: PayMongoCheckoutResponse) {
    const attributes = payload?.data?.attributes;
    if (!attributes) return false;

    const topLevelStatus = String(attributes.status || '').toLowerCase();
    if (['paid', 'succeeded', 'completed', 'success'].includes(topLevelStatus)) {
      return true;
    }

    const paymentIntentStatus = String(
      attributes.payment_intent?.attributes?.status ||
        attributes.payment_intent?.status ||
        '',
    ).toLowerCase();
    if (['paid', 'succeeded', 'completed', 'success'].includes(paymentIntentStatus)) {
      return true;
    }

    const payments = Array.isArray(attributes.payments)
      ? attributes.payments
      : [];

    return payments.some((payment) => {
      const status = String(payment?.attributes?.status || '').toLowerCase();
      return ['paid', 'succeeded', 'completed', 'success'].includes(status);
    });
  }

  private extractPayMongoCheckoutReference(payload: PayMongoCheckoutResponse) {
    const attributes = payload?.data?.attributes as
      | Record<string, unknown>
      | undefined;

    const referenceNumber = String(
      attributes?.reference_number ||
        attributes?.referenceNumber ||
        '',
    ).trim();

    return referenceNumber || null;
  }

  private extractPayMongoPaymentReference(payload: PayMongoCheckoutResponse) {
    const attributes = payload?.data?.attributes;
    if (!attributes) return null;

    const firstPaymentId = Array.isArray(attributes.payments)
      ? attributes.payments.find((payment) => payment?.id)?.id
      : null;

    return firstPaymentId || attributes.payment_intent?.id || null;
  }

  private async resolveDepositPercentage(input?: number) {
    const explicit = Number(input);
    if (Number.isFinite(explicit) && explicit > 0 && explicit <= 100) {
      return Number(explicit.toFixed(2));
    }

    try {
      const flags = await this.settingsService.getFeatureFlagsSettings();
      const configured = Number(flags.defaultDepositPercent);
      if (Number.isFinite(configured) && configured > 0 && configured <= 100) {
        return Number(configured.toFixed(2));
      }
    } catch {
      // Default fallback below.
    }

    return 30;
  }

  private async ensureVendorPayoutRecord(bookingId: string) {
    const booking = await this.findById(bookingId);
    if (!booking) return;

    const existing = await this.vendorPayoutsRepo.findOne({ where: { bookingId } });
    if (existing) return;

    const gross = this.toMoney(booking.totalAmount - booking.platformFee);
    await this.vendorPayoutsRepo.save(
      this.vendorPayoutsRepo.create({
        vendorId: booking.vendorId,
        bookingId,
        grossAmount: this.toMoney(booking.totalAmount),
        platformFeeAmount: this.toMoney(booking.platformFee),
        netAmount: gross,
        depositHeldAmount: this.toMoney(booking.depositAmount),
        outstandingBalanceAmount: this.toMoney(booking.remainingBalanceAmount),
        status: VendorPayoutStatus.PENDING,
      }),
    );
  }

  private async detectFraudSignalsOnCreate(input: {
    customerId: string;
    vendor: Vendor;
    totalAmountEstimate: number;
    createdFromIp?: string;
  }) {
    let score = 0;
    const reasons: string[] = [];

    const recentBookings = await this.bookingsRepo.find({
      where: { customerId: input.customerId },
      order: { createdAt: 'DESC' },
      take: 15,
    });

    if (recentBookings.length <= 1 && input.totalAmountEstimate >= 8) {
      score += 20;
      reasons.push('new_account_high_volume_order');
    }

    const cancellations = recentBookings.filter(
      (booking) => booking.status === BookingStatus.CANCELLED,
    ).length;
    if (cancellations >= 3) {
      score += 20;
      reasons.push('repeated_cancellations');
    }

    const now = Date.now();
    const sameDayBookings = recentBookings.filter((booking) => {
      const ts = new Date(booking.createdAt).getTime();
      return Number.isFinite(ts) && now - ts <= 24 * 60 * 60 * 1000;
    }).length;
    if (sameDayBookings >= 4) {
      score += 25;
      reasons.push('unusual_booking_frequency');
    }

    const ip = String(input.createdFromIp || '').trim();
    if (ip) {
      const otherBookingsSameIp = await this.bookingsRepo.count({
        where: { createdFromIp: ip },
      });
      if (otherBookingsSameIp >= 4) {
        score += 25;
        reasons.push('multiple_accounts_same_ip');
      }
    }

    return { score, reasons };
  }

  private async computeVendorPayoutReleaseOn(vendorId: string) {
    const vendor = await this.vendorsRepo.findOne({ where: { id: vendorId } });
    if (!vendor) return null;

    const completedOrders = Number(vendor.successfulCompletedOrders || 0);
    const releaseOn = new Date();

    let completedThreshold = 5;
    let delayDays = 3;
    try {
      const flags = await this.settingsService.getFeatureFlagsSettings();
      completedThreshold = Number(flags.newVendorCompletedOrdersThreshold);
      delayDays = Number(flags.payoutDelayDaysForNewVendors);
    } catch {
      // Use defaults when flags are unavailable.
    }

    if (completedOrders < completedThreshold) {
      releaseOn.setDate(releaseOn.getDate() + Math.max(0, Math.round(delayDays)));
      return releaseOn;
    }

    return releaseOn;
  }

  private async refreshReputationForReviewee(
    revieweeUserId: string,
    revieweeRole: UserRole,
  ) {
    const reviews = await this.bookingReviewsRepo.find({
      where: { revieweeUserId, revieweeRole },
    });

    const total = reviews.length;
    const average = total
      ? Number(
          (
            reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) /
            total
          ).toFixed(2),
        )
      : 0;

    if (revieweeRole === UserRole.VENDOR) {
      const vendor = await this.vendorsRepo.findOne({ where: { userId: revieweeUserId } });
      if (!vendor) return;

      await this.vendorsRepo.update(vendor.id, {
        averageRating: average,
        totalRatings: total,
        lowRatingFlag: total >= 3 && average < 3,
      });

      if (total >= 3 && average < 3) {
        await this.fraudService.createAlert({
          type: FraudAlertType.LOW_RATING_VENDOR,
          severity: FraudAlertSeverity.MEDIUM,
          title: 'Vendor flagged for low ratings',
          description: `${vendor.businessName} has an average rating of ${average} (${total} ratings).`,
          vendorId: vendor.id,
          userId: revieweeUserId,
          metadata: { averageRating: average, totalRatings: total },
        });
      }

      return;
    }

    await this.usersRepo.update(revieweeUserId, {
      averageCustomerRating: average,
      totalCustomerRatings: total,
    });
  }

  private async tryEnsureBookingDocuments(bookingId: string) {
    try {
      await this.ensureBookingDocuments(bookingId);
    } catch (error) {
      this.logger.error(
        `Failed to generate booking documents for ${bookingId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async ensureBookingDocuments(
    bookingId: string,
    forceRegenerate = false,
  ) {
    const booking = await this.findById(bookingId);
    if (!booking) return;

    await this.upsertSignedBookingDocument({
      booking,
      documentType: BookingDocumentType.CONTRACT,
      issuedTo: BookingDocumentIssuedTo.BOTH,
      title: 'Letter of Agreement',
      forceRegenerate,
    });

    await this.upsertSignedBookingDocument({
      booking,
      documentType: BookingDocumentType.RECEIPT,
      issuedTo: BookingDocumentIssuedTo.CUSTOMER,
      title: 'Customer Receipt',
      forceRegenerate,
    });

    await this.upsertSignedBookingDocument({
      booking,
      documentType: BookingDocumentType.RECEIPT,
      issuedTo: BookingDocumentIssuedTo.VENDOR,
      title: 'Vendor Receipt',
      forceRegenerate,
    });
  }

  private async upsertSignedBookingDocument(input: {
    booking: Booking;
    documentType: BookingDocumentType;
    issuedTo: BookingDocumentIssuedTo;
    title: string;
    forceRegenerate?: boolean;
  }) {
    const booking = input.booking;
    const existing = await this.bookingDocumentsRepo.findOne({
      where: {
        bookingId: booking.id,
        documentType: input.documentType,
        issuedTo: input.issuedTo,
      },
    });

    const signaturePayload = {
      // Bump this value whenever document layout/terms are changed.
      version: 2,
      bookingId: booking.id,
      vendorId: booking.vendorId,
      customerId: booking.customerId,
      documentType: input.documentType,
      issuedTo: input.issuedTo,
      bookingStatus: booking.status,
      paymentStatus: booking.paymentStatus,
      startDate: this.formatDate(booking.startDate),
      endDate: this.formatDate(booking.endDate),
      totalAmount: this.toMoney(booking.totalAmount),
      totalPaidAmount: this.toMoney(booking.totalPaidAmount),
      remainingBalanceAmount: this.toMoney(booking.remainingBalanceAmount),
    };
    const signaturePayloadText = JSON.stringify(signaturePayload);
    const signaturePayloadHash = this.hashContent(signaturePayloadText);

    if (
      existing &&
      !input.forceRegenerate &&
      existing.signaturePayloadHash === signaturePayloadHash
    ) {
      return existing;
    }

    const signature = this.signContent(signaturePayloadText);
    const generatedAt = new Date();

    const pdfBuffer = this.buildBookingPdf({
      title: input.title,
      docType: input.documentType,
      issuedTo: input.issuedTo,
      booking,
      signature,
      signaturePayloadHash,
      generatedAt,
    });
    const fileHash = this.hashContent(pdfBuffer);

    const fileName = `booking-${booking.id}-${input.documentType}-${input.issuedTo}.pdf`;
    const filePath = `booking-documents/${booking.id}/${input.documentType}-${input.issuedTo}.pdf`;
    const absolutePath = this.resolveAbsoluteDocumentPath(filePath);
    await fs.mkdir(dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, pdfBuffer);

    const fileUrl = `/uploads/${filePath.replace(/\\/g, '/')}`;
    const metadata = JSON.stringify({ signaturePayload });

    if (existing) {
      existing.title = input.title;
      existing.fileName = fileName;
      existing.filePath = filePath;
      existing.fileUrl = fileUrl;
      existing.fileHash = fileHash;
      existing.signature = signature;
      existing.signatureAlgorithm = 'HMAC-SHA256';
      existing.signaturePayloadHash = signaturePayloadHash;
      existing.generatedAt = generatedAt;
      existing.metadata = metadata;
      return this.bookingDocumentsRepo.save(existing);
    }

    return this.bookingDocumentsRepo.save(
      this.bookingDocumentsRepo.create({
        bookingId: booking.id,
        documentType: input.documentType,
        issuedTo: input.issuedTo,
        title: input.title,
        fileName,
        filePath,
        fileUrl,
        fileHash,
        signature,
        signatureAlgorithm: 'HMAC-SHA256',
        signaturePayloadHash,
        generatedAt,
        metadata,
      }),
    );
  }

  private buildBookingPdf(params: {
    title: string;
    docType: BookingDocumentType;
    issuedTo: BookingDocumentIssuedTo;
    booking: Booking;
    signature: string;
    signaturePayloadHash: string;
    generatedAt: Date;
  }): Buffer {
    const { docType, issuedTo, booking, signature, signaturePayloadHash, generatedAt } = params;
    const margin = 50;
    const contentWidth = 512;
    const pageW = 612;
    const pageH = 792;
    const ops: string[] = [];

    const esc = (s: unknown) =>
      this.escapePdfText(this.sanitizePdfText(String(s ?? '')));

    const money = (v: number | string | null | undefined) =>
      `PHP ${this.toMoney(Number(v ?? 0)).toFixed(2)}`;

    const txt = (
      text: string,
      x: number,
      yPos: number,
      font: number,
      size: number,
      r: number,
      g: number,
      b: number,
    ) => {
      ops.push(
        `BT /F${font} ${size} Tf ${r} ${g} ${b} rg 1 0 0 1 ${x} ${yPos} Tm (${text}) Tj ET`,
      );
    };

    const vendorName = booking.vendor?.businessName || booking.vendorId;
    const customerName = booking.customer?.name || booking.customerId;
    const customerEmail = booking.customer?.email || 'n/a';
    const rentalPeriod = `${this.formatDate(booking.startDate)} to ${this.formatDate(booking.endDate)}`;

    ops.push(`q 0.12 0.25 0.39 rg 0 ${pageH - 45} ${pageW} 45 re f Q`);
    txt(esc('RENTALBASIC PLATFORM'), margin, pageH - 28, 2, 13, 1, 1, 1);

    const docLabel =
      docType === BookingDocumentType.CONTRACT
        ? 'LETTER OF AGREEMENT'
        : issuedTo === BookingDocumentIssuedTo.CUSTOMER
          ? 'CUSTOMER RECEIPT'
          : 'VENDOR RECEIPT';
    txt(esc(docLabel), 380, pageH - 28, 1, 9, 0.8, 0.9, 1);

    ops.push(`q 0.20 0.35 0.52 rg 0 ${pageH - 61} ${pageW} 16 re f Q`);
    txt(`Booking ID: ${esc(booking.id)}`, margin, pageH - 57, 1, 7.5, 0.85, 0.92, 1);

    let y = pageH - 80;

    const divider = () => {
      ops.push(
        `q 0.78 0.78 0.78 RG 0.4 w ${margin} ${y + 3} m ${margin + contentWidth} ${y + 3} l S Q`,
      );
    };

    const sectionLabel = (text: string) => {
      if (y < 65) return;
      divider();
      txt(esc(text), margin, y, 2, 9, 0.1, 0.24, 0.42);
      y -= 15;
    };

    const kv = (label: string, value: string) => {
      if (y < 65) return;
      txt(`${esc(label)}:`, margin, y, 2, 8, 0.35, 0.35, 0.35);
      txt(esc(value), margin + 145, y, 1, 8, 0, 0, 0);
      y -= 13;
    };

    const writeParagraph = (text: string, maxChars = 98) => {
      const normalized = this.sanitizePdfText(text).replace(/\s+/g, ' ').trim();
      if (!normalized) return;

      const words = normalized.split(' ');
      let line = '';
      const lines: string[] = [];

      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (candidate.length > maxChars) {
          if (line) lines.push(line);
          line = word;
        } else {
          line = candidate;
        }
      }
      if (line) lines.push(line);

      for (const lineText of lines) {
        if (y < 65) return;
        txt(esc(lineText), margin, y, 1, 8, 0, 0, 0);
        y -= 12;
      }
    };

    if (docType === BookingDocumentType.CONTRACT) {
      sectionLabel('LETTER OF AGREEMENT');
      writeParagraph(
        'This Letter of Agreement is entered into by the Vendor and Customer identified below for the booking reference on this document.',
      );
      y -= 4;

      sectionLabel('PARTIES AND BOOKING DETAILS');
      kv('Vendor', vendorName.slice(0, 72));
      kv('Customer', `${customerName} (${customerEmail})`.slice(0, 72));
      kv('Rental Period', rentalPeriod);
      kv('Booking Status', String(booking.status || '').toUpperCase());
      if (booking.deliveryAddress) kv('Delivery Address', booking.deliveryAddress.slice(0, 70));
      y -= 4;

      sectionLabel('AGREEMENT TERMS');
      writeParagraph(
        '1. Vendor agrees to provide the listed rental items in usable condition for the agreed rental period.',
      );
      writeParagraph(
        '2. Customer agrees to pay the booking amount and any remaining balance according to the platform payment schedule.',
      );
      writeParagraph(
        '3. Customer agrees to use and return rented items in substantially the same condition, except for normal wear.',
      );
      writeParagraph(
        '4. Cancellations, refunds, and disputes follow the policies shown at checkout and applicable platform terms.',
      );
      writeParagraph(
        '5. Loss, damage, or service issues must be raised through the platform dispute workflow with supporting evidence.',
      );
      writeParagraph(
        '6. This agreement is executed electronically and authenticated by the digital signature section below.',
      );
      y -= 4;

      if (Array.isArray(booking.items) && booking.items.length > 0) {
        sectionLabel('ITEMS COVERED');
        for (const item of booking.items.slice(0, 8)) {
          if (y < 65) break;
          const itemName = this.sanitizePdfText(item.inventoryItem?.itemType?.name || item.inventoryItemId);
          const brandName = this.sanitizePdfText(item.inventoryItem?.brand?.name || '');
          const itemLine = `${item.quantity} x ${itemName}${brandName ? ` (${brandName})` : ''}`;
          writeParagraph(itemLine, 95);
        }
        y -= 4;
      }

      sectionLabel('CONSIDERATION');
      kv('Total Contract Amount', money(booking.totalAmount));
      kv('Required Deposit', money(booking.depositAmount));
      kv(
        'Deposit Settlement Status',
        booking.totalPaidAmount >= booking.depositAmount && booking.depositAmount > 0
          ? 'SETTLED'
          : 'NOT YET SETTLED',
      );
      kv('Amount Paid to Date', money(booking.totalPaidAmount));
      kv('Remaining Balance Due', money(booking.remainingBalanceAmount));
      kv('Payment Status', String(booking.paymentStatus || '').toUpperCase());
      y -= 4;

      sectionLabel('ACKNOWLEDGEMENT');
      writeParagraph(`Vendor Representative: ${vendorName}`);
      writeParagraph(`Customer: ${customerName}`);
      writeParagraph(
        'By confirming this booking through RentalBasic, both parties acknowledge and agree to the terms stated in this Letter of Agreement.',
      );
    } else {
      sectionLabel('RECEIPT DETAILS');
      kv(
        'Issued To',
        issuedTo === BookingDocumentIssuedTo.CUSTOMER ? 'Customer' : 'Vendor',
      );
      kv('Vendor', vendorName.slice(0, 72));
      kv('Customer', `${customerName} (${customerEmail})`.slice(0, 72));
      kv('Rental Period', rentalPeriod);
      kv('Booking Status', String(booking.status || '').toUpperCase());
      kv('Payment Status', String(booking.paymentStatus || '').toUpperCase());
      if (booking.deliveryAddress) kv('Delivery Address', booking.deliveryAddress.slice(0, 70));
      y -= 4;

      sectionLabel('PAYMENT SUMMARY');
      kv('Total Amount', money(booking.totalAmount));
      kv('Deposit', money(booking.depositAmount));
      kv('Total Paid', money(booking.totalPaidAmount));
      kv('Remaining Balance', money(booking.remainingBalanceAmount));
      kv('Platform Fee', money(booking.platformFee));
      y -= 4;

      if (Array.isArray(booking.items) && booking.items.length > 0) {
        sectionLabel('RENTAL ITEMS');
        for (const item of booking.items.slice(0, 8)) {
          if (y < 65) break;
          const itemName = esc(item.inventoryItem?.itemType?.name || item.inventoryItemId);
          const brandPart = item.inventoryItem?.brand?.name
            ? ` | ${esc(item.inventoryItem.brand.name)}`
            : '';
          txt(`${itemName}${brandPart}`, margin, y, 1, 8, 0, 0, 0);
          txt(
            `Qty: ${item.quantity}    Subtotal: ${money(item.subtotal)}`,
            margin + 260,
            y,
            1,
            8,
            0.35,
            0.35,
            0.35,
          );
          y -= 13;
        }
        y -= 4;
      }

      sectionLabel('RECEIPT NOTE');
      writeParagraph(
        issuedTo === BookingDocumentIssuedTo.CUSTOMER
          ? 'This receipt summarizes the booking charges and payments recorded on the customer account.'
          : 'This receipt summarizes the booking charges and payment status relevant to the vendor account.',
      );
    }

    sectionLabel('DIGITAL SIGNATURE');
    kv('Algorithm', 'HMAC-SHA256');
    kv('Generated At', generatedAt.toISOString());
    if (y >= 60) {
      txt('Signature:', margin, y, 2, 8, 0.35, 0.35, 0.35);
      y -= 12;
      txt(esc(signature), margin, y, 1, 7, 0.4, 0.4, 0.4);
      y -= 12;
    }
    if (y >= 60) {
      txt('Payload Hash:', margin, y, 2, 8, 0.35, 0.35, 0.35);
      y -= 12;
      txt(esc(signaturePayloadHash), margin, y, 1, 7, 0.4, 0.4, 0.4);
    }

    ops.push(`q 0.93 0.93 0.93 rg 0 0 ${pageW} 28 re f Q`);
    txt(
      'This document is digitally signed by the RentalBasic platform. Verify authenticity with the signature hash above.',
      margin,
      10,
      1,
      7,
      0.4,
      0.4,
      0.4,
    );

    const contentStream = ops.join('\n');
    const streamLen = Buffer.byteLength(contentStream, 'utf8');

    const objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>`,
      `<< /Length ${streamLen} >>\nstream\n${contentStream}\nendstream`,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    ];

    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [0];
    for (let i = 0; i < objects.length; i += 1) {
      offsets.push(Buffer.byteLength(pdf, 'utf8'));
      pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
    }
    const xrefOffset = Buffer.byteLength(pdf, 'utf8');
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += '0000000000 65535 f \n';
    for (let i = 1; i < offsets.length; i += 1) {
      pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
    pdf += `startxref\n${xrefOffset}\n%%EOF`;

    return Buffer.from(pdf, 'utf8');
  }

  private sanitizePdfText(input: string) {
    return String(input || '')
      .normalize('NFKD')
      .replace(/[^\x20-\x7E]/g, '?');
  }

  private escapePdfText(input: string) {
    return String(input || '')
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');
  }

  private formatDate(value: Date | string | null | undefined) {
    if (!value) return 'n/a';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'n/a';
    return date.toISOString().slice(0, 10);
  }

  private resolveUploadRootPath() {
    const configured = String(process.env.UPLOAD_DIR || '').trim();
    const pathValue = configured || join(process.cwd(), 'uploads');
    return isAbsolute(pathValue) ? pathValue : join(process.cwd(), pathValue);
  }

  private resolveAbsoluteDocumentPath(filePath: string) {
    const normalized = String(filePath || '')
      .replace(/\\/g, '/')
      .replace(/^\/+/, '');
    if (!normalized || normalized.includes('..')) {
      throw new BadRequestException('Invalid document path');
    }

    return join(this.resolveUploadRootPath(), ...normalized.split('/'));
  }

  private hashContent(content: Buffer | string) {
    return createHash('sha256').update(content).digest('hex');
  }

  private signContent(content: string) {
    const secret = String(
      process.env.BOOKING_DOCUMENT_SIGNATURE_SECRET ||
        process.env.JWT_SECRET ||
        'booking-documents-dev-secret',
    ).trim();
    return createHmac('sha256', secret).update(content).digest('hex');
  }

  private assertCanAccessDocument(
    document: BookingDocument,
    actorRole: UserRole,
  ) {
    if (actorRole === UserRole.ADMIN) return;
    if (document.issuedTo === BookingDocumentIssuedTo.BOTH) return;

    if (
      actorRole === UserRole.CUSTOMER &&
      document.issuedTo === BookingDocumentIssuedTo.CUSTOMER
    ) {
      return;
    }

    if (
      actorRole === UserRole.VENDOR &&
      document.issuedTo === BookingDocumentIssuedTo.VENDOR
    ) {
      return;
    }

    throw new ForbiddenException('You do not have access to this booking document');
  }

  private parseBookingDateRange(startDateRaw: string, endDateRaw: string) {
    const startDate = new Date(startDateRaw);
    const endDate = new Date(endDateRaw);

    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime())
    ) {
      throw new BadRequestException('startDate and endDate must be valid dates');
    }

    if (endDate < startDate) {
      throw new BadRequestException('endDate must be on or after startDate');
    }

    return { startDate, endDate };
  }

  private normalizeBookingItems(items: CreateBookingPayload['items']): NormalizedBookingItem[] {
    return items.map((item, index) => {
      const quantity = Number(item?.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new BadRequestException(
          `items[${index}].quantity must be a positive integer`,
        );
      }

      const inventoryItemId = String(item?.inventoryItemId || '').trim();
      if (!inventoryItemId) {
        throw new BadRequestException(
          `items[${index}].inventoryItemId is required`,
        );
      }

      return {
        inventoryItemId,
        quantity,
      };
    });
  }

  private parseNonNegativeMoney(value: unknown, fieldName: string) {
    if (value === undefined || value === null || value === '') {
      return 0;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new BadRequestException(
        `${fieldName} must be a non-negative number`,
      );
    }

    return this.toMoney(parsed);
  }

  private parseOptionalNonNegativeNumber(value: unknown, fieldName: string) {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new BadRequestException(
        `${fieldName} must be a non-negative number`,
      );
    }

    return this.toMoney(parsed);
  }

  private parseOptionalNonNegativeInteger(value: unknown, fieldName: string) {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new BadRequestException(
        `${fieldName} must be a non-negative integer`,
      );
    }

    return parsed;
  }

  private parseOptionalBoolean(value: unknown, defaultValue: boolean) {
    if (value === undefined || value === null || value === '') {
      return defaultValue;
    }

    if (typeof value === 'boolean') {
      return value;
    }

    const normalized = String(value).trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
      return true;
    }

    if (['0', 'false', 'no', 'off'].includes(normalized)) {
      return false;
    }

    throw new BadRequestException('isNightDelivery must be a boolean');
  }

  private resolveDistanceKmForPricing(
    distanceKmRaw: unknown,
    vendor: Vendor,
    deliveryLatitude: number | null,
    deliveryLongitude: number | null,
  ) {
    const explicitDistanceKm = this.parseOptionalNonNegativeNumber(
      distanceKmRaw,
      'distanceKm',
    );

    if (explicitDistanceKm !== null) {
      return explicitDistanceKm;
    }

    const vendorLatitude = Number((vendor as any).latitude);
    const vendorLongitude = Number((vendor as any).longitude);

    if (
      !Number.isFinite(vendorLatitude) ||
      !Number.isFinite(vendorLongitude) ||
      deliveryLatitude === null ||
      deliveryLongitude === null
    ) {
      return null;
    }

    return this.toMoney(
      this.calculateHaversineDistanceKm(
        vendorLatitude,
        vendorLongitude,
        deliveryLatitude,
        deliveryLongitude,
      ),
    );
  }

  private calculateHaversineDistanceKm(
    startLatitude: number,
    startLongitude: number,
    endLatitude: number,
    endLongitude: number,
  ) {
    const earthRadiusKm = 6371;
    const toRadians = (value: number) => (value * Math.PI) / 180;

    const dLat = toRadians(endLatitude - startLatitude);
    const dLng = toRadians(endLongitude - startLongitude);
    const lat1 = toRadians(startLatitude);
    const lat2 = toRadians(endLatitude);

    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);
    const a =
      sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return earthRadiusKm * c;
  }

  private normalizeDeliveryCoordinates(latitudeRaw?: number, longitudeRaw?: number) {
    const hasLatitude =
      latitudeRaw !== undefined && latitudeRaw !== null && latitudeRaw !== ('' as any);
    const hasLongitude =
      longitudeRaw !== undefined && longitudeRaw !== null && longitudeRaw !== ('' as any);

    if (hasLatitude !== hasLongitude) {
      throw new BadRequestException(
        'deliveryLatitude and deliveryLongitude must both be provided together',
      );
    }

    if (!hasLatitude) {
      return {
        deliveryLatitude: null,
        deliveryLongitude: null,
      };
    }

    const deliveryLatitude = Number(latitudeRaw);
    const deliveryLongitude = Number(longitudeRaw);

    if (!Number.isFinite(deliveryLatitude) || deliveryLatitude < -90 || deliveryLatitude > 90) {
      throw new BadRequestException('deliveryLatitude must be between -90 and 90');
    }

    if (
      !Number.isFinite(deliveryLongitude) ||
      deliveryLongitude < -180 ||
      deliveryLongitude > 180
    ) {
      throw new BadRequestException('deliveryLongitude must be between -180 and 180');
    }

    return {
      deliveryLatitude,
      deliveryLongitude,
    };
  }
}
