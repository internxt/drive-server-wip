import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/sequelize';
import { v4 } from 'uuid';
import { createMock } from '@golevelup/ts-jest';
import { Op, QueryTypes } from 'sequelize';
import { SequelizeUsageRepository } from './usage.repository';
import { UsageModel } from './usage.model';
import { newUsage } from '../../../test/fixtures';
import { UsageType } from './usage.domain';

describe('SequelizeUsageRepository', () => {
  let repository: SequelizeUsageRepository;
  let usageModel: typeof UsageModel;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SequelizeUsageRepository],
    })
      .useMocker(() => createMock())
      .compile();

    repository = module.get<SequelizeUsageRepository>(SequelizeUsageRepository);
    usageModel = module.get<typeof UsageModel>(getModelToken(UsageModel));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('create', () => {
    it('When called, then should create usage with expected arguments', async () => {
      const userId = v4();
      const delta = 1000;
      const period = new Date();
      const type = UsageType.Daily;
      const usageData = newUsage({
        attributes: { userId, delta, period, type },
      });
      const mockUsageModel = {
        toJSON: () => ({ id: v4(), ...usageData }),
      };

      jest.spyOn(usageModel, 'create').mockResolvedValue(mockUsageModel as any);

      await repository.create(usageData);

      expect(usageModel.create).toHaveBeenCalledWith(usageData);
    });
  });

  describe('getMostRecentMonthlyOrYearlyUsage', () => {
    it('When called, then should query with expected arguments', async () => {
      const userUuid = v4();
      const mockUsageModel = {
        toJSON: () => newUsage(),
      };

      jest
        .spyOn(usageModel, 'findOne')
        .mockResolvedValue(mockUsageModel as any);

      await repository.getMostRecentMonthlyOrYearlyUsage(userUuid);

      expect(usageModel.findOne).toHaveBeenCalledWith({
        where: {
          userId: userUuid,
          [Op.or]: [{ type: UsageType.Monthly }, { type: UsageType.Yearly }],
        },
        order: [['period', 'DESC']],
      });
    });

    it('When no usage found, then should return null', async () => {
      const userUuid = v4();

      jest.spyOn(usageModel, 'findOne').mockResolvedValue(null);

      const result =
        await repository.getMostRecentMonthlyOrYearlyUsage(userUuid);

      expect(result).toBeNull();
    });
  });

  describe('createFirstUsageCalculation', () => {
    it('When called, then should execute query with expected arguments', async () => {
      const userUuid = v4();
      const mockSequelize = {
        query: jest.fn().mockResolvedValue([{ toJSON: () => newUsage() }]),
      };

      Object.defineProperty(usageModel, 'sequelize', {
        value: mockSequelize,
      });

      await repository.createFirstUsageCalculation(userUuid);

      expect(mockSequelize.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO public.usages'),
        expect.objectContaining({
          replacements: expect.objectContaining({
            userUuid,
          }),
          type: QueryTypes.INSERT,
          model: UsageModel,
        }),
      );
    });
  });
});
