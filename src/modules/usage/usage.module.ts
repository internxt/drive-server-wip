import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { UsageModel } from './usage.model';
import { UsageService } from './usage.service';
import { SequelizeUsageRepository } from './usage.repository';

@Module({
  imports: [SequelizeModule.forFeature([UsageModel])],
  providers: [SequelizeUsageRepository, UsageService],
  exports: [UsageService],
})
export class UsageModule {}
