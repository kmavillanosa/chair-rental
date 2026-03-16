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
import { BookingDispute } from './booking-dispute.entity';
import { User, UserRole } from '../../users/entities/user.entity';

@Entity('booking_dispute_evidence')
@Index('IDX_booking_dispute_evidence_dispute_created', ['disputeId', 'createdAt'])
export class BookingDisputeEvidence {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 36 })
  disputeId: string;

  @ManyToOne(() => BookingDispute, (dispute) => dispute.evidence)
  @JoinColumn({ name: 'disputeId' })
  dispute: BookingDispute;

  @Column({ type: 'varchar', length: 36 })
  uploadedByUserId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'uploadedByUserId' })
  uploadedByUser: User;

  @Column({ type: 'enum', enum: UserRole })
  uploadedByRole: UserRole;

  @Column({ type: 'varchar', length: 500 })
  fileUrl: string;

  @Column({ type: 'text', nullable: true })
  note: string;

  @Column({ type: 'text', nullable: true })
  metadata: string;

  @CreateDateColumn()
  createdAt: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) this.id = uuidv4();
  }
}