import { Module } from '@nestjs/common';
import { KlaviyoTrackingService } from './klaviyo-tracking.service';

@Module({
  providers: [KlaviyoTrackingService],
  exports: [KlaviyoTrackingService],
})
export class KlaviyoModule {}
