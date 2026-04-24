import { Entity, Column, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Employee } from './employee.entity';
import { Location } from './location.entity';

export enum BalanceType {
  ANNUAL = 'ANNUAL',
  SICK = 'SICK',
  PERSONAL = 'PERSONAL',
}

@Entity('time_off_balances')
export class TimeOffBalance extends BaseEntity {
  @Column({ length: 50 })
  employeeId: string;

  @Column({ length: 50 })
  locationId: string;

  @Column({ length: 20, default: 'ANNUAL' })
  balanceType: string;

  @Column({ type: 'integer', default: 0 })
  totalDays: number;

  @Column({ type: 'integer', default: 0 })
  usedDays: number;

  @Column({ type: 'integer', default: 0 })
  availableDays: number;

  @Column({ type: 'datetime', nullable: true })
  lastSyncedAt: Date;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employeeId' })
  employee: Employee;

  @ManyToOne(() => Location)
  @JoinColumn({ name: 'locationId' })
  location: Location;

  // Sync logs relationship removed to avoid circular dependency
}
