import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BookingDispute,
  BookingDisputeOutcome,
  BookingDisputeStatus,
} from './entities/booking-dispute.entity';
import { BookingDisputeEvidence } from './entities/booking-dispute-evidence.entity';
import {
  Booking,
  BookingPaymentStatus,
  BookingStatus,
} from '../bookings/entities/booking.entity';
import { UserRole } from '../users/entities/user.entity';
import { VendorPayout, VendorPayoutStatus } from '../payments/entities/vendor-payout.entity';
import { FraudService } from '../fraud/fraud.service';
import { FraudAlertSeverity, FraudAlertType } from '../fraud/entities/fraud-alert.entity';

@Injectable()
export class DisputesService {
  constructor(
    @InjectRepository(BookingDispute)
    private readonly disputesRepo: Repository<BookingDispute>,
    @InjectRepository(BookingDisputeEvidence)
    private readonly evidenceRepo: Repository<BookingDisputeEvidence>,
    @InjectRepository(Booking)
    private readonly bookingsRepo: Repository<Booking>,
    @InjectRepository(VendorPayout)
    private readonly payoutsRepo: Repository<VendorPayout>,
    private readonly fraudService: FraudService,
  ) {}

  listAdmin(status?: BookingDisputeStatus) {
    return this.disputesRepo.find({
      where: status ? { status } : {},
      relations: ['booking', 'booking.vendor', 'booking.customer', 'evidence'],
      order: { createdAt: 'DESC' },
    });
  }

  async listForBooking(bookingId: string, actorUserId: string, actorRole: UserRole) {
    const booking = await this.assertBookingAccess(bookingId, actorUserId, actorRole);
    return this.disputesRepo.find({
      where: { bookingId: booking.id },
      relations: ['evidence'],
      order: { createdAt: 'DESC' },
    });
  }

  async openDispute(
    bookingId: string,
    actorUserId: string,
    actorRole: UserRole,
    reasonInput: string,
  ) {
    const booking = await this.assertBookingAccess(bookingId, actorUserId, actorRole);

    if (booking.status === BookingStatus.PENDING) {
      throw new BadRequestException(
        'Disputes can only be opened after booking confirmation',
      );
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('Cannot open a dispute for cancelled bookings');
    }

    const reason = String(reasonInput || '').trim();
    if (!reason) {
      throw new BadRequestException('Dispute reason is required');
    }

    const existingOpen = await this.disputesRepo.findOne({
      where: { bookingId, status: BookingDisputeStatus.OPEN },
    });
    if (existingOpen) {
      throw new BadRequestException('An open dispute already exists for this booking');
    }

    const dispute = await this.disputesRepo.save(
      this.disputesRepo.create({
        bookingId,
        openedByUserId: actorUserId,
        openedByRole: actorRole,
        reason,
        status: BookingDisputeStatus.OPEN,
      }),
    );

    await this.bookingsRepo.update(bookingId, {
      paymentStatus: BookingPaymentStatus.DISPUTED,
    });

    await this.payoutsRepo.update(
      { bookingId },
      {
        status: VendorPayoutStatus.DISPUTED,
        disputeLockedAt: new Date(),
      },
    );

    await this.fraudService.createAlert({
      type: FraudAlertType.DISPUTE,
      severity: FraudAlertSeverity.HIGH,
      title: 'Booking dispute opened',
      description: `A dispute was opened for booking ${bookingId}.`,
      bookingId,
      userId: actorUserId,
      vendorId: booking.vendorId,
      disputeId: dispute.id,
    });

    return this.disputesRepo.findOne({
      where: { id: dispute.id },
      relations: ['booking', 'booking.vendor', 'booking.customer', 'evidence'],
    });
  }

