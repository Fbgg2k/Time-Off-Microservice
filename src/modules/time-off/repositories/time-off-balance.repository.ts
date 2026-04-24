import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Not } from 'typeorm';
import { TimeOffBalance, BalanceType } from '../entities/time-off-balance.entity';

@Injectable()
export class TimeOffBalanceRepository {
  private readonly logger = new Logger(TimeOffBalanceRepository.name);

  constructor(
    @InjectRepository(TimeOffBalance)
    private readonly balanceRepository: Repository<TimeOffBalance>,
  ) {}

  /**
   * Find balance by employee, location, and balance type
   */
  async findByEmployeeAndLocation(
    employeeId: string,
    locationId: string,
    balanceType: BalanceType,
  ): Promise<TimeOffBalance | null> {
    this.logger.debug(
      `Finding balance for employee ${employeeId}, location ${locationId}, type ${balanceType}`,
    );

    return await this.balanceRepository.findOne({
      where: {
        employeeId,
        locationId,
        balanceType,
      },
    });
  }

  /**
   * Find all balances for an employee
   */
  async findByEmployee(employeeId: string): Promise<TimeOffBalance[]> {
    this.logger.debug(`Finding all balances for employee ${employeeId}`);

    return await this.balanceRepository.find({
      where: { employeeId },
      order: { balanceType: 'ASC' },
    });
  }

  /**
   * Find all balances for a location
   */
  async findByLocation(locationId: string): Promise<TimeOffBalance[]> {
    this.logger.debug(`Finding all balances for location ${locationId}`);

    return await this.balanceRepository.find({
      where: { locationId },
      order: { employeeId: 'ASC', balanceType: 'ASC' },
    });
  }

  /**
   * Find balance with pessimistic lock for concurrent operations
   */
  async findWithLock(
    employeeId: string,
    locationId: string,
    balanceType: BalanceType,
  ): Promise<TimeOffBalance | null> {
    this.logger.debug(
      `Finding balance with lock for employee ${employeeId}, type ${balanceType}`,
    );

    return await this.balanceRepository.findOne({
      where: {
        employeeId,
        locationId,
        balanceType,
      },
      lock: { mode: 'pessimistic_write' },
    });
  }

  /**
   * Create a new balance record
   */
  async create(balanceData: Partial<TimeOffBalance>): Promise<TimeOffBalance> {
    this.logger.debug(
      `Creating balance for employee ${balanceData.employeeId}, type ${balanceData.balanceType}`,
    );

    const balance = this.balanceRepository.create(balanceData);
    return await this.balanceRepository.save(balance);
  }

  /**
   * Update an existing balance
   */
  async update(
    employeeId: string,
    locationId: string,
    balanceType: BalanceType,
    updateData: Partial<TimeOffBalance>,
  ): Promise<TimeOffBalance> {
    this.logger.debug(
      `Updating balance for employee ${employeeId}, type ${balanceType}`,
    );

    await this.balanceRepository.update(
      { employeeId, locationId, balanceType },
      updateData,
    );

    const updatedBalance = await this.findByEmployeeAndLocation(
      employeeId,
      locationId,
      balanceType,
    );

    if (!updatedBalance) {
      throw new Error('Balance not found after update');
    }

    return updatedBalance;
  }

  /**
   * Save a balance record (create or update)
   */
  async save(balance: TimeOffBalance): Promise<TimeOffBalance> {
    this.logger.debug(
      `Saving balance for employee ${balance.employeeId}, type ${balance.balanceType}`,
    );

    return await this.balanceRepository.save(balance);
  }

  /**
   * Find balances that need synchronization (stale data)
   */
  async findStaleBalances(hoursThreshold: number = 24): Promise<TimeOffBalance[]> {
    this.logger.debug(`Finding balances stale for more than ${hoursThreshold} hours`);

    const thresholdTime = new Date();
    thresholdTime.setHours(thresholdTime.getHours() - hoursThreshold);

    return await this.balanceRepository
      .createQueryBuilder('balance')
      .where('balance.lastSyncedAt IS NULL')
      .orWhere('balance.lastSyncedAt < :thresholdTime', { thresholdTime })
      .orderBy('balance.lastSyncedAt', 'ASC')
      .getMany();
  }

