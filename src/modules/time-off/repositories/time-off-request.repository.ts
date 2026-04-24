import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual, FindOptionsWhere } from 'typeorm';
import { TimeOffRequest, RequestStatus, BalanceType } from '../entities/time-off-request.entity';

@Injectable()
export class TimeOffRequestRepository {
  private readonly logger = new Logger(TimeOffRequestRepository.name);

  constructor(
    @InjectRepository(TimeOffRequest)
    private readonly requestRepository: Repository<TimeOffRequest>,
  ) {}

  /**
   * Find request by ID
   */
  async findById(id: string): Promise<TimeOffRequest | null> {
    this.logger.debug(`Finding request by ID: ${id}`);

    return await this.requestRepository.findOne({
      where: { id },
      relations: ['employee', 'location'],
    });
  }

  /**
   * Find requests by employee
   */
  async findByEmployee(
    employeeId: string,
    status?: RequestStatus,
    limit: number = 50,
  ): Promise<TimeOffRequest[]> {
    this.logger.debug(
      `Finding requests for employee ${employeeId}${status ? `, status ${status}` : ''}`,
    );

    const whereCondition: FindOptionsWhere<TimeOffRequest> = { employeeId };
    if (status) {
      whereCondition.status = status;
    }

    return await this.requestRepository.find({
      where: whereCondition,
      order: { requestedAt: 'DESC' },
      take: limit,
      relations: ['employee', 'location'],
    });
  }

  /**
   * Find pending requests that need approval
   */
  async findPendingRequests(locationId?: string): Promise<TimeOffRequest[]> {
    this.logger.debug(
      `Finding pending requests${locationId ? ` for location ${locationId}` : ''}`,
    );

    const whereCondition: FindOptionsWhere<TimeOffRequest> = { status: RequestStatus.PENDING };
    if (locationId) {
      whereCondition.locationId = locationId;
    }

    return await this.requestRepository.find({
      where: whereCondition,
      order: { requestedAt: 'ASC' },
      relations: ['employee', 'location'],
    });
  }

  /**
   * Find overlapping requests for validation
   */
  async findOverlappingRequests(
    employeeId: string,
    startDate: Date,
    endDate: Date,
    excludeRequestId?: string,
  ): Promise<TimeOffRequest[]> {
    this.logger.debug(
      `Finding overlapping requests for employee ${employeeId} from ${startDate} to ${endDate}`,
    );

    return await this.requestRepository
      .createQueryBuilder('request')
      .where('request.employeeId = :employeeId', { employeeId })
      .andWhere('request.status IN (:...statuses)', {
        statuses: [RequestStatus.PENDING, RequestStatus.APPROVED],
      })
      .andWhere(
        '(request.startDate <= :endDate AND request.endDate >= :startDate)',
        { startDate, endDate },
      )
      .andWhere(excludeRequestId ? 'request.id != :excludeRequestId' : '1=1', {
        excludeRequestId,
      })
      .orderBy('request.startDate', 'ASC')
      .getMany();
  }

  /**
   * Find requests within a date range
   */
  async findByDateRange(
    startDate: Date,
    endDate: Date,
    locationId?: string,
    status?: RequestStatus,
  ): Promise<TimeOffRequest[]> {
    this.logger.debug(
      `Finding requests from ${startDate} to ${endDate}${locationId ? ` for location ${locationId}` : ''}`,
    );

    const whereCondition: any = {
      startDate: LessThanOrEqual(endDate),
      endDate: MoreThanOrEqual(startDate),
    };

    if (locationId) {
      whereCondition.locationId = locationId;
    }
    if (status) {
      whereCondition.status = status;
    }

    return await this.requestRepository.find({
      where: whereCondition,
      order: { startDate: 'ASC' },
      relations: ['employee', 'location'],
    });
  }

  /**
   * Create a new request
   */
  async create(requestData: Partial<TimeOffRequest>): Promise<TimeOffRequest> {
    this.logger.debug(
      `Creating request for employee ${requestData.employeeId}, ${requestData.daysRequested} days`,
    );

    const request = this.requestRepository.create(requestData);
    return await this.requestRepository.save(request);
  }

  /**
   * Update an existing request
   */
  async update(id: string, updateData: Partial<TimeOffRequest>): Promise<TimeOffRequest> {
    this.logger.debug(`Updating request ${id}`);

    await this.requestRepository.update(id, updateData);

    const updatedRequest = await this.findById(id);
    if (!updatedRequest) {
      throw new Error('Request not found after update');
    }

    return updatedRequest;
  }

  /**
   * Save a request (create or update)
   */
  async save(request: TimeOffRequest): Promise<TimeOffRequest> {
    this.logger.debug(`Saving request ${request.id}`);

    return await this.requestRepository.save(request);
  }

  /**
   * Find request with pessimistic lock for concurrent operations
   */
  async findWithLock(id: string): Promise<TimeOffRequest | null> {
    this.logger.debug(`Finding request with lock: ${id}`);

    return await this.requestRepository.findOne({
      where: { id },
      lock: { mode: 'pessimistic_write' },
      relations: ['employee', 'location'],
    });
  }

