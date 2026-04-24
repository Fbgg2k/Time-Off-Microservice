import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { TimeOffBalanceRepository } from '../repositories/time-off-balance.repository';
import { HCMIntegrationService } from '../../hcm/services/hcm-integration.service';
import { BalanceSyncService } from './balance-sync.service';
import { TimeOffBalance, BalanceType } from '../entities/time-off-balance.entity';
import { SyncType, SyncSource } from '../entities/balance-sync-log.entity';

@Injectable()
export class TimeOffBalanceService {
  private readonly logger = new Logger(TimeOffBalanceService.name);

  constructor(
    private readonly balanceRepository: TimeOffBalanceRepository,
    private readonly hcmService: HCMIntegrationService,
    private readonly syncService: BalanceSyncService,
  ) {}

  /**
   * Get available balance for an employee
   */
  async getAvailableBalance(
    employeeId: string,
    locationId: string,
    balanceType: BalanceType,
  ): Promise<number> {
    this.logger.debug(
      `Getting available balance for employee ${employeeId}, type ${balanceType}`,
    );

    const balance = await this.balanceRepository.findByEmployeeAndLocation(
      employeeId,
      locationId,
      balanceType,
    );

    if (!balance) {
      throw new NotFoundException(`Balance not found for employee ${employeeId}, type ${balanceType}`);
    }

    // Check if balance is stale and needs sync
    const isStale = this.isBalanceStale(balance);
    if (isStale) {
      this.logger.debug(`Balance is stale, syncing with HCM for employee ${employeeId}`);
      await this.syncEmployeeBalance(employeeId, locationId, balanceType);
      
      // Get updated balance after sync
      const updatedBalance = await this.balanceRepository.findByEmployeeAndLocation(
        employeeId,
        locationId,
        balanceType,
      );
      
      return updatedBalance?.availableDays || 0;
    }

    return balance.availableDays;
  }

  /**
   * Validate balance for a time-off request
   */
  async validateBalanceForRequest(
    employeeId: string,
    locationId: string,
    balanceType: BalanceType,
    daysRequested: number,
  ): Promise<{
    valid: boolean;
    availableBalance: number;
    message?: string;
    warning?: string;
  }> {
    this.logger.debug(
      `Validating balance for ${daysRequested} days for employee ${employeeId}, type ${balanceType}`,
    );

    try {
      // Validate with HCM first for real-time validation
      const hcmValidation = await this.hcmService.validateBalance(
        employeeId,
        locationId,
        balanceType,
        daysRequested,
      );

      if (!hcmValidation.valid) {
        return {
          valid: false,
          availableBalance: hcmValidation.availableBalance,
          message: hcmValidation.message || 'Insufficient balance in HCM',
        };
      }

      // Also check local balance as fallback
      const localBalance = await this.balanceRepository.findByEmployeeAndLocation(
        employeeId,
        locationId,
        balanceType,
      );

      if (!localBalance) {
        return {
          valid: false,
          availableBalance: 0,
          message: 'Balance not found',
        };
      }

      if (localBalance.availableDays < daysRequested) {
        return {
          valid: false,
          availableBalance: localBalance.availableDays,
          message: 'Insufficient local balance',
        };
      }

      return {
        valid: true,
        availableBalance: hcmValidation.availableBalance,
      };
    } catch (error) {
      this.logger.warn(
        `HCM validation failed for employee ${employeeId}, using local balance: ${error.message}`,
      );

      // Fallback to local balance validation
      const localBalance = await this.balanceRepository.findByEmployeeAndLocation(
        employeeId,
        locationId,
        balanceType,
      );

      if (!localBalance) {
        return {
          valid: false,
          availableBalance: 0,
          message: 'Balance not found',
          warning: 'HCM validation failed, using local balance',
        };
      }

      const isValid = localBalance.availableDays >= daysRequested;
      return {
        valid: isValid,
        availableBalance: localBalance.availableDays,
        message: isValid ? undefined : 'Insufficient balance',
        warning: 'HCM validation failed, using local balance',
      };
    }
  }

