import { Injectable, Logger } from '@nestjs/common';
import { BalanceType } from '../../time-off/entities/time-off-balance.entity';

export interface HCMBalanceResponse {
  employeeId: string;
  locationId: string;
  balanceType: string;
  totalDays: number;
  usedDays: number;
  availableDays: number;
  lastUpdated: Date;
}

export interface HCMValidationResponse {
  valid: boolean;
  availableBalance: number;
  message?: string;
  warnings?: string[];
}

export interface HCMRequestSubmission {
  success: boolean;
  requestId?: string;
  processedAt: Date;
  errors?: string[];
}

@Injectable()
export class HCMIntegrationService {
  private readonly logger = new Logger(HCMIntegrationService.name);
  private readonly hcmBaseUrl = process.env.HCM_BASE_URL || 'http://localhost:3001/hcm';

  /**
   * Get balance from HCM system
   */
  async getBalance(
    employeeId: string,
    locationId: string,
    balanceType: BalanceType,
  ): Promise<HCMBalanceResponse> {
    this.logger.debug(
      `Getting balance from HCM for employee ${employeeId}, type ${balanceType}`,
    );

    try {
      // In a real implementation, this would make an HTTP call to the HCM system
      // For now, we'll simulate the response based on our mock server behavior
      
      const response = await this.makeHCMCall('GET', `/balances/${employeeId}/${locationId}/${balanceType}`);
      
      return {
        employeeId,
        locationId,
        balanceType,
        totalDays: response.totalDays || 20,
        usedDays: response.usedDays || 0,
        availableDays: response.availableDays || 20,
        lastUpdated: new Date(response.lastUpdated || Date.now()),
      };
    } catch (error) {
      this.logger.error(
        `Failed to get balance from HCM for employee ${employeeId}: ${error.message}`,
      );
      throw new Error(`HCM balance retrieval failed: ${error.message}`);
    }
  }

  /**
   * Validate balance with HCM system
   */
  async validateBalance(
    employeeId: string,
    locationId: string,
    balanceType: BalanceType,
    daysRequested: number,
  ): Promise<HCMValidationResponse> {
    this.logger.debug(
      `Validating balance with HCM for ${daysRequested} days for employee ${employeeId}`,
    );

    try {
      const response = await this.makeHCMCall('POST', '/balances/validate', {
        employeeId,
        locationId,
        balanceType,
        daysRequested,
      });

      return {
        valid: response.valid || false,
        availableBalance: response.availableBalance || 0,
        message: response.message,
        warnings: response.warnings || [],
      };
    } catch (error) {
      this.logger.error(
        `Failed to validate balance with HCM for employee ${employeeId}: ${error.message}`,
      );
      throw new Error(`HCM balance validation failed: ${error.message}`);
    }
  }

  /**
   * Update balance in HCM system
   */
  async updateBalance(
    employeeId: string,
    locationId: string,
    balanceType: BalanceType,
    usedDays: number,
    availableDays: number,
  ): Promise<HCMRequestSubmission> {
    this.logger.debug(
      `Updating balance in HCM for employee ${employeeId}, used: ${usedDays}, available: ${availableDays}`,
    );

    try {
      const response = await this.makeHCMCall('PUT', `/balances/${employeeId}/${locationId}/${balanceType}`, {
        usedDays,
        availableDays,
        updatedAt: new Date(),
      });

      return {
        success: response.success || true,
        requestId: response.requestId,
        processedAt: new Date(response.processedAt || Date.now()),
        errors: response.errors,
      };
    } catch (error) {
      this.logger.error(
        `Failed to update balance in HCM for employee ${employeeId}: ${error.message}`,
      );
      throw new Error(`HCM balance update failed: ${error.message}`);
    }
  }

  /**
   * Submit approved request to HCM system
   */
  async submitRequest(requestData: any): Promise<HCMRequestSubmission> {
    this.logger.debug(`Submitting request ${requestData.id} to HCM`);

    try {
      const response = await this.makeHCMCall('POST', '/requests', requestData);

      return {
        success: response.success || true,
        requestId: response.requestId,
        processedAt: new Date(response.processedAt || Date.now()),
        errors: response.errors,
      };
    } catch (error) {
      this.logger.error(
        `Failed to submit request ${requestData.id} to HCM: ${error.message}`,
      );
      throw new Error(`HCM request submission failed: ${error.message}`);
    }
  }

  /**
   * Cancel request in HCM system
   */
  async cancelRequest(requestData: any): Promise<HCMRequestSubmission> {
    this.logger.debug(`Cancelling request ${requestData.id} in HCM`);

    try {
      const response = await this.makeHCMCall('DELETE', `/requests/${requestData.id}`, requestData);

      return {
        success: response.success || true,
        requestId: response.requestId,
        processedAt: new Date(response.processedAt || Date.now()),
        errors: response.errors,
      };
    } catch (error) {
      this.logger.error(
        `Failed to cancel request ${requestData.id} in HCM: ${error.message}`,
      );
      throw new Error(`HCM request cancellation failed: ${error.message}`);
    }
  }

