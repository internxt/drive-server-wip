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

  describe('getLatestTemporalUsage', () => {
    it('When called, then should query with expected arguments', async () => {
      const userUuid = v4();
      const mockUsageModel = {
        toJSON: () => newUsage(),
      };

      jest
        .spyOn(usageModel, 'findOne')
        .mockResolvedValue(mockUsageModel as any);

      await repository.getLatestTemporalUsage(userUuid);

      expect(usageModel.findOne).toHaveBeenCalledWith({
        where: {
          userId: userUuid,
          [Op.or]: [
            { type: UsageType.Monthly },
            { type: UsageType.Yearly },
            { type: UsageType.Daily },
          ],
        },
        order: [['period', 'DESC']],
      });
    });

    it('When no usage found, then should return null', async () => {
      const userUuid = v4();

      jest.spyOn(usageModel, 'findOne').mockResolvedValue(null);

      const result = await repository.getLatestTemporalUsage(userUuid);

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
        expect.any(String),
        expect.objectContaining({
          replacements: expect.objectContaining({
            userUuid,
          }),
          type: QueryTypes.SELECT,
        }),
      );
    });
  });

  describe('getLatestVersionUsage', () => {
    it('When called, then should query with type Version', async () => {
      const userUuid = v4();
      const mockUsageModel = {
        toJSON: () => newUsage({ attributes: { type: UsageType.Version } }),
      };

      jest
        .spyOn(usageModel, 'findOne')
        .mockResolvedValue(mockUsageModel as any);

      await repository.getLatestVersionUsage(userUuid);

      expect(usageModel.findOne).toHaveBeenCalledWith({
        where: {
          userId: userUuid,
          type: UsageType.Version,
        },
        order: [['period', 'DESC']],
      });
    });

    it('When no version usage found, then should return null', async () => {
      const userUuid = v4();

      jest.spyOn(usageModel, 'findOne').mockResolvedValue(null);

      const result = await repository.getLatestVersionUsage(userUuid);

      expect(result).toBeNull();
    });

    it('When version usage exists, then should return Usage domain object', async () => {
      const userUuid = v4();
      const mockUsage = newUsage({ attributes: { type: UsageType.Version } });
      const mockUsageModel = {
        toJSON: () => mockUsage,
      };

      jest
        .spyOn(usageModel, 'findOne')
        .mockResolvedValue(mockUsageModel as any);

      const result = await repository.getLatestVersionUsage(userUuid);

      expect(result).not.toBeNull();
      expect(result.type).toBe(UsageType.Version);
    });
  });

  describe('createFirstVersionUsageCalculation', () => {
    it('When called, then should execute query with userUuid', async () => {
      const userUuid = v4();
      const mockSequelize = {
        query: jest.fn().mockResolvedValue([{ delta: '1000' }]),
      };
      const mockUsage = newUsage({ attributes: { type: UsageType.Version } });
      const mockUsageModel = {
        toJSON: () => mockUsage,
      };

      Object.defineProperty(usageModel, 'sequelize', {
        value: mockSequelize,
      });
      jest
        .spyOn(usageModel, 'findOrCreate')
        .mockResolvedValue([mockUsageModel as any, true]);

      await repository.createFirstVersionUsageCalculation(userUuid);

      expect(mockSequelize.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          replacements: expect.objectContaining({
            userUuid,
          }),
          type: QueryTypes.SELECT,
        }),
      );
    });

    it('When called, then should create usage with type Version', async () => {
      const userUuid = v4();
      const mockSequelize = {
        query: jest.fn().mockResolvedValue([{ delta: '500' }]),
      };
      const mockUsage = newUsage({ attributes: { type: UsageType.Version } });
      const mockUsageModel = {
        toJSON: () => mockUsage,
      };

      Object.defineProperty(usageModel, 'sequelize', {
        value: mockSequelize,
      });
      jest
        .spyOn(usageModel, 'findOrCreate')
        .mockResolvedValue([mockUsageModel as any, true]);

      await repository.createFirstVersionUsageCalculation(userUuid);

      expect(usageModel.findOrCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: userUuid,
            type: UsageType.Version,
          }),
          defaults: expect.objectContaining({
            type: UsageType.Version,
          }),
        }),
      );
    });
  });

  describe('calculateAggregatedVersionUsage', () => {
    it('When called, then should SUM deltas for type Version', async () => {
      const userUuid = v4();
      const mockResult = [{ total: '5000' }];

      jest.spyOn(usageModel, 'findAll').mockResolvedValue(mockResult as any);

      const result = await repository.calculateAggregatedVersionUsage(userUuid);

      expect(result).toBe(5000);
      expect(usageModel.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: userUuid,
            type: UsageType.Version,
          },
          raw: true,
        }),
      );
    });

    it('When no version usages exist, then should return 0', async () => {
      const userUuid = v4();
      const mockResult = [{ total: null }];

      jest.spyOn(usageModel, 'findAll').mockResolvedValue(mockResult as any);

      const result = await repository.calculateAggregatedVersionUsage(userUuid);

      expect(result).toBe(0);
    });

    it('When query returns empty array, then should return 0', async () => {
      const userUuid = v4();

      jest.spyOn(usageModel, 'findAll').mockResolvedValue([] as any);

      const result = await repository.calculateAggregatedVersionUsage(userUuid);

      expect(result).toBe(0);
    });
  });
});
