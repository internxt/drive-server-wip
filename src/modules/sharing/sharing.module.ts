import { Module } from '@nestjs/common';
import { SharingService } from './sharing.service';
import { SharingController } from './sharing.controller';

@Module({
  controllers: [SharingController],
  providers: [SharingService],
})
export class SharingModule {}
