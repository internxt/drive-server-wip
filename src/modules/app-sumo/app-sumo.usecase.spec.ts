import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDeep, MockProxy } from 'vitest-mock-extended';
import { AppSumoUseCase } from './app-sumo.usecase';
import { SequelizeAppSumoRepository } from './app-sumo.repository';
import { SequelizePlanRepository } from '../plan/plan.repository';
import { AppSumoModel } from './app-sumo.model';
import { PlanNotFoundException } from '../plan/exception/plan-not-found.exception';
import { PlanModel } from '../plan/plan.model';

describe('AppSumoUseCase', () => {
  let useCase: AppSumoUseCase;
  let appSumoRepository: MockProxy<SequelizeAppSumoRepository>;
  let planRepository: MockProxy<SequelizePlanRepository>;
  let appSumo: MockProxy<AppSumoModel>;
  let plan: MockProxy<PlanModel>;

  beforeEach(() => {
    appSumo = mockDeep<AppSumoModel>();
    plan = mockDeep<PlanModel>();

    appSumoRepository = mockDeep<SequelizeAppSumoRepository>();
    planRepository = mockDeep<SequelizePlanRepository>();

    useCase = new AppSumoUseCase(appSumoRepository, planRepository);

    planRepository.getOneBy.mockResolvedValue(plan);
    appSumoRepository.getOneBy.mockResolvedValue(appSumo);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call appSumoRepository.getOneBy with the correct userId', async () => {
    const userId = 1;

    const result = await useCase.getByUserId(userId);

    expect(appSumoRepository.getOneBy).toHaveBeenCalledWith({ userId });
    expect(result).toEqual(appSumo);
  });

  it('should set appSumo.planId to "unlimited" when a plan is found', async () => {
    const userId = 1;

    const result = await useCase.getByUserId(userId);

    expect(result.planId).toEqual('unlimited');
  });

  it('should not set appSumo.planId to "unlimited" when a plan is found', async () => {
    const userId = 1;
    planRepository.getOneBy.mockRejectedValueOnce(new PlanNotFoundException());
    try {
      await useCase.getByUserId(userId);
    } catch (error) {
      expect(error).toBeInstanceOf(PlanNotFoundException);
    }
  });

  it('should log an error message and rethrow when PlanNotFoundException is caught', async () => {
    const userId = 1;

    planRepository.getOneBy.mockRejectedValueOnce(
      new PlanNotFoundException('Plan not found'),
    );

    const errorLogSpy = vi.spyOn(useCase['logger'], 'log');

    try {
      await useCase.getByUserId(userId);
    } catch (error) {
      expect(error).toBeInstanceOf(PlanNotFoundException);
      expect(errorLogSpy).toHaveBeenCalledWith('Plan not found');
    }
  });
});
