import { Module } from '@nestjs/common';
import { HCMIntegrationService } from './services/hcm-integration.service';
import { HCMController } from './controllers/hcm.controller';

@Module({
  controllers: [HCMController],
  providers: [HCMIntegrationService],
  exports: [HCMIntegrationService],
})
export class HCMIntegrationModule {}
