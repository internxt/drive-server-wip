import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { UsageModel } from './usage.model';
import { SequelizeUsageRepository } from './usage.repository';
import { UsageService } from './usage.service';

@Module({
  imports: [SequelizeModule.forFeature([UsageModel])],
  providers: [SequelizeUsageRepository, UsageService],
  exports: [UsageService],
})
export class UsageModule {}
