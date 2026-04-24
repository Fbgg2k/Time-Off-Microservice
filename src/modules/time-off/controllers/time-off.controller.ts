import {
  Controller,
  Get,
  Post,
  Put,
  Query,
  Param,
  Body,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { TimeOffRequestService } from '../services/time-off-request.service';
import { TimeOffBalanceService } from '../services/time-off-balance.service';
import { BalanceSyncService } from '../services/balance-sync.service';
import { CreateTimeOffRequestDto } from '../dto/create-time-off-request.dto';
import { ApproveRequestDto } from '../dto/approve-request.dto';
import { RejectRequestDto } from '../dto/reject-request.dto';
import { CancelRequestDto } from '../dto/cancel-request.dto';
import { BalanceType } from '../entities/time-off-balance.entity';
import { RequestStatus } from '../entities/time-off-request.entity';

@ApiTags('time-off')
@Controller('api/time-off')
export class TimeOffController {
  constructor(
    private readonly requestService: TimeOffRequestService,
    private readonly balanceService: TimeOffBalanceService,
    private readonly syncService: BalanceSyncService,
  ) {}

  @Get('balances')
  @ApiOperation({ summary: 'Get employee time-off balances' })
  @ApiResponse({ status: 200, description: 'Balances retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  @ApiQuery({ name: 'employeeId', required: true, description: 'Employee ID' })
  @ApiQuery({ name: 'locationId', required: true, description: 'Location ID' })
  @ApiQuery({ name: 'balanceType', required: false, description: 'Balance type filter' })
  async getBalances(
    @Query('employeeId') employeeId: string,
    @Query('locationId') locationId: string,
    @Query('balanceType') balanceType?: BalanceType,
  ) {
    if (balanceType) {
      const availableBalance = await this.balanceService.getAvailableBalance(
        employeeId,
        locationId,
        balanceType,
      );
      return [{ balanceType, availableBalance }];
    } else {
      const allBalances = await this.balanceService.getAllEmployeeBalances(employeeId);
      return allBalances.filter(balance => balance.locationId === locationId);
    }
  }

  @Get('balances/history')
  @ApiOperation({ summary: 'Get balance synchronization history' })
  @ApiResponse({ status: 200, description: 'Balance history retrieved successfully' })
  @ApiQuery({ name: 'employeeId', required: true, description: 'Employee ID' })
  @ApiQuery({ name: 'locationId', required: true, description: 'Location ID' })
  @ApiQuery({ name: 'balanceType', required: true, description: 'Balance type' })
  async getBalanceHistory(
    @Query('employeeId') employeeId: string,
    @Query('locationId') locationId: string,
    @Query('balanceType') balanceType: string,
  ) {
    return await this.syncService.getBalanceHistory(employeeId, locationId, balanceType);
  }

  @Post('requests')
  @ApiOperation({ summary: 'Create a new time-off request' })
  @ApiResponse({ status: 201, description: 'Request created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data or insufficient balance' })
  async createRequest(@Body() createRequestDto: CreateTimeOffRequestDto) {
    const request = await this.requestService.createRequest({
      ...createRequestDto,
      startDate: new Date(createRequestDto.startDate),
      endDate: new Date(createRequestDto.endDate),
    });

    return request;
  }

  @Get('requests')
  @ApiOperation({ summary: 'Get time-off requests' })
  @ApiResponse({ status: 200, description: 'Requests retrieved successfully' })
  @ApiQuery({ name: 'employeeId', required: false, description: 'Filter by employee ID' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Filter by start date' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Filter by end date' })
  @ApiQuery({ name: 'locationId', required: false, description: 'Filter by location ID' })
  async getRequests(
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: RequestStatus,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('locationId') locationId?: string,
  ) {
    if (employeeId) {
      return await this.requestService.getRequestHistory(employeeId, status);
    } else if (startDate && endDate) {
      return await this.requestService.getRequestsByDateRange(
        new Date(startDate),
        new Date(endDate),
        locationId,
        status,
      );
    } else if (status === RequestStatus.PENDING) {
      return await this.requestService.getPendingRequests(locationId);
    } else {
      // Return all requests (with pagination in a real implementation)
      return [];
    }
  }

  @Get('requests/:id')
  @ApiOperation({ summary: 'Get a specific time-off request' })
  @ApiResponse({ status: 200, description: 'Request retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  @ApiParam({ name: 'id', description: 'Request ID' })
  async getRequestById(@Param('id') id: string) {
    return await this.requestService.getRequestById(id);
  }

  @Put('requests/:id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a time-off request' })
  @ApiResponse({ status: 200, description: 'Request approved successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data or insufficient balance' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  @ApiParam({ name: 'id', description: 'Request ID' })
  async approveRequest(
    @Param('id') id: string,
    @Body() approveDto: ApproveRequestDto,
  ) {
    return await this.requestService.approveRequest(id, approveDto);
  }

  @Put('requests/:id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a time-off request' })
  @ApiResponse({ status: 200, description: 'Request rejected successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  @ApiParam({ name: 'id', description: 'Request ID' })
  async rejectRequest(
    @Param('id') id: string,
    @Body() rejectDto: RejectRequestDto,
  ) {
    return await this.requestService.rejectRequest(id, rejectDto);
  }

  @Put('requests/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a time-off request' })
  @ApiResponse({ status: 200, description: 'Request cancelled successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  @ApiParam({ name: 'id', description: 'Request ID' })
  async cancelRequest(
    @Param('id') id: string,
    @Body() cancelDto: CancelRequestDto,
  ) {
    return await this.requestService.cancelRequest(id, cancelDto);
  }

  @Post('balances/sync/:employeeId')
  @ApiOperation({ summary: 'Sync individual employee balance with HCM' })
  @ApiResponse({ status: 200, description: 'Balance synced successfully' })
  @ApiResponse({ status: 500, description: 'Sync failed' })
  @ApiParam({ name: 'employeeId', description: 'Employee ID' })
  async syncEmployeeBalance(@Param('employeeId') employeeId: string) {
    // This would sync all balance types for the employee
    const balanceTypes = [BalanceType.ANNUAL, BalanceType.SICK, BalanceType.PERSONAL];
    const results: any[] = [];

    for (const balanceType of balanceTypes) {
      try {
        const syncedBalance = await this.balanceService.syncEmployeeBalance(
          employeeId,
          'loc-001', // This would come from request body or query param
          balanceType,
        );
        results.push({ balanceType, success: true, balance: syncedBalance });
      } catch (error) {
        results.push({ balanceType, success: false, error: error.message });
      }
    }

    return {
      success: results.every(r => r.success),
      syncedAt: new Date(),
      results,
    };
  }

  @Post('balances/sync/batch')
  @ApiOperation({ summary: 'Batch sync multiple employee balances' })
  @ApiResponse({ status: 200, description: 'Batch sync completed successfully' })
  @ApiResponse({ status: 500, description: 'Batch sync failed' })
  async batchSyncBalances(@Body() body: { employeeIds: string[] }) {
    const { employeeIds } = body;
    const results: any[] = [];

    for (const employeeId of employeeIds) {
      try {
        await this.syncEmployeeBalance(employeeId);
        results.push({ employeeId, success: true });
      } catch (error) {
        results.push({ employeeId, success: false, error: error.message });
      }
    }

    return {
      success: true,
      processedEmployees: employeeIds.length,
      successfulSyncs: results.filter(r => r.success).length,
      failedSyncs: results.filter(r => !r.success).length,
      syncedAt: new Date(),
      results,
    };
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get time-off statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  @ApiQuery({ name: 'locationId', required: false, description: 'Filter by location ID' })
  @ApiQuery({ name: 'daysBack', required: false, description: 'Number of days to look back' })
  async getStatistics(
    @Query('locationId') locationId?: string,
    @Query('daysBack') daysBack?: number,
  ) {
    const requestStats = await this.requestService.getRequestStatistics(locationId, daysBack || 30);

    return {
      requests: requestStats,
      balances: null, // Would be implemented with balance statistics
      generatedAt: new Date(),
    };
  }

  @Get('pending-requests')
  @ApiOperation({ summary: 'Get pending requests for managers' })
  @ApiResponse({ status: 200, description: 'Pending requests retrieved successfully' })
  @ApiQuery({ name: 'locationId', required: false, description: 'Filter by location ID' })
  async getPendingRequests(@Query('locationId') locationId?: string) {
    return await this.requestService.getPendingRequests(locationId);
  }

  @Get('upcoming-requests')
  @ApiOperation({ summary: 'Get upcoming approved requests' })
  @ApiResponse({ status: 200, description: 'Upcoming requests retrieved successfully' })
  @ApiQuery({ name: 'daysAhead', required: false, description: 'Days ahead to look' })
  async getUpcomingRequests(@Query('daysAhead') daysAhead?: number) {
    return await this.requestService.getUpcomingRequests(daysAhead || 7);
  }

  @Get('stale-requests')
  @ApiOperation({ summary: 'Get stale pending requests needing attention' })
  @ApiResponse({ status: 200, description: 'Stale requests retrieved successfully' })
  @ApiQuery({ name: 'daysThreshold', required: false, description: 'Days threshold' })
  async getStaleRequests(@Query('daysThreshold') daysThreshold?: number) {
    return await this.requestService.getStalePendingRequests(daysThreshold || 3);
  }
}