  /**
   * Batch sync balances from HCM
   */
  async batchSync(employeeIds: string[]): Promise<HCMBalanceResponse[]> {
    this.logger.debug(`Batch syncing ${employeeIds.length} employees with HCM`);

    try {
      const response = await this.makeHCMCall('POST', '/balances/batch', { employeeIds });

      return response.map((item: any) => ({
        employeeId: item.employeeId,
        locationId: item.locationId,
        balanceType: item.balanceType,
        totalDays: item.totalDays,
        usedDays: item.usedDays,
        availableDays: item.availableDays,
        lastUpdated: new Date(item.lastUpdated),
      }));
    } catch (error) {
      this.logger.error(`Failed to batch sync with HCM: ${error.message}`);
      throw new Error(`HCM batch sync failed: ${error.message}`);
    }
  }

  /**
   * Check HCM system health
   */
  async checkHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    responseTime: number;
    lastCheck: Date;
  }> {
    const startTime = Date.now();

    try {
      await this.makeHCMCall('GET', '/health');
      
      const responseTime = Date.now() - startTime;
      
      return {
        status: responseTime < 1000 ? 'healthy' : 'degraded',
        responseTime,
        lastCheck: new Date(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
      };
    }
  }

  /**
   * Make HTTP call to HCM system
   * In a real implementation, this would use axios or fetch
   * For now, this is a placeholder that would connect to the mock server
   */
  private async makeHCMCall(
    method: string,
    endpoint: string,
    data?: any,
  ): Promise<any> {
    // This is a placeholder implementation
    // In a real scenario, you would use axios or http client to call the HCM API
    
    this.logger.debug(`HCM API call: ${method} ${this.hcmBaseUrl}${endpoint}`);

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Mock responses based on the endpoint
    if (endpoint.includes('/balances/') && method === 'GET') {
      return {
        totalDays: 20,
        usedDays: 5,
        availableDays: 15,
        lastUpdated: new Date().toISOString(),
      };
    }

    if (endpoint.includes('/validate') && method === 'POST') {
      return {
        valid: data?.daysRequested <= 15,
        availableBalance: 15,
        message: data?.daysRequested > 15 ? 'Insufficient balance' : undefined,
      };
    }

    if (endpoint.includes('/balances/') && method === 'PUT') {
      return {
        success: true,
        requestId: `hcm-${Date.now()}`,
        processedAt: new Date().toISOString(),
      };
    }

    if (endpoint === '/requests' && method === 'POST') {
      return {
        success: true,
        requestId: `hcm-req-${Date.now()}`,
        processedAt: new Date().toISOString(),
      };
    }

    if (endpoint.includes('/requests/') && method === 'DELETE') {
      return {
        success: true,
        requestId: `hcm-cancel-${Date.now()}`,
        processedAt: new Date().toISOString(),
      };
    }

    if (endpoint === '/balances/batch' && method === 'POST') {
      return data.employeeIds.map((id: string, index: number) => ({
        employeeId: id,
        locationId: 'loc-001',
        balanceType: 'ANNUAL',
        totalDays: 20,
        usedDays: index * 2,
        availableDays: 20 - (index * 2),
        lastUpdated: new Date().toISOString(),
      }));
    }

    if (endpoint === '/health' && method === 'GET') {
      return { status: 'healthy', timestamp: new Date().toISOString() };
    }

    throw new Error(`Unknown HCM endpoint: ${method} ${endpoint}`);
  }

  /**
   * Get HCM system configuration
   */
  async getConfiguration(): Promise<{
    supportedBalanceTypes: string[];
    maxDaysPerRequest: number;
    minNoticeDays: number;
    batchSyncLimit: number;
  }> {
    return {
      supportedBalanceTypes: ['ANNUAL', 'SICK', 'PERSONAL'],
      maxDaysPerRequest: 15,
      minNoticeDays: 1,
      batchSyncLimit: 100,
    };
  }

  /**
   * Simulate independent balance changes (e.g., work anniversary)
   */
  async simulateBalanceChange(
    employeeId: string,
    locationId: string,
    balanceType: BalanceType,
    bonusDays: number = 2,
  ): Promise<HCMBalanceResponse> {
    this.logger.debug(
      `Simulating balance change for employee ${employeeId}, bonus: ${bonusDays} days`,
    );

    // This would normally be triggered by an external event from HCM
    // For now, we'll simulate it by getting current balance and adding bonus
    
    const currentBalance = await this.getBalance(employeeId, locationId, balanceType);
    
    return {
      ...currentBalance,
      totalDays: currentBalance.totalDays + bonusDays,
      availableDays: currentBalance.availableDays + bonusDays,
      lastUpdated: new Date(),
    };
  }
}
