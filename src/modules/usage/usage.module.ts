import { forwardRef, Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { UsageModel } from './usage.model';
import { SequelizeUsageRepository } from './usage.repository';
import { UsageUseCases } from './usage.usecase';
import { FileModule } from '../file/file.module';

@Module({
  imports: [
    SequelizeModule.forFeature([UsageModel]),
    forwardRef(() => FileModule),
  ],
  providers: [SequelizeUsageRepository, UsageUseCases],
  exports: [SequelizeUsageRepository, UsageUseCases, SequelizeModule],
})
export class UsageModule {}
