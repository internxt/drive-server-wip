import { Module, forwardRef } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { TierModel } from './models/tier.model';
import { Limitmodel } from './models/limit.model';
import { SequelizeFeatureLimitsRepository } from './feature-limit.repository';
import { FeatureLimitUsecases } from './feature-limit.usecase';
import { FeatureLimit } from './feature-limits.guard';
import { TierLimitsModel } from './models/tier-limits.model';
import { SharingModule } from '../sharing/sharing.module';
import { FeatureLimitsMigrationService } from './feature-limit-migration.service';
import { UserModule } from '../user/user.module';
import { HttpClientModule } from '../../externals/http/http.module';
import { ConfigModule } from '@nestjs/config';
import { PaidPlansModel } from './models/paid-plans.model';
import { PaymentsService } from '../../externals/payments/payments.service';

@Module({
  imports: [
    SequelizeModule.forFeature([
      TierModel,
      Limitmodel,
      TierLimitsModel,
      TierLimitsModel,
      PaidPlansModel,
    ]),
    HttpClientModule,
    forwardRef(() => SharingModule),
    forwardRef(() => UserModule),
  ],
  providers: [
    SequelizeFeatureLimitsRepository,
    FeatureLimitUsecases,
    FeatureLimit,
    FeatureLimitsMigrationService,
    ConfigModule,
    PaymentsService,
  ],
  exports: [
    FeatureLimit,
    FeatureLimitUsecases,
    SequelizeFeatureLimitsRepository,
  ],
})
export class FeatureLimitModule {}
