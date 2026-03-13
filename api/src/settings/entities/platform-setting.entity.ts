import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('platform_settings')
@Index('IDX_platform_settings_key', ['key'], { unique: true })
export class PlatformSetting {
  @PrimaryColumn({ type: 'varchar', length: 120 })
  key: string;

  @Column({ type: 'text', nullable: true })
  value: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
