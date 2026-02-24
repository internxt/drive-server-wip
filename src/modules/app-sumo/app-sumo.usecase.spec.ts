import { AppSumoUseCase } from './app-sumo.usecase';
import { type SequelizeAppSumoRepository } from './app-sumo.repository';
import { type SequelizePlanRepository } from '../plan/plan.repository';
import { type AppSumoModel } from './app-sumo.model';
import { PlanNotFoundException } from '../plan/exception/plan-not-found.exception';
import { type DeepMocked, createMock } from '@golevelup/ts-jest';
import { type PlanModel } from '../plan/plan.model';

describe('AppSumoUseCase', () => {
  let useCase: AppSumoUseCase;
  let appSumoRepository: DeepMocked<SequelizeAppSumoRepository>;
  let planRepository: DeepMocked<SequelizePlanRepository>;
  let appSumo: DeepMocked<AppSumoModel>;
  let plan: DeepMocked<PlanModel>;

  beforeEach(async () => {
    appSumo = createMock<AppSumoModel>();
    plan = createMock<PlanModel>();

    appSumoRepository = createMock<SequelizeAppSumoRepository>();
    planRepository = createMock<SequelizePlanRepository>();

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

    const errorLogSpy = jest.spyOn(useCase['logger'], 'log');

    try {
      await useCase.getByUserId(userId);
    } catch (error) {
      expect(error).toBeInstanceOf(PlanNotFoundException);
      expect(errorLogSpy).toHaveBeenCalledWith('Plan not found');
    }
  });
});
