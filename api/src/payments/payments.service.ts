import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VendorPayment, PaymentStatus } from './entities/vendor-payment.entity';
import { DeliveryRate } from './entities/delivery-rate.entity';
import { VendorPayout, VendorPayoutStatus } from './entities/vendor-payout.entity';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(VendorPayment) private readonly paymentsRepo: Repository<VendorPayment>,
    @InjectRepository(VendorPayout) private readonly payoutsRepo: Repository<VendorPayout>,
    @InjectRepository(DeliveryRate) private readonly deliveryRatesRepo: Repository<DeliveryRate>,
  ) {}

  findByVendor(vendorId: string) {
    return this.paymentsRepo.find({ where: { vendorId }, order: { createdAt: 'DESC' } });
  }

  findAllPayments() {
    return this.paymentsRepo.find({ relations: ['vendor'], order: { createdAt: 'DESC' } });
  }

  findAllPayouts(status?: VendorPayoutStatus) {
    return this.payoutsRepo.find({
      where: status ? { status } : {},
      relations: ['vendor', 'booking'],
      order: { createdAt: 'DESC' },
    });
  }

  findPayoutsByVendor(vendorId: string) {
    return this.payoutsRepo.find({
      where: { vendorId },
      relations: ['booking'],
      order: { createdAt: 'DESC' },
    });
  }

  async releasePayout(id: string, note?: string) {
    const payout = await this.payoutsRepo.findOne({ where: { id } });
    if (!payout) {
      throw new NotFoundException('Vendor payout not found');
    }

    if (payout.status !== VendorPayoutStatus.READY) {
      throw new BadRequestException('Only READY payouts can be released');
    }

    if (payout.releaseOn && new Date(payout.releaseOn).getTime() > Date.now()) {
      throw new BadRequestException(
        `This payout is locked until ${new Date(payout.releaseOn).toISOString()}`,
      );
    }

    await this.payoutsRepo.update(id, {
      status: VendorPayoutStatus.RELEASED,
      releasedAt: new Date(),
      notes: String(note || '').trim() || payout.notes || null,
    });

    return this.payoutsRepo.findOne({
      where: { id },
      relations: ['vendor', 'booking'],
    });
  }

  async createPayment(data: Partial<VendorPayment>) {
    return this.paymentsRepo.save(this.paymentsRepo.create(data));
  }

  async markPaid(id: string, transactionRef?: string) {
    await this.paymentsRepo.update(id, { status: PaymentStatus.PAID, paidAt: new Date(), transactionRef });
    return this.paymentsRepo.findOne({ where: { id } });
  }

  async markOverdue(id: string) {
    await this.paymentsRepo.update(id, { status: PaymentStatus.OVERDUE });
    return this.paymentsRepo.findOne({ where: { id } });
  }

  getDeliveryRates(vendorId: string) {
    return this.deliveryRatesRepo.find({ where: { vendorId }, order: { distanceKm: 'ASC' } });
  }

  async upsertDeliveryRate(vendorId: string, data: Partial<DeliveryRate>) {
    const rate = this.deliveryRatesRepo.create({
      vendorId,
      distanceKm: this.parseNonNegativeNumber(data.distanceKm, 'distanceKm'),
      chargeAmount: this.parseNonNegativeNumber(data.chargeAmount, 'chargeAmount'),
      helpersCount: this.parseNonNegativeInteger(
        data.helpersCount,
        'helpersCount',
        1,
      ),
    });

    return this.deliveryRatesRepo.save(rate);
  }

  async updateDeliveryRate(vendorId: string, id: string, data: Partial<DeliveryRate>) {
    const existing = await this.deliveryRatesRepo.findOne({ where: { id, vendorId } });

    if (!existing) {
      throw new NotFoundException('Delivery rate not found');
    }

    const updated = this.deliveryRatesRepo.merge(existing, {
      distanceKm:
        data.distanceKm !== undefined
          ? this.parseNonNegativeNumber(data.distanceKm, 'distanceKm')
          : existing.distanceKm,
      chargeAmount:
        data.chargeAmount !== undefined
          ? this.parseNonNegativeNumber(data.chargeAmount, 'chargeAmount')
          : existing.chargeAmount,
      helpersCount:
        data.helpersCount !== undefined
          ? this.parseNonNegativeInteger(data.helpersCount, 'helpersCount')
          : existing.helpersCount,
    });

    return this.deliveryRatesRepo.save(updated);
  }

  async deleteDeliveryRate(vendorId: string, id: string) {
    const result = await this.deliveryRatesRepo.delete({ id, vendorId });

    if (!result.affected) {
      throw new NotFoundException('Delivery rate not found');
    }
  }

  private parseNonNegativeNumber(rawValue: unknown, fieldName: string) {
    const value = Number(rawValue);
    if (!Number.isFinite(value) || value < 0) {
      throw new BadRequestException(`${fieldName} must be a non-negative number`);
    }
    return value;
  }

  private parseNonNegativeInteger(
    rawValue: unknown,
    fieldName: string,
    defaultValue?: number,
  ) {
    if (
      rawValue === undefined ||
      rawValue === null ||
      String(rawValue).trim() === ''
    ) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new BadRequestException(`${fieldName} is required`);
    }

    const value = Number(rawValue);
    if (!Number.isInteger(value) || value < 0) {
      throw new BadRequestException(
        `${fieldName} must be a non-negative integer`,
      );
    }
    return value;
  }
}
