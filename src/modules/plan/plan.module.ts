import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { PlanModel } from './plan.model';
import { SequelizePlanRepository } from './plan.repository';

@Module({
  imports: [SequelizeModule.forFeature([PlanModel])],
  providers: [SequelizePlanRepository],
  exports: [SequelizePlanRepository],
})
export class PlanModule {}
