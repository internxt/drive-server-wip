import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { UsageModel } from './usage.model';
import { SequelizeUsageRepository } from './usage.repository';

@Module({
  imports: [SequelizeModule.forFeature([UsageModel])],
  providers: [SequelizeUsageRepository],
  exports: [SequelizeUsageRepository],
})
export class PlanModule {}