  /**
   * Get request statistics for reporting
   */
  async getRequestStatistics(
    locationId?: string,
    daysBack: number = 30,
  ): Promise<{
    totalRequests: number;
    pendingRequests: number;
    approvedRequests: number;
    rejectedRequests: number;
    cancelledRequests: number;
    averageDaysRequested: number;
    totalDaysRequested: number;
    requestsByStatus: Record<RequestStatus, number>;
    requestsByType: Record<BalanceType, number>;
  }> {
    this.logger.debug(
      `Getting request statistics for last ${daysBack} days${locationId ? ` for location ${locationId}` : ''}`,
    );

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const whereCondition: any = {
      requestedAt: MoreThanOrEqual(startDate),
    };

    if (locationId) {
      whereCondition.locationId = locationId;
    }

    const [requests, statusCounts, typeCounts] = await Promise.all([
      this.requestRepository.find({
        where: whereCondition,
        relations: ['employee', 'location'],
      }),
      this.getRequestCountByField('status', whereCondition),
      this.getRequestCountByField('balanceType', whereCondition),
    ]);

    const totalRequests = requests.length;
    const pendingRequests = requests.filter(r => r.status === RequestStatus.PENDING).length;
    const approvedRequests = requests.filter(r => r.status === RequestStatus.APPROVED).length;
    const rejectedRequests = requests.filter(r => r.status === RequestStatus.REJECTED).length;
    const cancelledRequests = requests.filter(r => r.status === RequestStatus.CANCELLED).length;

    const totalDaysRequested = requests.reduce((sum, r) => sum + r.daysRequested, 0);
    const averageDaysRequested = totalRequests > 0 ? totalDaysRequested / totalRequests : 0;

    return {
      totalRequests,
      pendingRequests,
      approvedRequests,
      rejectedRequests,
      cancelledRequests,
      averageDaysRequested,
      totalDaysRequested,
      requestsByStatus: statusCounts as Record<RequestStatus, number>,
      requestsByType: typeCounts as Record<BalanceType, number>,
    };
  }

  /**
   * Find requests approaching their start date (for notifications)
   */
  async findUpcomingRequests(daysAhead: number = 7): Promise<TimeOffRequest[]> {
    this.logger.debug(`Finding requests starting in next ${daysAhead} days`);

    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + daysAhead);

    return await this.requestRepository.find({
      where: {
        status: RequestStatus.APPROVED,
        startDate: Between(today, futureDate),
      },
      order: { startDate: 'ASC' },
      relations: ['employee', 'location'],
    });
  }

  /**
   * Find requests that need manager attention (old pending requests)
   */
  async findStalePendingRequests(daysThreshold: number = 3): Promise<TimeOffRequest[]> {
    this.logger.debug(`Finding pending requests older than ${daysThreshold} days`);

    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - daysThreshold);

    return await this.requestRepository.find({
      where: {
        status: RequestStatus.PENDING,
        requestedAt: LessThanOrEqual(thresholdDate),
      },
      order: { requestedAt: 'ASC' },
      relations: ['employee', 'location'],
    });
  }

  /**
   * Delete a request
   */
  async delete(id: string): Promise<void> {
    this.logger.debug(`Deleting request ${id}`);

    await this.requestRepository.delete(id);
  }

  /**
   * Check if request exists
   */
  async exists(id: string): Promise<boolean> {
    this.logger.debug(`Checking if request exists: ${id}`);

    const count = await this.requestRepository.count({ where: { id } });
    return count > 0;
  }

  /**
   * Get requests by balance type
   */
  async findByBalanceType(
    balanceType: BalanceType,
    status?: RequestStatus,
    limit: number = 50,
  ): Promise<TimeOffRequest[]> {
    this.logger.debug(
      `Finding requests for balance type ${balanceType}${status ? `, status ${status}` : ''}`,
    );

    const whereCondition: FindOptionsWhere<TimeOffRequest> = { balanceType };
    if (status) {
      whereCondition.status = status;
    }

    return await this.requestRepository.find({
      where: whereCondition,
      order: { requestedAt: 'DESC' },
      take: limit,
      relations: ['employee', 'location'],
    });
  }

  /**
   * Helper method to get request counts grouped by a specific field
   */
  private async getRequestCountByField(
    field: 'status' | 'balanceType',
    whereCondition: any,
  ): Promise<Record<string, number>> {
    const result = await this.requestRepository
      .createQueryBuilder('request')
      .select(`request.${field}`, 'field')
      .addSelect('COUNT(*)', 'count')
      .where(whereCondition)
      .groupBy(`request.${field}`)
      .getRawMany();

    return result.reduce((acc, item) => {
      acc[item.field] = parseInt(item.count);
      return acc;
    }, {});
  }

  /**
   * Batch update multiple requests
   */
  async batchUpdate(
    updates: Array<{
      id: string;
      updateData: Partial<TimeOffRequest>;
    }>,
  ): Promise<TimeOffRequest[]> {
    this.logger.debug(`Batch updating ${updates.length} requests`);

    const results: TimeOffRequest[] = [];

    for (const update of updates) {
      try {
        const updatedRequest = await this.update(update.id, update.updateData);
        results.push(updatedRequest);
      } catch (error) {
        this.logger.error(
          `Failed to update request ${update.id}: ${error.message}`,
        );
        // Continue with other updates even if one fails
      }
    }

    return results;
  }
}
