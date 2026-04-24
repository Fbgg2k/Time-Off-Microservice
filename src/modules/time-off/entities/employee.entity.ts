import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('employees')
export class Employee extends BaseEntity {
  @Column({ length: 255 })
  name: string;

  @Column({ length: 255, unique: true })
  email: string;

  @Column({ length: 50 })
  locationId: string;

  // Relationships removed to avoid circular dependencies
}
