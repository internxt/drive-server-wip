import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthTokenGuard } from './health.guard';
import { HealthService } from './health.service';
import { CacheManagerModule } from '../../modules/cache-manager/cache-manager.module';

@Module({
  imports: [CacheManagerModule],
  controllers: [HealthController],
  providers: [HealthTokenGuard, HealthService],
})
export class HealthModule {}
