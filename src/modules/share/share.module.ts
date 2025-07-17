import { Module } from '@nestjs/common';
import { ShareController } from './share.controller';

@Module({
  controllers: [ShareController],
})
export class ShareModule {}
