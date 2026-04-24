import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee } from './entities/employee.entity';
import { Location } from './entities/location.entity';
import { TimeOffBalance } from './entities/time-off-balance.entity';
import { TimeOffRequest } from './entities/time-off-request.entity';
import { BalanceSyncLog } from './entities/balance-sync-log.entity';
import { TimeOffController } from './controllers/time-off.controller';
import { TimeOffBalanceService } from './services/time-off-balance.service';
import { TimeOffRequestService } from './services/time-off-request.service';
import { BalanceSyncService } from './services/balance-sync.service';
import { TimeOffBalanceRepository } from './repositories/time-off-balance.repository';
import { TimeOffRequestRepository } from './repositories/time-off-request.repository';
import { HCMIntegrationModule } from '../hcm/hcm.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Employee,
      Location,
      TimeOffBalance,
      TimeOffRequest,
      BalanceSyncLog,
    ]),
    HCMIntegrationModule,
    NotificationModule,
  ],
  controllers: [TimeOffController],
  providers: [
    TimeOffBalanceService,
    TimeOffRequestService,
    BalanceSyncService,
    TimeOffBalanceRepository,
    TimeOffRequestRepository,
  ],
  exports: [
    TimeOffBalanceService,
    TimeOffRequestService,
    BalanceSyncService,
  ],
})
export class TimeOffModule {}