  /**
   * Deduct days from balance (for approved requests)
   */
  async deductBalance(
    employeeId: string,
    locationId: string,
    balanceType: BalanceType,
    daysToDeduct: number,
  ): Promise<TimeOffBalance> {
    this.logger.debug(
      `Deducting ${daysToDeduct} days from balance for employee ${employeeId}, type ${balanceType}`,
    );

    // Get balance with lock to prevent concurrent modifications
    const balance = await this.balanceRepository.findWithLock(
      employeeId,
      locationId,
      balanceType,
    );

    if (!balance) {
      throw new NotFoundException(`Balance not found for employee ${employeeId}, type ${balanceType}`);
    }

    // Check if sufficient balance is available
    if (balance.availableDays < daysToDeduct) {
      throw new BadRequestException(
        `Insufficient balance. Available: ${balance.availableDays}, Requested: ${daysToDeduct}`,
      );
    }

    const previousBalance = balance.availableDays;
    const previousUsedDays = balance.usedDays;

    // Update balance
    const updatedBalance = await this.balanceRepository.update(
      employeeId,
      locationId,
      balanceType,
      {
        usedDays: previousUsedDays + daysToDeduct,
        availableDays: previousBalance - daysToDeduct,
        lastSyncedAt: new Date(),
      },
    );

    try {
      // Sync with HCM
      await this.hcmService.updateBalance(
        employeeId,
        locationId,
        balanceType,
        updatedBalance.usedDays,
        updatedBalance.availableDays,
      );

      // Log successful sync
      await this.syncService.logSyncOperation(
        employeeId,
        locationId,
        balanceType,
        previousBalance,
        updatedBalance.availableDays,
        SyncType.REALTIME,
        SyncSource.REQUEST_APPROVAL,
        true,
      );

      return updatedBalance;
    } catch (hcmError) {
      this.logger.error(
        `Failed to sync balance deduction with HCM for employee ${employeeId}: ${hcmError.message}`,
      );

      // Rollback local changes
      await this.balanceRepository.update(
        employeeId,
        locationId,
        balanceType,
        {
          usedDays: previousUsedDays,
          availableDays: previousBalance,
        },
      );

      // Log failed sync
      await this.syncService.logSyncOperation(
        employeeId,
        locationId,
        balanceType,
        previousBalance,
        previousBalance - daysToDeduct,
        SyncType.REALTIME,
        SyncSource.REQUEST_APPROVAL,
        false,
        hcmError.message,
      );

      throw new Error(`Failed to sync with HCM: ${hcmError.message}`);
    }
  }

  /**
   * Restore days to balance (for cancelled requests)
   */
  async restoreBalance(
    employeeId: string,
    locationId: string,
    balanceType: BalanceType,
    daysToRestore: number,
  ): Promise<TimeOffBalance> {
    this.logger.debug(
      `Restoring ${daysToRestore} days to balance for employee ${employeeId}, type ${balanceType}`,
    );

    // Get balance with lock
    const balance = await this.balanceRepository.findWithLock(
      employeeId,
      locationId,
      balanceType,
    );

    if (!balance) {
      throw new NotFoundException(`Balance not found for employee ${employeeId}, type ${balanceType}`);
    }

    // Prevent negative used days
    if (balance.usedDays < daysToRestore) {
      throw new BadRequestException(
        `Cannot restore more days than used. Used: ${balance.usedDays}, Requested: ${daysToRestore}`,
      );
    }

    const previousBalance = balance.availableDays;
    const previousUsedDays = balance.usedDays;

    // Update balance
    const updatedBalance = await this.balanceRepository.update(
      employeeId,
      locationId,
      balanceType,
      {
        usedDays: previousUsedDays - daysToRestore,
        availableDays: previousBalance + daysToRestore,
        lastSyncedAt: new Date(),
      },
    );

    try {
      // Sync with HCM
      await this.hcmService.updateBalance(
        employeeId,
        locationId,
        balanceType,
        updatedBalance.usedDays,
        updatedBalance.availableDays,
      );

      // Log successful sync
      await this.syncService.logSyncOperation(
        employeeId,
        locationId,
        balanceType,
        previousBalance,
        updatedBalance.availableDays,
        SyncType.REALTIME,
        SyncSource.REQUEST_CANCELLATION,
        true,
      );

      return updatedBalance;
    } catch (hcmError) {
      this.logger.error(
        `Failed to sync balance restoration with HCM for employee ${employeeId}: ${hcmError.message}`,
      );

      // Rollback local changes
      await this.balanceRepository.update(
        employeeId,
        locationId,
        balanceType,
        {
          usedDays: previousUsedDays,
          availableDays: previousBalance,
        },
      );

      // Log failed sync
      await this.syncService.logSyncOperation(
        employeeId,
        locationId,
        balanceType,
        previousBalance,
        previousBalance + daysToRestore,
        SyncType.REALTIME,
        SyncSource.REQUEST_CANCELLATION,
        false,
        hcmError.message,
      );

      throw new Error(`Failed to sync with HCM: ${hcmError.message}`);
    }
  }

  /**
   * Get balance history for an employee
   */
  async getBalanceHistory(
    employeeId: string,
    locationId: string,
    balanceType: BalanceType,
  ): Promise<any[]> {
    this.logger.debug(
      `Getting balance history for employee ${employeeId}, type ${balanceType}`,
    );

    return await this.syncService.getBalanceHistory(employeeId, locationId, balanceType);
  }

