import { Module } from '@nestjs/common';
import { ReferralController } from './referral.controller';
import { ReferralService } from './referral.service';
import { CelloReferralService } from './cello-referral.service';
import { FeatureLimitModule } from '../feature-limit/feature-limit.module';

@Module({
  imports: [FeatureLimitModule],
  controllers: [ReferralController],
  providers: [
    {
      provide: ReferralService,
      useClass: CelloReferralService,
    },
  ],
})
export class ReferralModule {}
