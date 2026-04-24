import { Injectable, Logger } from '@nestjs/common';
import { TimeOffRequest } from '../../time-off/entities/time-off-request.entity';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  /**
   * Send notification when a new request is created
   */
  async sendRequestCreated(request: TimeOffRequest): Promise<void> {
    this.logger.debug(`Sending request created notification for request ${request.id}`);

    // In a real implementation, this would send email, push notification, etc.
    // For now, we'll just log the notification
    
    const notificationData = {
      type: 'REQUEST_CREATED',
      requestId: request.id,
      employeeId: request.employeeId,
      locationId: request.locationId,
      balanceType: request.balanceType,
      startDate: request.startDate,
      endDate: request.endDate,
      daysRequested: request.daysRequested,
      requestedAt: request.requestedAt,
      comments: request.comments,
    };

    this.logger.log(`Request created notification sent: ${JSON.stringify(notificationData)}`);
  }

  /**
   * Send notification when a request is approved
   */
  async sendRequestApproved(request: TimeOffRequest): Promise<void> {
    this.logger.debug(`Sending request approved notification for request ${request.id}`);

    const notificationData = {
      type: 'REQUEST_APPROVED',
      requestId: request.id,
      employeeId: request.employeeId,
      locationId: request.locationId,
      balanceType: request.balanceType,
      startDate: request.startDate,
      endDate: request.endDate,
      daysRequested: request.daysRequested,
      reviewedAt: request.reviewedAt,
      reviewedBy: request.reviewedBy,
      comments: request.comments,
    };

    this.logger.log(`Request approved notification sent: ${JSON.stringify(notificationData)}`);
  }

  /**
   * Send notification when a request is rejected
   */
  async sendRequestRejected(request: TimeOffRequest): Promise<void> {
    this.logger.debug(`Sending request rejected notification for request ${request.id}`);

    const notificationData = {
      type: 'REQUEST_REJECTED',
      requestId: request.id,
      employeeId: request.employeeId,
      locationId: request.locationId,
      balanceType: request.balanceType,
      startDate: request.startDate,
      endDate: request.endDate,
      daysRequested: request.daysRequested,
      reviewedAt: request.reviewedAt,
      reviewedBy: request.reviewedBy,
      comments: request.comments,
    };

    this.logger.log(`Request rejected notification sent: ${JSON.stringify(notificationData)}`);
  }

  /**
   * Send notification when a request is cancelled
   */
  async sendRequestCancelled(request: TimeOffRequest): Promise<void> {
    this.logger.debug(`Sending request cancelled notification for request ${request.id}`);

    const notificationData = {
      type: 'REQUEST_CANCELLED',
      requestId: request.id,
      employeeId: request.employeeId,
      locationId: request.locationId,
      balanceType: request.balanceType,
      startDate: request.startDate,
      endDate: request.endDate,
      daysRequested: request.daysRequested,
      status: request.status,
      comments: request.comments,
    };

    this.logger.log(`Request cancelled notification sent: ${JSON.stringify(notificationData)}`);
  }

  /**
   * Send reminder notification for upcoming requests
   */
  async sendUpcomingRequestReminder(request: TimeOffRequest): Promise<void> {
    this.logger.debug(`Sending upcoming request reminder for request ${request.id}`);

    const notificationData = {
      type: 'UPCOMING_REQUEST_REMINDER',
      requestId: request.id,
      employeeId: request.employeeId,
      locationId: request.locationId,
      balanceType: request.balanceType,
      startDate: request.startDate,
      endDate: request.endDate,
      daysRequested: request.daysRequested,
    };

    this.logger.log(`Upcoming request reminder sent: ${JSON.stringify(notificationData)}`);
  }

  /**
   * Send notification for low balance warning
   */
  async sendLowBalanceWarning(
    employeeId: string,
    locationId: string,
    balanceType: string,
    availableDays: number,
  ): Promise<void> {
    this.logger.debug(
      `Sending low balance warning for employee ${employeeId}, type ${balanceType}`,
    );

    const notificationData = {
      type: 'LOW_BALANCE_WARNING',
      employeeId,
      locationId,
      balanceType,
      availableDays,
    };

    this.logger.log(`Low balance warning sent: ${JSON.stringify(notificationData)}`);
  }

  /**
   * Send notification for manager action required
   */
  async sendManagerActionRequired(
    managerId: string,
    pendingRequestsCount: number,
    locationId?: string,
  ): Promise<void> {
    this.logger.debug(
      `Sending manager action required notification to ${managerId}, ${pendingRequestsCount} pending requests`,
    );

    const notificationData = {
      type: 'MANAGER_ACTION_REQUIRED',
      managerId,
      pendingRequestsCount,
      locationId,
    };

    this.logger.log(`Manager action required notification sent: ${JSON.stringify(notificationData)}`);
  }

  /**
   * Send notification for sync failure
   */
  async sendSyncFailureNotification(
    employeeId: string,
    locationId: string,
    balanceType: string,
    errorMessage: string,
  ): Promise<void> {
    this.logger.debug(
      `Sending sync failure notification for employee ${employeeId}, type ${balanceType}`,
    );

    const notificationData = {
      type: 'SYNC_FAILURE',
      employeeId,
      locationId,
      balanceType,
      errorMessage,
    };

    this.logger.log(`Sync failure notification sent: ${JSON.stringify(notificationData)}`);
  }

  /**
   * Send batch notification for multiple recipients
   */
  async sendBatchNotification(
    notifications: Array<{
      type: string;
      recipientId: string;
      data: any;
    }>,
  ): Promise<void> {
    this.logger.debug(`Sending batch notification with ${notifications.length} items`);

    for (const notification of notifications) {
      try {
        // In a real implementation, this would queue notifications or send them in parallel
        this.logger.log(
          `Batch notification sent: ${notification.type} to ${notification.recipientId}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to send batch notification ${notification.type} to ${notification.recipientId}: ${error.message}`,
        );
      }
    }
  }

  /**
   * Get notification preferences for a user
   */
  async getNotificationPreferences(userId: string): Promise<{
    email: boolean;
    push: boolean;
    sms: boolean;
    requestCreated: boolean;
    requestApproved: boolean;
    requestRejected: boolean;
    upcomingReminder: boolean;
    lowBalanceWarning: boolean;
  }> {
    // In a real implementation, this would fetch from database
    return {
      email: true,
      push: true,
      sms: false,
      requestCreated: true,
      requestApproved: true,
      requestRejected: true,
      upcomingReminder: true,
      lowBalanceWarning: true,
    };
  }

  /**
   * Update notification preferences for a user
   */
  async updateNotificationPreferences(
    userId: string,
    preferences: Partial<{
      email: boolean;
      push: boolean;
      sms: boolean;
      requestCreated: boolean;
      requestApproved: boolean;
      requestRejected: boolean;
      upcomingReminder: boolean;
      lowBalanceWarning: boolean;
    }>,
  ): Promise<void> {
    this.logger.debug(`Updating notification preferences for user ${userId}`);

    // In a real implementation, this would update in database
    this.logger.log(`Notification preferences updated for user ${userId}: ${JSON.stringify(preferences)}`);
  }
}
