import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  Index,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

@Entity('vendor_phone_otp_challenges')
@Index('IDX_vendor_phone_otp_user_phone', ['userId', 'phone'])
@Index('IDX_vendor_phone_otp_expiry', ['expiresAt'])
@Index('IDX_vendor_phone_otp_verified', ['verifiedAt'])
export class VendorPhoneOtpChallenge {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 36 })
  userId: string;

  @Column({ type: 'varchar', length: 20 })
  phone: string;

  @Column({ type: 'varchar', length: 128 })
  otpHash: string;

  @Column({ type: 'datetime' })
  expiresAt: Date;

  @Column({ type: 'datetime', nullable: true })
  verifiedAt: Date;

  @Column({ type: 'int', default: 0 })
  attemptCount: number;

  @Column({ type: 'varchar', length: 64, nullable: true })
  requestIp: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  deviceFingerprintHash: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) this.id = uuidv4();
  }
}
