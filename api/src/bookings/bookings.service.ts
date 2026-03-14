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
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { VendorPayment, PaymentStatus } from '../payments/entities/vendor-payment.entity';
import { differenceInDays } from 'date-fns';
import { Vendor } from '../vendors/entities/vendor.entity';
import { SettingsService } from '../settings/settings.service';
import { UserRole } from '../users/entities/user.entity';

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
  notes?: string;
};

type NormalizedBookingItem = {
  inventoryItemId: string;
  quantity: number;
};

type PayMongoRecipient = {
  merchant_id: string;
  split_type: 'fixed' | 'percentage_net';
  value: number;
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
    @InjectRepository(VendorPayment) private readonly paymentsRepo: Repository<VendorPayment>,
    @InjectRepository(Vendor) private readonly vendorsRepo: Repository<Vendor>,
    private readonly dataSource: DataSource,
    private readonly settingsService: SettingsService,
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
        'items',
        'items.inventoryItem',
        'items.inventoryItem.itemType',
        'items.inventoryItem.brand',
      ],
    });
  }

  async create(customerId: string, data: CreateBookingPayload) {
    if (!Array.isArray(data.items) || data.items.length === 0) {
      throw new BadRequestException('At least one booking item is required');
    }

    const { startDate, endDate } = this.parseBookingDateRange(
      data.startDate,
      data.endDate,
    );
    const normalizedItems = this.normalizeBookingItems(data.items);
    const delivery = this.parseNonNegativeMoney(data.deliveryCharge, 'deliveryCharge');
    const service = this.parseNonNegativeMoney(data.serviceCharge, 'serviceCharge');
    const { deliveryLatitude, deliveryLongitude } =
      this.normalizeDeliveryCoordinates(
        data.deliveryLatitude,
        data.deliveryLongitude,
      );

    const vendor = await this.vendorsRepo.findOne({ where: { id: data.vendorId } });
    if (!vendor) {
      throw new BadRequestException('Vendor not found');
    }

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

      const platformFee = subtotalItems * commissionRate;
      const totalAmount = subtotalItems + delivery + service;

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
        notes: data.notes,
        status: BookingStatus.PENDING,
        paymentStatus: BookingPaymentStatus.UNPAID,
      });
      const savedBooking = await manager.save(booking);

      for (const bi of bookingItems) {
        bi.bookingId = savedBooking.id;
        await manager.save(manager.create(BookingItem, bi));
      }

      return savedBooking;
    });

    if (this.isPayMongoEnabled()) {
      try {
        await this.createPayMongoCheckoutForBooking(createdBooking.id, customerId);
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

    return this.findById(createdBooking.id);
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

    if (booking.paymentStatus === BookingPaymentStatus.PAID) {
      return booking;
    }

    await this.createPayMongoCheckoutForBooking(booking.id, customerId, true);
    return this.findById(booking.id);
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

    await this.bookingsRepo.update(booking.id, {
      paymentStatus: BookingPaymentStatus.PAID,
      paymentPaidAt: new Date(),
      paymentReference:
        this.extractPayMongoPaymentReference(sessionPayload) ||
        booking.paymentReference ||
        storedSessionId,
    });

    return this.findById(booking.id);
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
      booking.paymentStatus !== BookingPaymentStatus.PAID
    ) {
      throw new BadRequestException(
        'Booking cannot be confirmed until payment is completed',
      );
    }

    await this.bookingsRepo.update(id, { status });
    return this.findById(id);
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
    const shouldMarkFullyRefunded =
      booking.paymentStatus === BookingPaymentStatus.PAID &&
      preview.refundAmount >= this.toMoney(booking.totalAmount);

    // Attempt PayMongo refund (best-effort — booking is cancelled regardless of refund outcome)
    if (
      booking.paymentStatus === BookingPaymentStatus.PAID &&
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
    const isPaidBooking = booking.paymentStatus === BookingPaymentStatus.PAID;

    const policy = await this.resolveCancellationPolicy(actorRole, daysBeforeStartDate);
    const refundAmount = isPaidBooking
      ? this.toMoney((this.toMoney(booking.totalAmount) * policy.refundPercent) / 100)
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

  private async createPayMongoCheckoutForBooking(
    bookingId: string,
    customerId: string,
    forceNew = false,
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

    const vendorMerchantId = String(
      booking.vendor.paymongoMerchantId || '',
    ).trim();
    if (!vendorMerchantId) {
      throw new BadRequestException(
        'Vendor is not configured for PayMongo split payouts',
      );
    }

    const secretKey = String(process.env.PAYMONGO_SECRET_KEY || '').trim();
    const platformMerchantId = String(
      process.env.PAYMONGO_PLATFORM_MERCHANT_ID || '',
    ).trim();
    if (!secretKey || !platformMerchantId) {
      throw new BadRequestException(
        'PayMongo split payment is not fully configured on the server',
      );
    }

    const amountMinor = this.toMinorUnits(booking.totalAmount);
    if (amountMinor <= 0) {
      throw new BadRequestException('Booking amount must be greater than zero');
    }

    const splitPayment = this.buildSplitPaymentConfig(
      booking,
      vendorMerchantId,
      platformMerchantId,
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
              amount: amountMinor,
              quantity: 1,
              name: `Rental Booking - ${booking.vendor.businessName}`,
              description: `Booking #${booking.id}`,
              currency: 'PHP',
            },
          ],
          merchant: booking.vendor.businessName,
          reference_number: `booking_${booking.id}`,
          send_email_receipt: false,
          show_description: true,
          show_line_items: true,
          split_payment: splitPayment,
          success_url: successUrl,
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

    await this.bookingsRepo.update(booking.id, {
      paymentStatus: BookingPaymentStatus.CHECKOUT_PENDING,
      paymentProvider: 'paymongo',
      paymentReference: `booking_${booking.id}`,
      paymentCheckoutSessionId: checkoutSessionId,
      paymentCheckoutUrl: checkoutUrl,
      paymentPaidAt: null,
    });
  }

  private buildSplitPaymentConfig(
    booking: Booking,
    transferToMerchantId: string,
    platformMerchantId: string,
  ) {
    const recipients: PayMongoRecipient[] = [];

    const platformBps = this.computePlatformCommissionBps(booking);
    if (platformBps > 0) {
      recipients.push({
        merchant_id: platformMerchantId,
        split_type: 'percentage_net',
        value: platformBps,
      });
    }

    const deliveryMerchantId = String(
      process.env.PAYMONGO_DELIVERY_MERCHANT_ID || '',
    ).trim();
    const deliveryFixed = this.toMinorUnits(booking.deliveryCharge);
    if (deliveryMerchantId && deliveryFixed > 0) {
      recipients.push({
        merchant_id: deliveryMerchantId,
        split_type: 'fixed',
        value: deliveryFixed,
      });
    }

    this.assertFixedSplitsWithinSafeNet(booking.totalAmount, recipients);

    return {
      transfer_to: transferToMerchantId,
      recipients,
    };
  }

  private computePlatformCommissionBps(booking: Booking) {
    const total = Number(booking.totalAmount || 0);
    const delivery = Number(booking.deliveryCharge || 0);
    const service = Number(booking.serviceCharge || 0);
    const platformFee = Number(booking.platformFee || 0);
    const itemsSubtotal = total - delivery - service;

    if (!Number.isFinite(platformFee) || platformFee <= 0) return 0;
    if (!Number.isFinite(itemsSubtotal) || itemsSubtotal <= 0) return 0;

    const bps = Math.round((platformFee / itemsSubtotal) * 10000);
    return Math.max(1, Math.min(10000, bps));
  }

  private assertFixedSplitsWithinSafeNet(
    totalAmount: number,
    recipients: PayMongoRecipient[],
  ) {
    const fixedTotal = recipients
      .filter((recipient) => recipient.split_type === 'fixed')
      .reduce((sum, recipient) => sum + Math.max(0, Number(recipient.value || 0)), 0);

    const percentageTotalBps = recipients
      .filter((recipient) => recipient.split_type === 'percentage_net')
      .reduce(
        (sum, recipient) => sum + Math.max(0, Math.floor(Number(recipient.value || 0))),
        0,
      );

    if (percentageTotalBps > 10000) {
      throw new BadRequestException(
        'Configured percentage split recipients exceed 100% of net amount.',
      );
    }

    if (fixedTotal <= 0 && percentageTotalBps <= 0) return;

    const grossMinor = this.toMinorUnits(totalAmount);
    const bufferBpsRaw = Number(process.env.PAYMONGO_SPLIT_FEE_BUFFER_BPS || 300);
    const bufferBps = Number.isFinite(bufferBpsRaw)
      ? Math.min(Math.max(Math.floor(bufferBpsRaw), 0), 3000)
      : 300;
    const estimatedNet = Math.floor((grossMinor * (10000 - bufferBps)) / 10000);

    const projectedPercentageTotal = Math.floor(
      (estimatedNet * percentageTotalBps) / 10000,
    );
    const projectedTotalCommitted = fixedTotal + projectedPercentageTotal;

    if (projectedTotalCommitted > estimatedNet) {
      throw new BadRequestException(
        'Configured split recipients exceed the safe net amount. Reduce recipient values or adjust PAYMONGO_SPLIT_FEE_BUFFER_BPS.',
      );
    }
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
