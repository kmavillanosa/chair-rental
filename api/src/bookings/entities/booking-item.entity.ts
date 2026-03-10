import {
  Entity, PrimaryColumn, Column, BeforeInsert, ManyToOne, JoinColumn,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Booking } from './booking.entity';
import { InventoryItem } from '../../inventory/entities/inventory-item.entity';

@Entity('booking_items')
export class BookingItem {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 36 })
  bookingId: string;

  @ManyToOne(() => Booking, (booking) => booking.items)
  @JoinColumn({ name: 'bookingId' })
  booking: Booking;

  @Column({ type: 'varchar', length: 36 })
  inventoryItemId: string;

  @ManyToOne(() => InventoryItem)
  @JoinColumn({ name: 'inventoryItemId' })
  inventoryItem: InventoryItem;

  @Column()
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  ratePerDay: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  subtotal: number;

  @BeforeInsert()
  generateId() {
    if (!this.id) this.id = uuidv4();
  }
}
