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
import { AdminPackageTemplate } from './admin-package-template.entity';
import { ItemType } from '../../item-types/entities/item-type.entity';

@Entity('admin_package_template_items')
@Index('IDX_admin_package_template_items_unique', ['packageId', 'itemTypeId'], {
  unique: true,
})
export class AdminPackageTemplateItem {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 36 })
  packageId: string;

  @ManyToOne(() => AdminPackageTemplate, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'packageId' })
  packageTemplate: AdminPackageTemplate;

  @Column({ type: 'varchar', length: 36 })
  itemTypeId: string;

  @ManyToOne(() => ItemType)
  @JoinColumn({ name: 'itemTypeId' })
  itemType: ItemType;

  @Column({ type: 'int' })
  requiredQty: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  suggestedUnitPrice: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) this.id = uuidv4();
  }
}