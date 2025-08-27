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

    it('When file is created today, then should return null', async () => {
      const existingUsage = newUsage();
      const todayFile = newFile({
        attributes: {
          size: BigInt(200),
          createdAt: new Date(),
        },
      });

      jest
        .spyOn(usageRepository, 'getMostRecentMonthlyOrYearlyUsage')
        .mockResolvedValue(existingUsage);

      const result = await service.addDailyUsageChangeOnFileSizeChange(
        user,
        oldFile,
        todayFile,
      );

      expect(result).toBeNull();
    });

    it('When file size increased and not created today, then should create daily usage with positive delta', async () => {
      const existingUsage = newUsage();
      const yesterdayFile = newFile({
        attributes: {
          size: BigInt(200),
          createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
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
        yesterdayFile,
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

    it('When file size decreased and not created today, then should create daily usage with negative delta', async () => {
      const existingUsage = newUsage();
      const yesterdayFile = newFile({
        attributes: {
          size: BigInt(50),
          createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
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
        yesterdayFile,
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
        .spyOn(usageRepository, 'findOrCreateMonthlyUsage')
        .mockResolvedValue(usage);

      const result = await service.findOrCreateMonthlyUsage(
        userId,
        period,
        delta,
      );

      expect(result).toEqual(usage);
      expect(usageRepository.findOrCreateMonthlyUsage).toHaveBeenCalledWith(
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

  describe('getAccumulatedUsage', () => {
    it('When called, then it should return user usage from repository', async () => {
      const userUuid = v4();
      const expectedUsage = 1500;

      jest
        .spyOn(usageRepository, 'getUserUsage')
        .mockResolvedValue(expectedUsage);

      const result = await service.getAccumulatedUsage(userUuid);

      expect(result).toEqual(expectedUsage);
      expect(usageRepository.getUserUsage).toHaveBeenCalledWith(userUuid);
    });
  });
});
