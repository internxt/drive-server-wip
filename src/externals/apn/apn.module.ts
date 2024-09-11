import { Module } from '@nestjs/common';
import { ApnService } from './apn.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [ApnService],
  exports: [ApnService],
})
export class ApnModule {}