  /**
   * Get balance statistics for reporting
   */
  async getBalanceStatistics(locationId?: string): Promise<{
    totalEmployees: number;
    totalBalances: number;
    averageAvailableDays: number;
    totalUsedDays: number;
    totalAvailableDays: number;
    balancesByType: Record<BalanceType, {
      count: number;
      totalAvailable: number;
      totalUsed: number;
      averageAvailable: number;
    }>;
  }> {
    this.logger.debug(`Getting balance statistics${locationId ? ` for location ${locationId}` : ''}`);

    const whereCondition: FindOptionsWhere<TimeOffBalance> = {};
    if (locationId) {
      whereCondition.locationId = locationId;
    }

    const [totalBalances, balances] = await Promise.all([
      this.balanceRepository.count({ where: whereCondition }),
      this.balanceRepository.find({ where: whereCondition }),
    ]);

    const uniqueEmployees = new Set(balances.map(b => b.employeeId)).size;
    const totalUsedDays = balances.reduce((sum, b) => sum + b.usedDays, 0);
    const totalAvailableDays = balances.reduce((sum, b) => sum + b.availableDays, 0);
    const averageAvailableDays = totalBalances > 0 ? totalAvailableDays / totalBalances : 0;

    // Group by balance type
    const balancesByType = balances.reduce((acc, balance) => {
      if (!acc[balance.balanceType]) {
        acc[balance.balanceType] = {
          count: 0,
          totalAvailable: 0,
          totalUsed: 0,
          averageAvailable: 0,
        };
      }
      acc[balance.balanceType].count++;
      acc[balance.balanceType].totalAvailable += balance.availableDays;
      acc[balance.balanceType].totalUsed += balance.usedDays;
      return acc;
    }, {} as Record<BalanceType, any>);

    // Calculate averages for each type
    Object.keys(balancesByType).forEach(type => {
      const typeData = balancesByType[type as BalanceType];
      typeData.averageAvailable = typeData.count > 0 ? typeData.totalAvailable / typeData.count : 0;
    });

    return {
      totalEmployees: uniqueEmployees,
      totalBalances,
      averageAvailableDays,
      totalUsedDays,
      totalAvailableDays,
      balancesByType,
    };
  }

  /**
   * Find employees with low balance (threshold warning)
   */
  async findEmployeesWithLowBalance(
    thresholdDays: number = 5,
    balanceType: BalanceType = BalanceType.ANNUAL,
  ): Promise<TimeOffBalance[]> {
    this.logger.debug(
      `Finding employees with low balance (< ${thresholdDays} days) for type ${balanceType}`,
    );

    return await this.balanceRepository.find({
      where: {
        balanceType,
        availableDays: thresholdDays,
      },
      order: { availableDays: 'ASC' },
    });
  }

  /**
   * Batch update multiple balances
   */
  async batchUpdate(
    updates: Array<{
      employeeId: string;
      locationId: string;
      balanceType: BalanceType;
      updateData: Partial<TimeOffBalance>;
    }>,
  ): Promise<TimeOffBalance[]> {
    this.logger.debug(`Batch updating ${updates.length} balances`);

    const results: TimeOffBalance[] = [];

    for (const update of updates) {
      try {
        const updatedBalance = await this.update(
          update.employeeId,
          update.locationId,
          update.balanceType,
          update.updateData,
        );
        results.push(updatedBalance);
      } catch (error) {
        this.logger.error(
          `Failed to update balance for employee ${update.employeeId}, type ${update.balanceType}: ${error.message}`,
        );
        // Continue with other updates even if one fails
      }
    }

    return results;
  }

  /**
   * Delete a balance record (soft delete by updating status or hard delete)
   */
  async delete(
    employeeId: string,
    locationId: string,
    balanceType: BalanceType,
  ): Promise<void> {
    this.logger.debug(
      `Deleting balance for employee ${employeeId}, type ${balanceType}`,
    );

    await this.balanceRepository.delete({
      employeeId,
      locationId,
      balanceType,
    });
  }

  /**
   * Check if balance exists for employee
   */
  async exists(
    employeeId: string,
    locationId: string,
    balanceType: BalanceType,
  ): Promise<boolean> {
    this.logger.debug(
      `Checking if balance exists for employee ${employeeId}, type ${balanceType}`,
    );

    const count = await this.balanceRepository.count({
      where: { employeeId, locationId, balanceType },
    });

    return count > 0;
  }

  /**
   * Get balances that haven't been synced recently
   */
  async getUnsyncedBalances(hoursThreshold: number = 1): Promise<TimeOffBalance[]> {
    this.logger.debug(`Getting balances not synced in last ${hoursThreshold} hours`);

    const thresholdTime = new Date();
    thresholdTime.setHours(thresholdTime.getHours() - hoursThreshold);

    return await this.balanceRepository
      .createQueryBuilder('balance')
      .where('balance.lastSyncedAt IS NULL')
      .orWhere('balance.lastSyncedAt < :thresholdTime', { thresholdTime })
      .orderBy('balance.lastSyncedAt', 'ASC')
      .getMany();
  }
}
