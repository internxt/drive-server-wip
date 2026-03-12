import { Module } from '@nestjs/common';
import { HttpClientModule } from '../../externals/http/http.module';
import { ReferralController } from './referral.controller';
import { ReferralService } from './referral.service';
import { CelloReferralService } from './cello-referral.service';

@Module({
  imports: [HttpClientModule],
  controllers: [ReferralController],
  providers: [
    {
      provide: ReferralService,
      useClass: CelloReferralService,
    },
  ],
})
export class ReferralModule {}
