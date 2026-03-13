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
    return this.bookingsRepo.find({ 
      where: { vendorId }, 
      relations: ['customer', 'items', 'items.inventoryItem', 'items.inventoryItem.itemType', 'items.inventoryItem.brand'] 
    });
  }

  findByCustomer(customerId: string) {
    return this.bookingsRepo.find({ 
      where: { customerId }, 
      relations: ['vendor', 'items', 'items.inventoryItem', 'items.inventoryItem.itemType', 'items.inventoryItem.brand'] 
    });
  }

  findById(id: string) {
    return this.bookingsRepo.findOne({ 
      where: { id }, 
      relations: ['customer', 'vendor', 'items', 'items.inventoryItem', 'items.inventoryItem.itemType', 'items.inventoryItem.brand'] 
    });
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

      // Get all active bookings that overlap with requested dates
      const overlappingBookings = await manager.find(Booking, {
        where: { vendorId: data.vendorId },
        relations: ['items'],
      });

      const activeOverlappingBookings = overlappingBookings.filter(b =>
        [BookingStatus.PENDING, BookingStatus.CONFIRMED].includes(b.status) &&
        new Date(b.endDate) >= startDate &&
        new Date(b.startDate) <= endDate
      );

      let subtotalItems = 0;
      const bookingItems: Partial<BookingItem>[] = [];

      for (const item of data.items) {
        const invItem = await manager.findOne(InventoryItem, {
          where: { id: item.inventoryItemId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!invItem) {
          throw new BadRequestException(`Item ${item.inventoryItemId} not found`);
        }

        // Calculate how much is already booked during overlapping dates
        const bookedQuantity = activeOverlappingBookings.reduce((sum, booking) => {
          const bookingItem = booking.items?.find(bi => bi.inventoryItemId === item.inventoryItemId);
          return sum + (bookingItem?.quantity || 0);
        }, 0);

        const availableQuantity = Number(invItem.quantity) - bookedQuantity;

        if (availableQuantity < item.quantity) {
          throw new BadRequestException(`Insufficient availability for item ${item.inventoryItemId}. Only ${availableQuantity} available for the selected dates.`);
        }

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
}
