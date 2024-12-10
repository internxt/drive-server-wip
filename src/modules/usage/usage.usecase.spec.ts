import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { UsageUseCases } from './usage.usecase';
import { SequelizeUsageRepository } from './usage.repository';
import { SequelizeFileRepository } from '../file/file.repository';
import { Usage, UsageType } from './usage.domain';
import { newFile, newUsage, newUser } from '../../../test/fixtures';
import { v4 } from 'uuid';

describe('UsageUseCases', () => {
  let usageUseCases: UsageUseCases;
  let usageRepository: SequelizeUsageRepository;
  let fileRepository: SequelizeFileRepository;

  const userMocked = newUser({
    attributes: { uuid: v4(), id: 1, email: 'test@example.com' },
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsageUseCases],
    })
      .useMocker(() => createMock())
      .compile();

    usageUseCases = module.get<UsageUseCases>(UsageUseCases);
    usageRepository = module.get<SequelizeUsageRepository>(
      SequelizeUsageRepository,
    );
    fileRepository = module.get<SequelizeFileRepository>(
      SequelizeFileRepository,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserUsage', () => {
    it('When user has existing usage, it calculates usage correctly', async () => {
      const existingUsage = newUsage({
        attributes: {
          delta: 100,
          type: UsageType.Monthly,
          userId: userMocked.uuid,
        },
      });

      jest
        .spyOn(usageRepository, 'getMostRecentMonthlyOrYearlyUsage')
        .mockResolvedValueOnce(existingUsage);
      jest
        .spyOn(fileRepository, 'sumFileSizesSinceDate')
        .mockResolvedValueOnce(200);
      jest.spyOn(usageRepository, 'getUserUsage').mockResolvedValueOnce({
        total_monthly_delta: 300,
        total_yearly_delta: 500,
      });

      const result = await usageUseCases.getUserUsage(userMocked);

      expect(result).toEqual({ drive: 1000, id: userMocked.email });
    });

    it('When user has no existing usage, it creates first monhtly usage and calculates correctly', async () => {
      const firstMonthlyUsage = newUsage({
        attributes: {
          delta: 0,
          type: UsageType.Monthly,
          userId: userMocked.uuid,
        },
      });

      jest
        .spyOn(usageRepository, 'getMostRecentMonthlyOrYearlyUsage')
        .mockResolvedValueOnce(null);
      jest
        .spyOn(usageRepository, 'addFirstMonthlyUsage')
        .mockResolvedValueOnce(firstMonthlyUsage);
      jest
        .spyOn(fileRepository, 'sumFileSizesSinceDate')
        .mockResolvedValueOnce(100);
      jest.spyOn(usageRepository, 'getUserUsage').mockResolvedValueOnce({
        total_monthly_delta: 200,
        total_yearly_delta: 300,
      });

      const result = await usageUseCases.getUserUsage(userMocked);

      expect(result).toEqual({ drive: 600, id: userMocked.email });
      expect(usageRepository.addFirstMonthlyUsage).toHaveBeenCalledWith(
        userMocked.uuid,
      );
    });

    it('When user has yearly usage, it calculates usage correctly', async () => {
      const yearlyUsage = newUsage({
        attributes: {
          delta: 500,
          type: UsageType.Yearly,
          userId: userMocked.uuid,
          period: new Date(),
        },
      });

      jest
        .spyOn(usageRepository, 'getMostRecentMonthlyOrYearlyUsage')
        .mockResolvedValueOnce(yearlyUsage);
      jest
        .spyOn(fileRepository, 'sumFileSizesSinceDate')
        .mockResolvedValueOnce(400);
      jest.spyOn(usageRepository, 'getUserUsage').mockResolvedValueOnce({
        total_monthly_delta: 200,
        total_yearly_delta: 500,
      });

      const result = await usageUseCases.getUserUsage(userMocked);

      expect(result).toEqual({ drive: 1100, id: userMocked.email });
    });

    it('When user has monthly usage, it calculates usage correctly and calculates file changes since next day', async () => {
      const monthlyUsage = newUsage({
        attributes: {
          delta: 200,
          type: UsageType.Monthly,
          userId: userMocked.uuid,
          period: new Date('2023-01-01T00:00:00Z'),
        },
      });
      const expectedCalculateDate = new Date('2023-01-02T00:00:00Z');

      jest
        .spyOn(usageRepository, 'getMostRecentMonthlyOrYearlyUsage')
        .mockResolvedValueOnce(monthlyUsage);
      const sumFileSizesSinceSpy = jest
        .spyOn(fileRepository, 'sumFileSizesSinceDate')
        .mockResolvedValueOnce(300);
      jest.spyOn(usageRepository, 'getUserUsage').mockResolvedValueOnce({
        total_monthly_delta: 200,
        total_yearly_delta: 500,
      });

      const result = await usageUseCases.getUserUsage(userMocked);

      expect(result).toEqual({ drive: 1000, id: userMocked.email });
      expect(sumFileSizesSinceSpy).toHaveBeenCalledWith(
        userMocked.id,
        expectedCalculateDate,
      );
    });

    it('When user has yearly usage, it calculates usage correctly and calculates file changes since next year', async () => {
      const yearlyUsage = newUsage({
        attributes: {
          delta: 500,
          type: UsageType.Yearly,
          userId: userMocked.uuid,
          period: new Date('2023-01-01T00:00:00Z'),
        },
      });
      const expectedCalculateDate = new Date('2024-01-01T00:00:00Z');

      jest
        .spyOn(usageRepository, 'getMostRecentMonthlyOrYearlyUsage')
        .mockResolvedValueOnce(yearlyUsage);
      const sumFileSizesSinceSpy = jest
        .spyOn(fileRepository, 'sumFileSizesSinceDate')
        .mockResolvedValueOnce(400);
      jest.spyOn(usageRepository, 'getUserUsage').mockResolvedValueOnce({
        total_monthly_delta: 200,
        total_yearly_delta: 500,
      });

      const result = await usageUseCases.getUserUsage(userMocked);

      expect(result).toEqual({ drive: 1100, id: userMocked.email });
      expect(sumFileSizesSinceSpy).toHaveBeenCalledWith(
        userMocked.id,
        expectedCalculateDate,
      );
    });
  });

  describe('createDailyUsage', () => {
    it('When daily usage is created, it should return the created usage', async () => {
      const dailyUsage = newUsage({
        attributes: {
          delta: 50,
          type: UsageType.Daily,
          userId: userMocked.uuid,
        },
      });

      jest.spyOn(usageRepository, 'create').mockResolvedValueOnce(dailyUsage);

      const result = await usageUseCases.createDailyUsage(
        userMocked.uuid,
        new Date(),
        50,
      );

      expect(result).toEqual(dailyUsage);
    });
  });

  describe('addDailyUsageChangeOnFileSizeChange', () => {
    it('When file size changes and delta is non-zero, it creates a daily usage', async () => {
      const oldFile = newFile({ attributes: { size: BigInt(100) } });
      const fileChanged = newFile({ attributes: { size: BigInt(200) } });
      const dailyUsage = newUsage({
        attributes: {
          delta: 100,
          type: UsageType.Daily,
          userId: userMocked.uuid,
        },
      });
      const monthlyUsage = newUsage({
        attributes: {
          delta: 100,
          type: UsageType.Monthly,
          userId: userMocked.uuid,
        },
      });

      jest
        .spyOn(usageRepository, 'getMostRecentMonthlyOrYearlyUsage')
        .mockResolvedValueOnce(monthlyUsage);
      jest
        .spyOn(usageUseCases, 'createDailyUsage')
        .mockResolvedValueOnce(dailyUsage);

      await usageUseCases.addDailyUsageChangeOnFileSizeChange(
        userMocked,
        oldFile,
        fileChanged,
      );

      expect(usageUseCases.createDailyUsage).toHaveBeenCalledWith(
        userMocked.uuid,
        expect.any(Date),
        100,
      );
    });

    it('When file size does not change, it should not create daily usage', async () => {
      const oldFile = newFile({ attributes: { size: BigInt(100) } });
      const fileChanged = newFile({ attributes: { size: BigInt(100) } });

      jest
        .spyOn(usageRepository, 'getMostRecentMonthlyOrYearlyUsage')
        .mockResolvedValueOnce(
          Usage.build({
            id: v4(),
            userId: userMocked.uuid,
            delta: 0,
            period: new Date(),
            type: UsageType.Daily,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        );
      jest.spyOn(usageUseCases, 'createDailyUsage');

      const result = await usageUseCases.addDailyUsageChangeOnFileSizeChange(
        userMocked,
        oldFile,
        fileChanged,
      );

      expect(result).toBeNull();
      expect(usageUseCases.createDailyUsage).not.toHaveBeenCalled();
    });
  });
});
