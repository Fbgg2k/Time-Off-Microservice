import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { TimeOffBalance } from './time-off-balance.entity';

export enum SyncType {
  REALTIME = 'REALTIME',
  BATCH = 'BATCH',
  MANUAL = 'MANUAL',
}

export enum SyncSource {
  HCM_SYNC = 'HCM_SYNC',
  REQUEST_APPROVAL = 'REQUEST_APPROVAL',
  REQUEST_CANCELLATION = 'REQUEST_CANCELLATION',
  MANUAL_ADJUSTMENT = 'MANUAL_ADJUSTMENT',
}

@Entity('balance_sync_logs')
export class BalanceSyncLog extends BaseEntity {
  @Column({ length: 50 })
  employeeId: string;

  @Column({ length: 50 })
  locationId: string;

  @Column({ length: 50 })
  balanceType: string;

  @Column({ type: 'integer', default: 0 })
  previousBalance: number;

  @Column({ type: 'integer', default: 0 })
  newBalance: number;

  @Column({ length: 20, default: 'REALTIME' })
  syncType: string;

  @Column({ length: 30, default: 'HCM_SYNC' })
  source: string;

  @Column({ type: 'boolean', default: true })
  success: boolean;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'datetime' })
  syncedAt: Date;

  @ManyToOne(() => TimeOffBalance)
  @JoinColumn({ name: 'balanceId' })
  balance: TimeOffBalance;
}
