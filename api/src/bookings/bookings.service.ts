import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Booking, BookingStatus } from './entities/booking.entity';
import { BookingItem } from './entities/booking-item.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { VendorPayment, PaymentStatus } from '../payments/entities/vendor-payment.entity';
import { differenceInDays } from 'date-fns';

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking) private readonly bookingsRepo: Repository<Booking>,
    @InjectRepository(BookingItem) private readonly bookingItemsRepo: Repository<BookingItem>,
    @InjectRepository(InventoryItem) private readonly inventoryRepo: Repository<InventoryItem>,
    @InjectRepository(VendorPayment) private readonly paymentsRepo: Repository<VendorPayment>,
    private readonly dataSource: DataSource,
  ) {}

  findByVendor(vendorId: string) {
    return this.bookingsRepo.find({ where: { vendorId }, relations: ['customer', 'items', 'items.inventoryItem'] });
  }

  findByCustomer(customerId: string) {
    return this.bookingsRepo.find({ where: { customerId }, relations: ['vendor', 'items', 'items.inventoryItem'] });
  }

  findById(id: string) {
    return this.bookingsRepo.findOne({ where: { id }, relations: ['customer', 'vendor', 'items', 'items.inventoryItem'] });
  }

  async create(customerId: string, data: {
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
  }) {
    // Check vendor has no overdue payments
    const overduePayment = await this.paymentsRepo.findOne({
      where: { vendorId: data.vendorId, status: PaymentStatus.OVERDUE },
    });
    if (overduePayment) {
      throw new BadRequestException('Vendor has overdue payments and cannot accept bookings');
    }

    return this.dataSource.transaction(async (manager) => {
      const startDate = new Date(data.startDate);
      const endDate = new Date(data.endDate);
      const days = Math.max(1, differenceInDays(endDate, startDate) + 1);

      let subtotalItems = 0;
      const bookingItems: Partial<BookingItem>[] = [];

      for (const item of data.items) {
        const invItem = await manager.findOne(InventoryItem, {
          where: { id: item.inventoryItemId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!invItem || invItem.availableQuantity < item.quantity) {
          throw new BadRequestException(`Insufficient availability for item ${item.inventoryItemId}`);
        }
        invItem.availableQuantity -= item.quantity;
        await manager.save(invItem);
        const subtotal = Number(invItem.ratePerDay) * item.quantity * days;
        subtotalItems += subtotal;
        bookingItems.push({ inventoryItemId: item.inventoryItemId, quantity: item.quantity, ratePerDay: invItem.ratePerDay, subtotal });
      }

      const delivery = data.deliveryCharge || 0;
      const service = data.serviceCharge || 0;
      const commissionRate = 0.10;
      const platformFee = subtotalItems * commissionRate;
      const totalAmount = subtotalItems + delivery + service;

      const booking = manager.create(Booking, {
        customerId,
        vendorId: data.vendorId,
        startDate,
        endDate,
        deliveryAddress: data.deliveryAddress,
        deliveryLatitude: data.deliveryLatitude,
        deliveryLongitude: data.deliveryLongitude,
        deliveryCharge: delivery,
        serviceCharge: service,
        platformFee,
        totalAmount,
        notes: data.notes,
        status: BookingStatus.PENDING,
      });
      const savedBooking = await manager.save(booking);

      for (const bi of bookingItems) {
        bi.bookingId = savedBooking.id;
        await manager.save(manager.create(BookingItem, bi));
      }

      return savedBooking;
    });
  }

  async updateStatus(id: string, status: BookingStatus) {
    const booking = await this.findById(id);
    if (!booking) throw new BadRequestException('Booking not found');

    if (status === BookingStatus.CANCELLED && booking.status !== BookingStatus.CANCELLED) {
      // Restore inventory
      for (const item of booking.items) {
        await this.inventoryRepo.increment({ id: item.inventoryItemId }, 'availableQuantity', item.quantity);
      }
    }

    await this.bookingsRepo.update(id, { status });
    return this.findById(id);
  }
}
