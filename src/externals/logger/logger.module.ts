import { Module } from '@nestjs/common';
import { Logger } from './logger';

@Module({
  providers: [Logger],
  exports: [Logger],
})
export class LoggerModule {}
