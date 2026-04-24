import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { TimeOffRequestRepository } from '../repositories/time-off-request.repository';
import { TimeOffBalanceService } from './time-off-balance.service';
import { HCMIntegrationService } from '../../hcm/services/hcm-integration.service';
import { NotificationService } from '../../notification/services/notification.service';
import { TimeOffRequest, RequestStatus, BalanceType } from '../entities/time-off-request.entity';

@Injectable()
export class TimeOffRequestService {
  private readonly logger = new Logger(TimeOffRequestService.name);

  constructor(
    private readonly requestRepository: TimeOffRequestRepository,
    private readonly balanceService: TimeOffBalanceService,
    private readonly hcmService: HCMIntegrationService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Create a new time-off request
   */
  async createRequest(createRequestDto: {
    employeeId: string;
    locationId: string;
    balanceType: BalanceType;
    startDate: Date;
    endDate: Date;
    comments?: string;
  }): Promise<TimeOffRequest> {
    this.logger.debug(
      `Creating request for employee ${createRequestDto.employeeId} from ${createRequestDto.startDate} to ${createRequestDto.endDate}`,
    );

    // Calculate business days
    const daysRequested = this.calculateBusinessDays(createRequestDto.startDate, createRequestDto.endDate);

    if (daysRequested === 0) {
      throw new BadRequestException('Request must include at least one business day');
    }

    // Validate minimum notice period (1 day)
    const now = new Date();
    const minNoticeDate = new Date(now);
    minNoticeDate.setDate(minNoticeDate.getDate() + 1);
    if (createRequestDto.startDate < minNoticeDate) {
      throw new BadRequestException('Minimum notice period of 1 day required');
    }

    // Validate maximum consecutive days (15 days)
    if (daysRequested > 15) {
      throw new BadRequestException('Maximum 15 consecutive days allowed');
    }

    // Validate date range
    if (createRequestDto.startDate > createRequestDto.endDate) {
      throw new BadRequestException('Start date must be before or equal to end date');
    }

    // Check for overlapping requests
    const overlappingRequests = await this.requestRepository.findOverlappingRequests(
      createRequestDto.employeeId,
      createRequestDto.startDate,
      createRequestDto.endDate,
    );

    if (overlappingRequests.length > 0) {
      throw new BadRequestException('Overlapping request exists for the specified period');
    }

    // Validate balance availability
    const balanceValidation = await this.balanceService.validateBalanceForRequest(
      createRequestDto.employeeId,
      createRequestDto.locationId,
      createRequestDto.balanceType,
      daysRequested,
    );

    if (!balanceValidation.valid) {
      throw new BadRequestException(
        `Insufficient balance. Available: ${balanceValidation.availableBalance}, Requested: ${daysRequested}`,
      );
    }

    // Create the request
    const request = await this.requestRepository.create({
      ...createRequestDto,
      daysRequested,
      status: RequestStatus.PENDING,
      requestedAt: new Date(),
    });

    // Send notification
    try {
      await this.notificationService.sendRequestCreated(request);
    } catch (notificationError) {
      this.logger.warn(
        `Failed to send request created notification: ${notificationError.message}`,
      );
      // Don't fail the operation if notification fails
    }

    return request;
  }

  /**
   * Approve a time-off request
   */
  async approveRequest(
    requestId: string,
    approveDto: {
      reviewedBy: string;
      comments?: string;
    },
  ): Promise<TimeOffRequest> {
    this.logger.debug(`Approving request ${requestId} by ${approveDto.reviewedBy}`);

    // Get request with lock
    const request = await this.requestRepository.findWithLock(requestId);

    if (!request) {
      throw new NotFoundException(`Request ${requestId} not found`);
    }

    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException(`Request ${requestId} is not in PENDING status`);
    }

    try {
      // Deduct balance
      const updatedBalance = await this.balanceService.deductBalance(
        request.employeeId,
        request.locationId,
        request.balanceType as any,
        request.daysRequested,
      );

      // Update request status
      const updatedRequest = await this.requestRepository.update(requestId, {
        status: RequestStatus.APPROVED,
        reviewedAt: new Date(),
        reviewedBy: approveDto.reviewedBy,
        comments: approveDto.comments,
      });

      // Submit to HCM
      try {
        await this.hcmService.submitRequest(updatedRequest);
      } catch (hcmError) {
        this.logger.error(
          `Failed to submit approved request ${requestId} to HCM: ${hcmError.message}`,
        );
        // Don't fail the approval if HCM submission fails
      }

      // Send notification
      try {
        await this.notificationService.sendRequestApproved(updatedRequest);
      } catch (notificationError) {
        this.logger.warn(
          `Failed to send request approved notification: ${notificationError.message}`,
        );
      }

      return updatedRequest;
    } catch (balanceError) {
      this.logger.error(
        `Failed to deduct balance for request ${requestId}: ${balanceError.message}`,
      );
      throw new BadRequestException(`Failed to approve request: ${balanceError.message}`);
    }
  }

  /**
   * Reject a time-off request
   */
  async rejectRequest(
    requestId: string,
    rejectDto: {
      reviewedBy: string;
      comments: string;
    },
  ): Promise<TimeOffRequest> {
    this.logger.debug(`Rejecting request ${requestId} by ${rejectDto.reviewedBy}`);

    // Get request
    const request = await this.requestRepository.findById(requestId);

    if (!request) {
      throw new NotFoundException(`Request ${requestId} not found`);
    }

    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException(`Request ${requestId} is not in PENDING status`);
    }

