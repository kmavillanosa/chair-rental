import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VendorPayment, PaymentStatus } from './entities/vendor-payment.entity';
import { DeliveryRate } from './entities/delivery-rate.entity';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(VendorPayment) private readonly paymentsRepo: Repository<VendorPayment>,
    @InjectRepository(DeliveryRate) private readonly deliveryRatesRepo: Repository<DeliveryRate>,
  ) {}

  findByVendor(vendorId: string) {
    return this.paymentsRepo.find({ where: { vendorId }, order: { createdAt: 'DESC' } });
  }

  findAllPayments() {
    return this.paymentsRepo.find({ relations: ['vendor'], order: { createdAt: 'DESC' } });
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
    const rate = this.deliveryRatesRepo.create({ ...data, vendorId });
    return this.deliveryRatesRepo.save(rate);
  }

  async updateDeliveryRate(vendorId: string, id: string, data: Partial<DeliveryRate>) {
    const existing = await this.deliveryRatesRepo.findOne({ where: { id, vendorId } });

    if (!existing) {
      throw new NotFoundException('Delivery rate not found');
    }

    const updated = this.deliveryRatesRepo.merge(existing, {
      distanceKm: data.distanceKm !== undefined ? Number(data.distanceKm) : existing.distanceKm,
      chargeAmount: data.chargeAmount !== undefined ? Number(data.chargeAmount) : existing.chargeAmount,
      helpersCount: data.helpersCount !== undefined ? Number(data.helpersCount) : existing.helpersCount,
    });

    return this.deliveryRatesRepo.save(updated);
  }

  async deleteDeliveryRate(vendorId: string, id: string) {
    const result = await this.deliveryRatesRepo.delete({ id, vendorId });

    if (!result.affected) {
      throw new NotFoundException('Delivery rate not found');
    }
  }
}
