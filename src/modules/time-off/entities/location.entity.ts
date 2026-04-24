import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('locations')
export class Location extends BaseEntity {
  @Column({ length: 255 })
  name: string;

  @Column({ length: 50, default: 'UTC' })
  timezone: string;

  // Relationships will be defined in the related entities to avoid circular dependencies
}
