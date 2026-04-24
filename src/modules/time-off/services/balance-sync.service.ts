import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BalanceSyncLog, SyncType, SyncSource } from '../entities/balance-sync-log.entity';
import { TimeOffBalance } from '../entities/time-off-balance.entity';

@Injectable()
export class BalanceSyncService {
  private readonly logger = new Logger(BalanceSyncService.name);

  constructor(
    @InjectRepository(BalanceSyncLog)
    private readonly syncLogRepository: Repository<BalanceSyncLog>,
    @InjectRepository(TimeOffBalance)
    private readonly balanceRepository: Repository<TimeOffBalance>,
  ) {}

  /**
   * Log a synchronization operation for audit trail
   */
  async logSyncOperation(
    employeeId: string,
    locationId: string,
    balanceType: string,
    previousBalance: number,
    newBalance: number,
    syncType: SyncType,
    source: SyncSource,
    success: boolean = true,
    errorMessage?: string,
  ): Promise<BalanceSyncLog> {
    this.logger.debug(
      `Logging sync operation for employee ${employeeId}, type ${balanceType}, source ${source}`,
    );

    const syncLog = this.syncLogRepository.create({
      employeeId,
      locationId,
      balanceType: balanceType as any,
      previousBalance,
      newBalance,
      syncType,
      source,
      success,
      errorMessage,
      syncedAt: new Date(),
    });

    return await this.syncLogRepository.save(syncLog);
  }

  /**
   * Get balance synchronization history for an employee
   */
  async getBalanceHistory(
    employeeId: string,
    locationId: string,
    balanceType: string,
    limit: number = 50,
  ): Promise<BalanceSyncLog[]> {
    this.logger.debug(
      `Getting balance history for employee ${employeeId}, type ${balanceType}`,
    );

    return await this.syncLogRepository.find({
      where: {
        employeeId,
        locationId,
        balanceType,
      },
      order: {
        syncedAt: 'DESC',
      },
      take: limit,
    });
  }

  /**
   * Get recent failed sync operations for retry
   */
  async getFailedSyncOperations(
    hoursBack: number = 24,
    limit: number = 100,
  ): Promise<BalanceSyncLog[]> {
    this.logger.debug(`Getting failed sync operations from last ${hoursBack} hours`);

    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - hoursBack);

