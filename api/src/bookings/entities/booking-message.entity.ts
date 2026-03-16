import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Booking } from './booking.entity';
import { User, UserRole } from '../../users/entities/user.entity';

@Entity('booking_messages')
@Index('IDX_booking_messages_booking_created', ['bookingId', 'createdAt'])
@Index('IDX_booking_messages_flagged', ['isFlagged'])
export class BookingMessage {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 36 })
  bookingId: string;

  @ManyToOne(() => Booking, (booking) => booking.messages)
  @JoinColumn({ name: 'bookingId' })
  booking: Booking;

  @Column({ type: 'varchar', length: 36 })
  senderUserId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'senderUserId' })
  senderUser: User;

  @Column({ type: 'enum', enum: UserRole })
  senderRole: UserRole;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'text' })
  redactedContent: string;

  @Column({ type: 'text', nullable: true })
  flagReasons: string;

  @Column({ default: false })
  isFlagged: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) this.id = uuidv4();
  }
}