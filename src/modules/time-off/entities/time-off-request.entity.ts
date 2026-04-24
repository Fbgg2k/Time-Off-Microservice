import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Employee } from './employee.entity';
import { Location } from './location.entity';
import { BalanceType } from './time-off-balance.entity';

// Re-export BalanceType for convenience
export { BalanceType };

export enum RequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

@Entity('time_off_requests')
export class TimeOffRequest extends BaseEntity {
  @Column({ length: 50 })
  employeeId: string;

  @Column({ length: 50 })
  locationId: string;

  @Column({ length: 20, default: 'ANNUAL' })
  balanceType: string;

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date' })
  endDate: Date;

  @Column({ type: 'integer', default: 0 })
  daysRequested: number;

  @Column({ length: 20, default: 'PENDING' })
  status: string;

  @Column({ type: 'datetime' })
  requestedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  reviewedAt?: Date;

  @Column({ length: 50, nullable: true })
  reviewedBy?: string;

  @Column({ type: 'text', nullable: true })
  comments?: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employeeId' })
  employee: Employee;

  @ManyToOne(() => Location)
  @JoinColumn({ name: 'locationId' })
  location: Location;
}
