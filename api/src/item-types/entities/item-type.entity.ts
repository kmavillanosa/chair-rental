import {
  Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, BeforeInsert,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

@Entity('item_types')
export class ItemType {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  pictureUrl: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  defaultRatePerDay: number;

  @Column({ type: 'json', nullable: true })
  eventTags: string[];

  @Column({ type: 'json', nullable: true })
  setTags: string[];

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) this.id = uuidv4();
  }
}
