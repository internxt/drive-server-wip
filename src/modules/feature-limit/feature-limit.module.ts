import { Module, forwardRef } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { TierModel } from './models/tier.model';
import { Limitmodel } from './models/limit.model';
import { SequelizeFeatureLimitsRepository } from './feature-limit.repository';
import { LimitCheckService } from './limit-check.service';
import { FeatureLimit } from './feature-limits.guard';
import { TierLimitsModel } from './models/tier-limits.model';
import { SharingModule } from '../sharing/sharing.module';

@Module({
  imports: [
    SequelizeModule.forFeature([
      TierModel,
      Limitmodel,
      TierLimitsModel,
      TierLimitsModel,
    ]),
    forwardRef(() => SharingModule),
  ],
  providers: [
    SequelizeFeatureLimitsRepository,
    LimitCheckService,
    FeatureLimit,
  ],
  exports: [FeatureLimit, LimitCheckService],
})
export class FeatureLimitModule {}