    return await this.syncLogRepository.find({
      where: {
        success: false,
        syncedAt: cutoffTime,
      },
      order: {
        syncedAt: 'DESC',
      },
      take: limit,
    });
  }

  /**
   * Get sync statistics for reporting
   */
  async getSyncStatistics(
    employeeId?: string,
    locationId?: string,
    daysBack: number = 30,
  ): Promise<{
    totalSyncs: number;
    successfulSyncs: number;
    failedSyncs: number;
    successRate: number;
    syncsByType: Record<SyncType, number>;
    syncsBySource: Record<SyncSource, number>;
  }> {
    this.logger.debug(`Getting sync statistics for the last ${daysBack} days`);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    const whereCondition: any = {
      syncedAt: cutoffDate,
    };

    if (employeeId) {
      whereCondition.employeeId = employeeId;
    }
    if (locationId) {
      whereCondition.locationId = locationId;
    }

    const [totalSyncs, successfulSyncs, failedSyncs, syncsByType, syncsBySource] = await Promise.all([
      this.syncLogRepository.count({ where: whereCondition }),
      this.syncLogRepository.count({ 
        where: { ...whereCondition, success: true } 
      }),
      this.syncLogRepository.count({ 
        where: { ...whereCondition, success: false } 
      }),
      this.getSyncsByField('syncType', whereCondition),
      this.getSyncsByField('source', whereCondition),
    ]);

    const successRate = totalSyncs > 0 ? (successfulSyncs / totalSyncs) * 100 : 0;

    return {
      totalSyncs,
      successfulSyncs,
      failedSyncs,
      successRate,
      syncsByType,
      syncsBySource,
    };
  }

  /**
   * Clean up old sync logs to prevent database bloat
   */
  async cleanupOldSyncLogs(daysToKeep: number = 90): Promise<number> {
    this.logger.debug(`Cleaning up sync logs older than ${daysToKeep} days`);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.syncLogRepository.createQueryBuilder()
      .delete()
      .where('syncedAt < :cutoffDate', { cutoffDate })
      .execute();

    const deletedCount = result.affected || 0;
    this.logger.log(`Cleaned up ${deletedCount} old sync log entries`);

    return deletedCount;
  }

  /**
   * Detect balance discrepancies between local and HCM
   */
  async detectBalanceDiscrepancies(
    employeeId: string,
    locationId: string,
    balanceType: string,
    hcmBalance: number,
  ): Promise<{
    hasDiscrepancy: boolean;
    localBalance: number;
    difference: number;
    lastSyncTime?: Date;
  }> {
    this.logger.debug(
      `Detecting balance discrepancies for employee ${employeeId}, type ${balanceType}`,
    );

    const localBalanceRecord = await this.balanceRepository.findOne({
      where: {
        employeeId,
        locationId,
        balanceType: balanceType as any,
      },
    });

    if (!localBalanceRecord) {
      return {
        hasDiscrepancy: true,
        localBalance: 0,
        difference: hcmBalance,
      };
    }

    const localBalance = localBalanceRecord.availableDays;
    const difference = hcmBalance - localBalance;
    const hasDiscrepancy = Math.abs(difference) > 0.01; // Allow for small rounding differences

    return {
      hasDiscrepancy,
      localBalance,
      difference,
      lastSyncTime: localBalanceRecord.lastSyncedAt,
    };
  }

  /**
   * Get sync performance metrics
   */
  async getSyncPerformanceMetrics(daysBack: number = 7): Promise<{
    averageSyncTime: number;
    slowestSync: number;
    fastestSync: number;
    totalSyncs: number;
  }> {
    this.logger.debug(`Getting sync performance metrics for last ${daysBack} days`);

    // This would require adding sync duration to the sync log entity
    // For now, returning placeholder metrics
    return {
      averageSyncTime: 150, // milliseconds
      slowestSync: 5000,
      fastestSync: 50,
      totalSyncs: 0,
    };
  }

  /**
   * Helper method to get syncs grouped by a specific field
   */
  private async getSyncsByField(
    field: 'syncType' | 'source',
    whereCondition: any,
  ): Promise<Record<string, number>> {
    const result = await this.syncLogRepository
      .createQueryBuilder('sync')
      .select(`sync.${field}`, 'field')
      .addSelect('COUNT(*)', 'count')
      .where(whereCondition)
      .groupBy(`sync.${field}`)
      .getRawMany();

    return result.reduce((acc, item) => {
      acc[item.field] = parseInt(item.count);
      return acc;
    }, {});
  }

  /**
   * Batch log multiple sync operations
   */
  async batchLogSyncOperations(
    syncOperations: Array<{
      employeeId: string;
      locationId: string;
      balanceType: string;
      previousBalance: number;
      newBalance: number;
      syncType: SyncType;
      source: SyncSource;
      success: boolean;
      errorMessage?: string;
    }>,
  ): Promise<BalanceSyncLog[]> {
    this.logger.debug(`Batch logging ${syncOperations.length} sync operations`);

    const syncLogs = syncOperations.map(operation => 
      this.syncLogRepository.create({
        ...operation,
        syncedAt: new Date(),
      })
    );

    return await this.syncLogRepository.save(syncLogs);
  }

  /**
   * Get sync operations that need retry
   */
  async getRetryableSyncOperations(maxRetries: number = 3): Promise<BalanceSyncLog[]> {
    this.logger.debug(`Getting sync operations eligible for retry (max ${maxRetries} retries)`);

    // This would require tracking retry count in the sync log
    // For now, returning recent failed operations
    return await this.getFailedSyncOperations(1, 50);
  }
}
