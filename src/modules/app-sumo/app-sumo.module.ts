import { Module } from '@nestjs/common';
import { SequelizeAppSumoRepository } from './app-sumo.repository';
import { SequelizeModule } from '@nestjs/sequelize';
import { AppSumoModel } from './app-sumo.model';
import { PlanModule } from '../plan/plan.module';
import { SequelizePlanRepository } from '../plan/plan.repository';
import { AppSumoUseCase } from './app-sumo.usecase';
import { PlanModel } from '../plan/plan.model';

@Module({
  imports: [SequelizeModule.forFeature([AppSumoModel, PlanModel]), PlanModule],
  providers: [
    SequelizeAppSumoRepository,
    SequelizePlanRepository,
    AppSumoUseCase,
  ],
  exports: [AppSumoUseCase, SequelizeAppSumoRepository],
})
export class AppSumoModule {}
