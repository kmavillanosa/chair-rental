import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Booking } from './booking.entity';
import { User, UserRole } from '../../users/entities/user.entity';

@Entity('booking_reviews')
@Index('IDX_booking_reviews_booking_reviewer', ['bookingId', 'reviewerUserId'], {
  unique: true,
})
@Index('IDX_booking_reviews_reviewee', ['revieweeUserId', 'revieweeRole'])
export class BookingReview {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 36 })
  bookingId: string;

  @ManyToOne(() => Booking, (booking) => booking.reviews)
  @JoinColumn({ name: 'bookingId' })
  booking: Booking;

  @Column({ type: 'varchar', length: 36 })
  reviewerUserId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'reviewerUserId' })
  reviewerUser: User;

  @Column({ type: 'varchar', length: 36 })
  revieweeUserId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'revieweeUserId' })
  revieweeUser: User;

  @Column({ type: 'enum', enum: UserRole })
  reviewerRole: UserRole;

  @Column({ type: 'enum', enum: UserRole })
  revieweeRole: UserRole;

  @Column({ type: 'int' })
  rating: number;

  @Column({ type: 'text', nullable: true })
  comment: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) this.id = uuidv4();
  }
}