  async addEvidence(
    disputeId: string,
    actorUserId: string,
    actorRole: UserRole,
    fileUrlInput: string,
    note?: string,
    metadata?: Record<string, unknown>,
  ) {
    const dispute = await this.disputesRepo.findOne({
      where: { id: disputeId },
      relations: ['booking', 'booking.vendor'],
    });
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    await this.assertBookingAccess(dispute.bookingId, actorUserId, actorRole);

    const fileUrl = String(fileUrlInput || '').trim();
    if (!fileUrl) {
      throw new BadRequestException('Evidence file is required');
    }

    await this.evidenceRepo.save(
      this.evidenceRepo.create({
        disputeId,
        uploadedByUserId: actorUserId,
        uploadedByRole: actorRole,
        fileUrl,
        note: note || null,
        metadata: metadata ? JSON.stringify(metadata) : null,
      }),
    );

    if (dispute.status === BookingDisputeStatus.OPEN) {
      await this.disputesRepo.update(disputeId, {
        status: BookingDisputeStatus.UNDER_REVIEW,
      });
    }

    return this.disputesRepo.findOne({
      where: { id: disputeId },
      relations: ['booking', 'booking.vendor', 'booking.customer', 'evidence'],
    });
  }

  async reviewDispute(
    disputeId: string,
    reviewerUserId: string,
    outcome: BookingDisputeOutcome,
    resolutionNote?: string,
    refundAmount?: number,
  ) {
    const dispute = await this.disputesRepo.findOne({
      where: { id: disputeId },
      relations: ['booking'],
    });
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    const normalizedNote = String(resolutionNote || '').trim();
    const bookingTotalPaid = Number(dispute.booking?.totalPaidAmount || 0);
    const normalizedRefundAmount =
      refundAmount !== undefined && refundAmount !== null
        ? Number(refundAmount)
        : null;

    if (
      outcome === BookingDisputeOutcome.PARTIAL_REFUND &&
      (!Number.isFinite(normalizedRefundAmount) || normalizedRefundAmount <= 0)
    ) {
      throw new BadRequestException(
        'refundAmount is required for partial refund disputes',
      );
    }

    if (
      normalizedRefundAmount !== null &&
      normalizedRefundAmount > 0 &&
      bookingTotalPaid > 0 &&
      normalizedRefundAmount > bookingTotalPaid
    ) {
      throw new BadRequestException('refundAmount cannot exceed paid amount');
    }

    await this.disputesRepo.update(disputeId, {
      status: BookingDisputeStatus.RESOLVED,
      outcome,
      refundAmount: normalizedRefundAmount,
      resolutionNote: normalizedNote || null,
      resolvedByUserId: reviewerUserId,
      resolvedAt: new Date(),
    });

    if (outcome === BookingDisputeOutcome.REFUND_CUSTOMER) {
      await this.bookingsRepo.update(dispute.bookingId, {
        paymentStatus: BookingPaymentStatus.REFUNDED,
      });
      await this.payoutsRepo.update(
        { bookingId: dispute.bookingId },
        { status: VendorPayoutStatus.REFUNDED },
      );
    } else if (outcome === BookingDisputeOutcome.PARTIAL_REFUND) {
      await this.bookingsRepo.update(dispute.bookingId, {
        paymentStatus: BookingPaymentStatus.COMPLETED,
      });

      await this.payoutsRepo.update(
        { bookingId: dispute.bookingId },
        {
          status: VendorPayoutStatus.READY,
          notes: `Partial refund resolved: ${normalizedRefundAmount}`,
        },
      );
    } else {
      await this.bookingsRepo.update(dispute.bookingId, {
        paymentStatus: BookingPaymentStatus.COMPLETED,
      });

      await this.payoutsRepo.update(
        { bookingId: dispute.bookingId },
        { status: VendorPayoutStatus.READY },
      );
    }

    return this.disputesRepo.findOne({
      where: { id: disputeId },
      relations: ['booking', 'booking.vendor', 'booking.customer', 'evidence'],
    });
  }

  private async assertBookingAccess(
    bookingId: string,
    actorUserId: string,
    actorRole: UserRole,
  ) {
    const booking = await this.bookingsRepo.findOne({
      where: { id: bookingId },
      relations: ['vendor'],
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (actorRole === UserRole.ADMIN) {
      return booking;
    }

    if (actorRole === UserRole.CUSTOMER && booking.customerId === actorUserId) {
      return booking;
    }

    if (actorRole === UserRole.VENDOR && booking.vendor?.userId === actorUserId) {
      return booking;
    }

    throw new ForbiddenException('You do not have access to this booking dispute');
  }
}