  /**
   * Sync individual employee balance with HCM
   */
  async syncEmployeeBalance(
    employeeId: string,
    locationId: string,
    balanceType: BalanceType,
  ): Promise<TimeOffBalance> {
    this.logger.debug(
      `Syncing balance for employee ${employeeId}, type ${balanceType} with HCM`,
    );

    try {
      // Get current balance from HCM
      const hcmBalance = await this.hcmService.getBalance(employeeId, locationId, balanceType);

      // Get local balance
      const localBalance = await this.balanceRepository.findByEmployeeAndLocation(
        employeeId,
        locationId,
        balanceType,
      );

      const previousAvailable = localBalance?.availableDays || 0;

      if (!localBalance) {
        // Create new balance if it doesn't exist
        const newBalance = await this.balanceRepository.create({
          employeeId,
          locationId,
          balanceType,
          totalDays: hcmBalance.totalDays,
          usedDays: hcmBalance.usedDays,
          availableDays: hcmBalance.availableDays,
          lastSyncedAt: new Date(),
        });

        await this.syncService.logSyncOperation(
          employeeId,
          locationId,
          balanceType,
          0,
          hcmBalance.availableDays,
          SyncType.REALTIME,
          SyncSource.HCM_SYNC,
          true,
        );

        return newBalance;
      } else {
        // Update existing balance
        const updatedBalance = await this.balanceRepository.update(
          employeeId,
          locationId,
          balanceType,
          {
            totalDays: hcmBalance.totalDays,
            usedDays: hcmBalance.usedDays,
            availableDays: hcmBalance.availableDays,
            lastSyncedAt: new Date(),
          },
        );

        await this.syncService.logSyncOperation(
          employeeId,
          locationId,
          balanceType,
          previousAvailable,
          hcmBalance.availableDays,
          SyncType.REALTIME,
          SyncSource.HCM_SYNC,
          true,
        );

        return updatedBalance;
      }
    } catch (error) {
      this.logger.error(
        `Failed to sync balance for employee ${employeeId}, type ${balanceType}: ${error.message}`,
      );

      // Log failed sync
      await this.syncService.logSyncOperation(
        employeeId,
        locationId,
        balanceType,
        0,
        0,
        SyncType.REALTIME,
        SyncSource.HCM_SYNC,
        false,
        error.message,
      );

      throw new Error(`Failed to sync balance: ${error.message}`);
    }
  }

  /**
   * Get available balance for a date range (considering existing requests)
   */
  async getAvailableBalanceForDateRange(
    employeeId: string,
    locationId: string,
    balanceType: BalanceType,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    availableBalance: number;
    totalBalance: number;
    usedInPeriod: number;
  }> {
    this.logger.debug(
      `Getting balance for date range ${startDate} to ${endDate} for employee ${employeeId}`,
    );

    const balance = await this.balanceRepository.findByEmployeeAndLocation(
      employeeId,
      locationId,
      balanceType,
    );

    if (!balance) {
      throw new NotFoundException(`Balance not found for employee ${employeeId}, type ${balanceType}`);
    }

    return {
      availableBalance: balance.availableDays,
      totalBalance: balance.totalDays,
      usedInPeriod: 0, // This would require checking requests in the period
    };
  }

  /**
   * Check if balance data is stale and needs sync
   */
  private isBalanceStale(balance: TimeOffBalance, hoursThreshold: number = 24): boolean {
    if (!balance.lastSyncedAt) {
      return true; // Never synced
    }

    const now = new Date();
    const hoursSinceLastSync = (now.getTime() - balance.lastSyncedAt.getTime()) / (1000 * 60 * 60);
    
    return hoursSinceLastSync > hoursThreshold;
  }

  /**
   * Get all balances for an employee
   */
  async getAllEmployeeBalances(employeeId: string): Promise<TimeOffBalance[]> {
    this.logger.debug(`Getting all balances for employee ${employeeId}`);

    return await this.balanceRepository.findByEmployee(employeeId);
  }

  /**
   * Create initial balance for an employee
   */
  async createInitialBalance(
    employeeId: string,
    locationId: string,
    balanceType: BalanceType,
    totalDays: number,
  ): Promise<TimeOffBalance> {
    this.logger.debug(
      `Creating initial balance for employee ${employeeId}, type ${balanceType}, total days: ${totalDays}`,
    );

    const existingBalance = await this.balanceRepository.exists(employeeId, locationId, balanceType);
    if (existingBalance) {
      throw new BadRequestException(`Balance already exists for employee ${employeeId}, type ${balanceType}`);
    }

    const balance = await this.balanceRepository.create({
      employeeId,
      locationId,
      balanceType,
      totalDays,
      usedDays: 0,
      availableDays: totalDays,
      lastSyncedAt: new Date(),
    });

    await this.syncService.logSyncOperation(
      employeeId,
      locationId,
      balanceType,
      0,
      totalDays,
      SyncType.MANUAL,
      SyncSource.MANUAL_ADJUSTMENT,
      true,
    );

    return balance;
  }
}
