import { Test, TestingModule } from '@nestjs/testing';
import { v4 } from 'uuid';
import { createMock } from '@golevelup/ts-jest';
import { UsageService } from './usage.service';
import { SequelizeUsageRepository } from './usage.repository';
import { newUser, newFile, newUsage } from '../../../test/fixtures';
import { UsageType } from './usage.domain';

describe('UsageService', () => {
  let service: UsageService;
  let usageRepository: SequelizeUsageRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsageService],
    })
      .useMocker(() => createMock())
      .compile();

    service = module.get<UsageService>(UsageService);
    usageRepository = module.get<SequelizeUsageRepository>(
      SequelizeUsageRepository,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addDailyUsageChangeOnFileSizeChange', () => {
    const user = newUser();
    const oldFile = newFile({ attributes: { size: BigInt(100) } });

    it('When no existing usage found, then should return null', async () => {
      const newFileData = newFile({ attributes: { size: BigInt(200) } });

      jest
        .spyOn(usageRepository, 'getMostRecentMonthlyOrYearlyUsage')
        .mockResolvedValue(null);

      const result = await service.addDailyUsageChangeOnFileSizeChange(
        user,
        oldFile,
        newFileData,
      );

      expect(result).toBeNull();
      expect(
        usageRepository.getMostRecentMonthlyOrYearlyUsage,
      ).toHaveBeenCalledWith(user.uuid);
    });

    it('When file size delta is zero, then should return null', async () => {
      const existingUsage = newUsage();
      const sameFile = newFile({ attributes: { size: BigInt(100) } });

      jest
        .spyOn(usageRepository, 'getMostRecentMonthlyOrYearlyUsage')
        .mockResolvedValue(existingUsage);

      const result = await service.addDailyUsageChangeOnFileSizeChange(
        user,
        oldFile,
        sameFile,
      );

      expect(result).toBeNull();
    });

    it('When file was created before usage period and size increased, then should create daily usage with positive delta', async () => {
      const usagePeriod = new Date('2024-06-15T00:00:00.000Z');
      const dateBeforeUsage = new Date('2024-06-10T00:00:00.000Z');

      const existingUsage = newUsage({
        attributes: {
          period: usagePeriod,
          type: UsageType.Monthly,
        },
      });

      const fileWithIncreasedSize = newFile({
        attributes: {
          size: BigInt(200),
          createdAt: dateBeforeUsage,
        },
      });

      const expectedUsage = newUsage({
        attributes: {
          userId: user.uuid,
          delta: 100,
          type: UsageType.Daily,
        },
      });

      jest
        .spyOn(usageRepository, 'getMostRecentMonthlyOrYearlyUsage')
        .mockResolvedValue(existingUsage);
      jest.spyOn(usageRepository, 'create').mockResolvedValue(expectedUsage);

      const result = await service.addDailyUsageChangeOnFileSizeChange(
        user,
        oldFile,
        fileWithIncreasedSize,
      );

      expect(result).toEqual(expectedUsage);
      expect(usageRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: user.uuid,
          delta: 100,
          type: UsageType.Daily,
        }),
      );
    });

    it('When file was created before usage period and size decreased, then should create daily usage with negative delta', async () => {
      const usagePeriod = new Date('2024-06-15T00:00:00.000Z');
      const dateBeforeUsage = new Date('2024-06-10T00:00:00.000Z');

      const existingUsage = newUsage({
        attributes: {
          period: usagePeriod,
          type: UsageType.Monthly,
        },
      });

      const fileWithDecreasedSize = newFile({
        attributes: {
          size: BigInt(50),
          createdAt: dateBeforeUsage,
        },
      });

      const expectedUsage = newUsage({
        attributes: {
          userId: user.uuid,
          delta: -50,
          type: UsageType.Daily,
        },
      });

      jest
        .spyOn(usageRepository, 'getMostRecentMonthlyOrYearlyUsage')
        .mockResolvedValue(existingUsage);
      jest.spyOn(usageRepository, 'create').mockResolvedValue(expectedUsage);

      const result = await service.addDailyUsageChangeOnFileSizeChange(
        user,
        oldFile,
        fileWithDecreasedSize,
      );

      expect(result).toEqual(expectedUsage);
      expect(usageRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: user.uuid,
          delta: -50,
          type: UsageType.Daily,
        }),
      );
    });

    it('When file was created after the usage period, then should return null', async () => {
      const usagePeriod = new Date('2024-06-15T00:00:00.000Z');
      const dateAfterUsage = new Date('2024-06-20T00:00:00.000Z');

      const existingUsage = newUsage({
        attributes: {
          period: usagePeriod,
          type: UsageType.Monthly,
        },
      });

      const newFileData = newFile({
        attributes: {
          size: BigInt(200),
          createdAt: dateAfterUsage,
        },
      });

      jest
        .spyOn(usageRepository, 'getMostRecentMonthlyOrYearlyUsage')
        .mockResolvedValue(existingUsage);

      const result = await service.addDailyUsageChangeOnFileSizeChange(
        user,
        oldFile,
        newFileData,
      );

      expect(result).toBeNull();
      expect(usageRepository.create).not.toHaveBeenCalled();
    });

    it('When file was created on the same day as usage period, then should create daily usage', async () => {
      const usagePeriod = new Date('2024-06-15T08:00:00.000Z');
      const dateSameDayAsUsage = new Date('2024-06-15T14:30:00.000Z');

      const existingUsage = newUsage({
        attributes: {
          period: usagePeriod,
          type: UsageType.Monthly,
        },
      });

      const newFileData = newFile({
        attributes: {
          size: BigInt(200),
          createdAt: dateSameDayAsUsage,
        },
      });

      const expectedUsage = newUsage({
        attributes: {
          userId: user.uuid,
          delta: 100,
          type: UsageType.Daily,
        },
      });

      jest
        .spyOn(usageRepository, 'getMostRecentMonthlyOrYearlyUsage')
        .mockResolvedValue(existingUsage);
      jest.spyOn(usageRepository, 'create').mockResolvedValue(expectedUsage);

      const result = await service.addDailyUsageChangeOnFileSizeChange(
        user,
        oldFile,
        newFileData,
      );

      expect(result).toEqual(expectedUsage);
      expect(usageRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: user.uuid,
          delta: 100,
          type: UsageType.Daily,
        }),
      );
    });
  });

  describe('getUserMostRecentUsage', () => {
    it('When called, then it should return the most recent usage', async () => {
      const user = newUser();
      const usage = newUsage();

      jest
        .spyOn(usageRepository, 'getMostRecentMonthlyOrYearlyUsage')
        .mockResolvedValue(usage);

      const result = await service.getUserMostRecentUsage(user.uuid);

      expect(result).toEqual(usage);
      expect(
        usageRepository.getMostRecentMonthlyOrYearlyUsage,
      ).toHaveBeenCalledWith(user.uuid);
    });
  });

  describe('createFirstUsageCalculation', () => {
    it('When called, then it should call the repository with expected arguments and return the first created usage', async () => {
      const user = newUser();
      const usage = newUsage();

      jest
        .spyOn(usageRepository, 'createFirstUsageCalculation')
        .mockResolvedValue(usage);

      const result = await service.createFirstUsageCalculation(user.uuid);

      expect(result).toEqual(usage);
      expect(usageRepository.createFirstUsageCalculation).toHaveBeenCalledWith(
        user.uuid,
      );
    });
  });

  describe('createMonthlyUsage', () => {
    it('When called, then it should create the monthly usage with expected arguments', async () => {
      const userId = v4();
      const period = new Date();
      const delta = 1000;
      const usage = newUsage({ attributes: { type: UsageType.Monthly } });

      jest
        .spyOn(usageRepository, 'createMonthlyUsage')
        .mockResolvedValue(usage);

      const result = await service.createMonthlyUsage(userId, period, delta);

      expect(result).toEqual(usage);
      expect(usageRepository.createMonthlyUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          period,
          delta,
          type: UsageType.Monthly,
        }),
      );
    });
  });

  describe('createDailyUsage', () => {
    it('When called, then it should create daily usage with expected arguments', async () => {
      const userId = 'user-id';
      const period = new Date();
      const delta = 500;
      const usage = newUsage({ attributes: { type: UsageType.Daily } });

      jest.spyOn(usageRepository, 'create').mockResolvedValue(usage);

      const result = await service.createDailyUsage(userId, period, delta);

      expect(result).toEqual(usage);
      expect(usageRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          period,
          delta,
          type: UsageType.Daily,
        }),
      );
    });
  });
});