    if (!rejectDto.comments || rejectDto.comments.trim().length === 0) {
      throw new BadRequestException('Comments are required for rejection');
    }

    // Update request status
    const updatedRequest = await this.requestRepository.update(requestId, {
      status: RequestStatus.REJECTED,
      reviewedAt: new Date(),
      reviewedBy: rejectDto.reviewedBy,
      comments: rejectDto.comments,
    });

    // Send notification
    try {
      await this.notificationService.sendRequestRejected(updatedRequest);
    } catch (notificationError) {
      this.logger.warn(
        `Failed to send request rejected notification: ${notificationError.message}`,
      );
    }

    return updatedRequest;
  }

  /**
   * Cancel a time-off request
   */
  async cancelRequest(
    requestId: string,
    cancelDto: {
      comments?: string;
    },
  ): Promise<TimeOffRequest> {
    this.logger.debug(`Cancelling request ${requestId}`);

    // Get request with lock
    const request = await this.requestRepository.findWithLock(requestId);

    if (!request) {
      throw new NotFoundException(`Request ${requestId} not found`);
    }

    if (request.status === RequestStatus.CANCELLED) {
      throw new BadRequestException(`Request ${requestId} is already cancelled`);
    }

    const wasApproved = request.status === RequestStatus.APPROVED;

    try {
      // If request was approved, restore balance
      if (wasApproved) {
        await this.balanceService.restoreBalance(
          request.employeeId,
          request.locationId,
          request.balanceType as any,
          request.daysRequested,
        );

        // Cancel in HCM
        try {
          await this.hcmService.cancelRequest(request);
        } catch (hcmError) {
          this.logger.error(
            `Failed to cancel request ${requestId} in HCM: ${hcmError.message}`,
          );
          // Don't fail the cancellation if HCM cancellation fails
        }
      }

      // Update request status
      const updatedRequest = await this.requestRepository.update(requestId, {
        status: RequestStatus.CANCELLED,
        comments: cancelDto.comments,
      });

      // Send notification
      try {
        await this.notificationService.sendRequestCancelled(updatedRequest);
      } catch (notificationError) {
        this.logger.warn(
          `Failed to send request cancelled notification: ${notificationError.message}`,
        );
      }

      return updatedRequest;
    } catch (balanceError) {
      this.logger.error(
        `Failed to restore balance for request ${requestId}: ${balanceError.message}`,
      );
      throw new BadRequestException(`Failed to cancel request: ${balanceError.message}`);
    }
  }

  /**
   * Get request history for an employee
   */
  async getRequestHistory(
    employeeId: string,
    status?: RequestStatus,
  ): Promise<TimeOffRequest[]> {
    this.logger.debug(
      `Getting request history for employee ${employeeId}${status ? `, status ${status}` : ''}`,
    );

    return await this.requestRepository.findByEmployee(employeeId, status);
  }

  /**
   * Get request by ID
   */
  async getRequestById(requestId: string): Promise<TimeOffRequest> {
    this.logger.debug(`Getting request ${requestId}`);

    const request = await this.requestRepository.findById(requestId);

    if (!request) {
      throw new NotFoundException(`Request ${requestId} not found`);
    }

    return request;
  }

  /**
   * Get pending requests for managers
   */
  async getPendingRequests(locationId?: string): Promise<TimeOffRequest[]> {
    this.logger.debug(
      `Getting pending requests${locationId ? ` for location ${locationId}` : ''}`,
    );

    return await this.requestRepository.findPendingRequests(locationId);
  }

  /**
   * Calculate business days between two dates
   */
  private calculateBusinessDays(startDate: Date, endDate: Date): number {
    let businessDays = 0;
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday (0) or Saturday (6)
        businessDays++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return businessDays;
  }

  /**
   * Get requests by date range
   */
  async getRequestsByDateRange(
    startDate: Date,
    endDate: Date,
    locationId?: string,
    status?: RequestStatus,
  ): Promise<TimeOffRequest[]> {
    this.logger.debug(
      `Getting requests from ${startDate} to ${endDate}${locationId ? ` for location ${locationId}` : ''}`,
    );

    return await this.requestRepository.findByDateRange(startDate, endDate, locationId, status);
  }

  /**
   * Get upcoming approved requests (for notifications)
   */
  async getUpcomingRequests(daysAhead: number = 7): Promise<TimeOffRequest[]> {
    this.logger.debug(`Getting upcoming requests for next ${daysAhead} days`);

    return await this.requestRepository.findUpcomingRequests(daysAhead);
  }

  /**
   * Get stale pending requests (for escalation)
   */
  async getStalePendingRequests(daysThreshold: number = 3): Promise<TimeOffRequest[]> {
    this.logger.debug(`Getting stale pending requests older than ${daysThreshold} days`);

    return await this.requestRepository.findStalePendingRequests(daysThreshold);
  }

  /**
   * Get request statistics
   */
  async getRequestStatistics(
    locationId?: string,
    daysBack: number = 30,
  ): Promise<any> {
    this.logger.debug(
      `Getting request statistics for last ${daysBack} days${locationId ? ` for location ${locationId}` : ''}`,
    );

    return await this.requestRepository.getRequestStatistics(locationId, daysBack);
  }

  /**
   * Batch update requests
   */
  async batchUpdateRequests(
    updates: Array<{
      id: string;
      updateData: Partial<TimeOffRequest>;
    }>,
  ): Promise<TimeOffRequest[]> {
    this.logger.debug(`Batch updating ${updates.length} requests`);

    return await this.requestRepository.batchUpdate(updates);
  }
}
