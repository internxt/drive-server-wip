import { Injectable, Logger } from '@nestjs/common';
import { SequelizeAppSumoRepository } from './app-sumo.repository';
import { SequelizePlanRepository } from '../plan/plan.repository';
import { type AppSumoModel } from './app-sumo.model';
import { PlanNotFoundException } from '../plan/exception/plan-not-found.exception';

@Injectable()
export class AppSumoUseCase {
  private readonly logger = new Logger('AppSumoUseCase');

  constructor(
    private readonly appSumoRepository: SequelizeAppSumoRepository,
    private readonly planRepository: SequelizePlanRepository,
  ) {}

  public async getByUserId(userId: number): Promise<AppSumoModel> {
    const appSumo = await this.appSumoRepository.getOneBy({ userId });

    try {
      await this.planRepository.getOneBy({
        userId,
        name: 'appsumo_unlimited_members',
      });

      appSumo.planId = 'unlimited';
    } catch (error) {
      if (error instanceof PlanNotFoundException) {
        this.logger.log(error.message);
      }

      throw error;
    }

    return appSumo;
  }

  public async deleteByUserId(userId: number): Promise<void> {
    await this.appSumoRepository.deleteBy({ userId });
  }
}
