import { Module } from '@nestjs/common';
import { DeviceController } from './device.controller';

@Module({
  imports: [],
  controllers: [DeviceController],
  providers: [],
  exports: [],
})
export class DeviceModule {}
