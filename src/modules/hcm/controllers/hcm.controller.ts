import { Controller, Get, Post, Put, Delete, Body, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { HCMIntegrationService } from '../services/hcm-integration.service';

@ApiTags('hcm')
@Controller('api/hcm')
export class HCMController {
  constructor(private readonly hcmService: HCMIntegrationService) {}

  @Get('health')
  @ApiOperation({ summary: 'Check HCM system health' })
  @ApiResponse({ status: 200, description: 'HCM health status retrieved' })
  async getHealth() {
    return await this.hcmService.checkHealth();
  }

  @Get('configuration')
  @ApiOperation({ summary: 'Get HCM system configuration' })
  @ApiResponse({ status: 200, description: 'HCM configuration retrieved' })
  async getConfiguration() {
    return await this.hcmService.getConfiguration();
  }

  @Get('balances/:employeeId/:locationId/:balanceType')
  @ApiOperation({ summary: 'Get employee balance from HCM' })
  @ApiResponse({ status: 200, description: 'Balance retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Balance not found' })
  @ApiParam({ name: 'employeeId', description: 'Employee ID' })
  @ApiParam({ name: 'locationId', description: 'Location ID' })
  @ApiParam({ name: 'balanceType', description: 'Balance type' })
  async getBalance(
    @Param('employeeId') employeeId: string,
    @Param('locationId') locationId: string,
    @Param('balanceType') balanceType: string,
  ) {
    return await this.hcmService.getBalance(employeeId, locationId, balanceType as any);
  }

  @Post('balances/validate')
  @ApiOperation({ summary: 'Validate balance with HCM' })
  @ApiResponse({ status: 200, description: 'Balance validation completed' })
  @ApiResponse({ status: 400, description: 'Invalid validation request' })
  async validateBalance(@Body() body: {
    employeeId: string;
    locationId: string;
    balanceType: string;
    daysRequested: number;
  }) {
    return await this.hcmService.validateBalance(
      body.employeeId,
      body.locationId,
      body.balanceType as any,
      body.daysRequested,
    );
  }

  @Put('balances/:employeeId/:locationId/:balanceType')
  @ApiOperation({ summary: 'Update balance in HCM' })
  @ApiResponse({ status: 200, description: 'Balance updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid update request' })
  @ApiParam({ name: 'employeeId', description: 'Employee ID' })
  @ApiParam({ name: 'locationId', description: 'Location ID' })
  @ApiParam({ name: 'balanceType', description: 'Balance type' })
  async updateBalance(
    @Param('employeeId') employeeId: string,
    @Param('locationId') locationId: string,
    @Param('balanceType') balanceType: string,
    @Body() body: {
      usedDays: number;
      availableDays: number;
    },
  ) {
    return await this.hcmService.updateBalance(
      employeeId,
      locationId,
      balanceType as any,
      body.usedDays,
      body.availableDays,
    );
  }

  @Post('requests')
  @ApiOperation({ summary: 'Submit request to HCM' })
  @ApiResponse({ status: 200, description: 'Request submitted successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  async submitRequest(@Body() requestData: any) {
    return await this.hcmService.submitRequest(requestData);
  }

  @Delete('requests/:requestId')
  @ApiOperation({ summary: 'Cancel request in HCM' })
  @ApiResponse({ status: 200, description: 'Request cancelled successfully' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  @ApiParam({ name: 'requestId', description: 'Request ID' })
  async cancelRequest(@Param('requestId') requestId: string, @Body() body?: any) {
    return await this.hcmService.cancelRequest({ id: requestId, ...body });
  }

  @Post('balances/batch')
  @ApiOperation({ summary: 'Batch sync balances from HCM' })
  @ApiResponse({ status: 200, description: 'Batch sync completed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid batch request' })
  async batchSync(@Body() body: { employeeIds: string[] }) {
    return await this.hcmService.batchSync(body.employeeIds);
  }

  @Post('simulate/balance-change')
  @ApiOperation({ summary: 'Simulate independent balance change (e.g., work anniversary)' })
  @ApiResponse({ status: 200, description: 'Balance change simulated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid simulation request' })
  async simulateBalanceChange(@Body() body: {
    employeeId: string;
    locationId: string;
    balanceType: string;
    bonusDays?: number;
  }) {
    return await this.hcmService.simulateBalanceChange(
      body.employeeId,
      body.locationId,
      body.balanceType as any,
      body.bonusDays,
    );
  }
}
