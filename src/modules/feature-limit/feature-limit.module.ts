import { Module, forwardRef } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { TierModel } from './models/tier.model';
import { Limitmodel } from './models/limit.model';
import { SequelizeFeatureLimitsRepository } from './feature-limit.repository';
import { FeatureLimitUsecases } from './feature-limit.usecase';
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
    FeatureLimitUsecases,
    FeatureLimit,
  ],
  exports: [FeatureLimit, FeatureLimitUsecases],
})
export class FeatureLimitModule {}
