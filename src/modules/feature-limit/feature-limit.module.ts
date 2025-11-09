import { Module, forwardRef } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { TierModel } from './models/tier.model';
import { Limitmodel } from './models/limit.model';
import { SequelizeFeatureLimitsRepository } from './feature-limit.repository';
import { FeatureLimitUsecases } from './feature-limit.usecase';
import { FeatureLimit } from './feature-limits.guard';
import { TierLimitsModel } from './models/tier-limits.model';
import { UserOverriddenLimitModel } from './models/user-overridden-limit.model';
import { SharingModule } from '../sharing/sharing.module';
import { FeatureLimitsMigrationService } from './feature-limit-migration.service';
import { UserModule } from '../user/user.module';
import { HttpClientModule } from '../../externals/http/http.module';
import { ConfigModule } from '@nestjs/config';
import { PaidPlansModel } from './models/paid-plans.model';
import { PaymentsService } from '../../externals/payments/payments.service';
import { FeatureLimitService } from './feature-limit.service';
import { WorkspacesModule } from '../workspaces/workspaces.module';

@Module({
  imports: [
    SequelizeModule.forFeature([
      TierModel,
      Limitmodel,
      TierLimitsModel,
      UserOverriddenLimitModel,
      PaidPlansModel,
    ]),
    HttpClientModule,
    forwardRef(() => SharingModule),
    forwardRef(() => UserModule),
    WorkspacesModule,
  ],
  providers: [
    SequelizeFeatureLimitsRepository,
    FeatureLimitUsecases,
    FeatureLimit,
    FeatureLimitsMigrationService,
    ConfigModule,
    PaymentsService,
    FeatureLimitService,
  ],
  exports: [
    FeatureLimit,
    FeatureLimitUsecases,
    FeatureLimitService,
    SequelizeFeatureLimitsRepository,
  ],
})
export class FeatureLimitModule {}
