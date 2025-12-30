import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { UsageService } from './usage.service';
import { SequelizeUsageRepository } from './usage.repository';
import { newUser, newFile, newUsage } from '../../../test/fixtures';
import { UsageType } from './usage.domain';
import { Time } from '../../lib/time';

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

  describe('addFileReplacementDelta', () => {
    const user = newUser();
    const oldFile = newFile({ attributes: { size: BigInt(100) } });

    it('When no existing usage found, then should return null', async () => {
      const newFileData = newFile({ attributes: { size: BigInt(200) } });

      jest
        .spyOn(usageRepository, 'getLatestTemporalUsage')
        .mockResolvedValue(null);

      const result = await service.addFileReplacementDelta(
        user,
        oldFile,
        newFileData,
      );

      expect(result).toBeNull();
      expect(usageRepository.getLatestTemporalUsage).toHaveBeenCalledWith(
        user.uuid,
      );
    });

    it('When file size delta is zero, then should return null', async () => {
      const existingUsage = newUsage();
      const sameFile = newFile({ attributes: { size: BigInt(100) } });

      jest
        .spyOn(usageRepository, 'getLatestTemporalUsage')
        .mockResolvedValue(existingUsage);

      const result = await service.addFileReplacementDelta(
        user,
        oldFile,
        sameFile,
      );

      expect(result).toBeNull();
    });

    it('When file was created before or within usage period and size increased, then should create replacement usage with positive delta', async () => {
      const usagePeriod = Time.now('2024-06-15T00:00:00.000Z');
      const dateBeforeUsage = Time.dateWithTimeAdded(-2, 'day', usagePeriod);

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
          type: UsageType.Replacement,
        },
      });

      jest
        .spyOn(usageRepository, 'getLatestTemporalUsage')
        .mockResolvedValue(existingUsage);
      jest.spyOn(usageRepository, 'create').mockResolvedValue(expectedUsage);

      const result = await service.addFileReplacementDelta(
        user,
        oldFile,
        fileWithIncreasedSize,
      );

      expect(result).toEqual(expectedUsage);
      expect(usageRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: user.uuid,
          delta: 100,
          type: UsageType.Replacement,
        }),
      );
    });

    it('When file was created before or within usage period and size decreased, then should create replacement usage with negative delta', async () => {
      const usagePeriod = Time.now('2024-06-15T00:00:00.000Z');
      const dateBeforeUsage = Time.dateWithTimeAdded(-2, 'day', usagePeriod);

      const existingUsage = newUsage({
        attributes: {
          period: usagePeriod,
          type: UsageType.Daily,
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
          type: UsageType.Replacement,
        },
      });

      jest
        .spyOn(usageRepository, 'getLatestTemporalUsage')
        .mockResolvedValue(existingUsage);
      jest.spyOn(usageRepository, 'create').mockResolvedValue(expectedUsage);

      const result = await service.addFileReplacementDelta(
        user,
        oldFile,
        fileWithDecreasedSize,
      );

      expect(result).toEqual(expectedUsage);
      expect(usageRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: user.uuid,
          delta: -50,
          type: UsageType.Replacement,
        }),
      );
    });

    it('When latest usage is yearly and file was created within same year, then should create replacement usage', async () => {
      const usagePeriod = Time.now('2024-01-01T00:00:00.000Z');
      const dateInSameYear = Time.dateWithTimeAdded(2, 'month', usagePeriod);

      const existingYearlyUsage = newUsage({
        attributes: {
          period: usagePeriod,
          type: UsageType.Yearly,
        },
      });

      const fileWithIncreasedSize = newFile({
        attributes: {
          size: BigInt(300),
          createdAt: dateInSameYear,
        },
      });

      const expectedNewUsage = newUsage({
        attributes: {
          userId: user.uuid,
          delta: 200,
          type: UsageType.Replacement,
        },
      });

      jest
        .spyOn(usageRepository, 'getLatestTemporalUsage')
        .mockResolvedValue(existingYearlyUsage);
      jest.spyOn(usageRepository, 'create').mockResolvedValue(expectedNewUsage);

      const result = await service.addFileReplacementDelta(
        user,
        oldFile,
        fileWithIncreasedSize,
      );

      expect(result).toEqual(expectedNewUsage);
      expect(usageRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: user.uuid,
          delta: 200,
          type: UsageType.Replacement,
        }),
      );
    });

    it('When latest usage is daily and file was created within same day, then should create replacement usage', async () => {
      const usagePeriod = Time.now('2024-01-01T00:00:00.000Z');
      const dateInSameDay = Time.dateWithTimeAdded(2, 'hour', usagePeriod);

      const existingYearlyUsage = newUsage({
        attributes: {
          period: usagePeriod,
          type: UsageType.Daily,
        },
      });

      const fileWithIncreasedSize = newFile({
        attributes: {
          size: BigInt(300),
          createdAt: dateInSameDay,
        },
      });

      const expectedNewUsage = newUsage({
        attributes: {
          userId: user.uuid,
          delta: 200,
          type: UsageType.Replacement,
        },
      });

      jest
        .spyOn(usageRepository, 'getLatestTemporalUsage')
        .mockResolvedValue(existingYearlyUsage);
      jest.spyOn(usageRepository, 'create').mockResolvedValue(expectedNewUsage);

      const result = await service.addFileReplacementDelta(
        user,
        oldFile,
        fileWithIncreasedSize,
      );

      expect(result).toEqual(expectedNewUsage);
    });

    it('When latest usage is monthly and file was created within same month, then should create replacement usage', async () => {
      const usagePeriod = Time.now('2024-01-01T00:00:00.000Z');
      const dateInSameMonth = Time.dateWithTimeAdded(2, 'day', usagePeriod);

      const existingYearlyUsage = newUsage({
        attributes: {
          period: usagePeriod,
          type: UsageType.Monthly,
        },
      });

      const fileWithIncreasedSize = newFile({
        attributes: {
          size: BigInt(300),
          createdAt: dateInSameMonth,
        },
      });

      const expectedNewUsage = newUsage({
        attributes: {
          userId: user.uuid,
          delta: 200,
          type: UsageType.Replacement,
        },
      });

      jest
        .spyOn(usageRepository, 'getLatestTemporalUsage')
        .mockResolvedValue(existingYearlyUsage);
      jest.spyOn(usageRepository, 'create').mockResolvedValue(expectedNewUsage);

      const result = await service.addFileReplacementDelta(
        user,
        oldFile,
        fileWithIncreasedSize,
      );

      expect(result).toEqual(expectedNewUsage);
    });

    it('When latest usage is daily and file was created after the day, then should not create a replacement usage', async () => {
      const usagePeriod = Time.now('2024-06-15T00:00:00.000Z');
      const dayAfterUsage = Time.dateWithTimeAdded(2, 'day', usagePeriod);

      const existingUsage = newUsage({
        attributes: {
          period: usagePeriod,
          type: UsageType.Daily,
        },
      });

      const newFileData = newFile({
        attributes: {
          size: BigInt(200),
          createdAt: dayAfterUsage,
        },
      });

      jest
        .spyOn(usageRepository, 'getLatestTemporalUsage')
        .mockResolvedValue(existingUsage);

      const result = await service.addFileReplacementDelta(
        user,
        oldFile,
        newFileData,
      );

      expect(result).toBeNull();
      expect(usageRepository.create).not.toHaveBeenCalled();
    });

    it('When latest usage is monthy and file was created after the month, then should not create a replacement usage', async () => {
      const usagePeriod = Time.now('2024-06-15T00:00:00.000Z');
      const monthAfterUsage = Time.dateWithTimeAdded(2, 'month', usagePeriod);

      const existingUsage = newUsage({
        attributes: {
          period: usagePeriod,
          type: UsageType.Monthly,
        },
      });

      const newFileData = newFile({
        attributes: {
          size: BigInt(200),
          createdAt: monthAfterUsage,
        },
      });

      jest
        .spyOn(usageRepository, 'getLatestTemporalUsage')
        .mockResolvedValue(existingUsage);

      const result = await service.addFileReplacementDelta(
        user,
        oldFile,
        newFileData,
      );

      expect(result).toBeNull();
      expect(usageRepository.create).not.toHaveBeenCalled();
    });

    it('When latest usage is yearly and file was created after the year, then should not create a replacement usage', async () => {
      const usagePeriod = Time.now('2024-06-15T00:00:00.000Z');
      const yearAfterUsage = Time.dateWithTimeAdded(1, 'year', usagePeriod);

      const existingUsage = newUsage({
        attributes: {
          period: usagePeriod,
          type: UsageType.Yearly,
        },
      });

      const newFileData = newFile({
        attributes: {
          size: BigInt(200),
          createdAt: yearAfterUsage,
        },
      });

      jest
        .spyOn(usageRepository, 'getLatestTemporalUsage')
        .mockResolvedValue(existingUsage);

      const result = await service.addFileReplacementDelta(
        user,
        oldFile,
        newFileData,
      );

      expect(result).toBeNull();
      expect(usageRepository.create).not.toHaveBeenCalled();
    });

    it('When file was created within usage period, then should create replacement usage', async () => {
      const usagePeriod = Time.now('2024-06-15T08:00:00.000Z');
      const dateSameDayAsUsage = Time.now(usagePeriod);

      const existingUsage = newUsage({
        attributes: {
          period: usagePeriod,
          type: UsageType.Daily,
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
          type: UsageType.Replacement,
        },
      });

      jest
        .spyOn(usageRepository, 'getLatestTemporalUsage')
        .mockResolvedValue(existingUsage);
      jest.spyOn(usageRepository, 'create').mockResolvedValue(expectedUsage);

      const result = await service.addFileReplacementDelta(
        user,
        oldFile,
        newFileData,
      );

      expect(result).toEqual(expectedUsage);
      expect(usageRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: user.uuid,
          delta: 100,
          type: UsageType.Replacement,
        }),
      );
    });
  });

  describe('getMostRecentTemporalUsage', () => {
    it('When called, then it should return the most recent usage', async () => {
      const user = newUser();
      const usage = newUsage();

      jest
        .spyOn(usageRepository, 'getLatestTemporalUsage')
        .mockResolvedValue(usage);

      const result = await service.getMostRecentTemporalUsage(user.uuid);

      expect(result).toEqual(usage);
      expect(usageRepository.getLatestTemporalUsage).toHaveBeenCalledWith(
        user.uuid,
      );
    });
  });

  describe('createFirstUsageCalculation', () => {
    it('When called, then it should call the repository with expected arguments and return the first created usage', async () => {
      const user = newUser();
      const usage = newUsage();

      jest
        .spyOn(usageRepository, 'createFirstUsageCalculation')
        .mockResolvedValue(usage);

      const result = await service.calculateFirstTemporalUsage(user.uuid);

      expect(result).toEqual(usage);
      expect(usageRepository.createFirstUsageCalculation).toHaveBeenCalledWith(
        user.uuid,
      );
    });
  });

  describe('getMostRecentVersionUsage', () => {
    it('When called, then it should return the most recent version usage', async () => {
      const user = newUser();
      const usage = newUsage({ attributes: { type: UsageType.Version } });

      jest
        .spyOn(usageRepository, 'getLatestVersionUsage')
        .mockResolvedValue(usage);

      const result = await service.getMostRecentVersionUsage(user.uuid);

      expect(result).toEqual(usage);
      expect(usageRepository.getLatestVersionUsage).toHaveBeenCalledWith(
        user.uuid,
      );
    });

    it('When no version usage exists, then it should return null', async () => {
      const user = newUser();

      jest
        .spyOn(usageRepository, 'getLatestVersionUsage')
        .mockResolvedValue(null);

      const result = await service.getMostRecentVersionUsage(user.uuid);

      expect(result).toBeNull();
    });
  });

  describe('calculateFirstVersionUsage', () => {
    it('When called, then it should call the repository with userUuid', async () => {
      const user = newUser();
      const usage = newUsage({ attributes: { type: UsageType.Version } });

      jest
        .spyOn(usageRepository, 'createFirstVersionUsageCalculation')
        .mockResolvedValue(usage);

      const result = await service.calculateFirstVersionUsage(user.uuid);

      expect(result).toEqual(usage);
      expect(
        usageRepository.createFirstVersionUsageCalculation,
      ).toHaveBeenCalledWith(user.uuid);
    });
  });

  describe('calculateAggregatedVersionUsage', () => {
    it('When called, then it should return the aggregated version usage', async () => {
      const user = newUser();
      const aggregatedUsage = 5000;

      jest
        .spyOn(usageRepository, 'calculateAggregatedVersionUsage')
        .mockResolvedValue(aggregatedUsage);

      const result = await service.calculateAggregatedVersionUsage(user.uuid);

      expect(result).toEqual(aggregatedUsage);
      expect(
        usageRepository.calculateAggregatedVersionUsage,
      ).toHaveBeenCalledWith(user.uuid);
    });

    it('When no version usages exist, then it should return 0', async () => {
      const user = newUser();

      jest
        .spyOn(usageRepository, 'calculateAggregatedVersionUsage')
        .mockResolvedValue(0);

      const result = await service.calculateAggregatedVersionUsage(user.uuid);

      expect(result).toEqual(0);
    });
  });

  describe('createVersionUsage', () => {
    it('When called, then it should create a usage with type Version', async () => {
      const user = newUser();
      const period = new Date('2024-01-15T00:00:00Z');
      const delta = 1000;
      const expectedUsage = newUsage({
        attributes: {
          userId: user.uuid,
          period,
          delta,
          type: UsageType.Version,
        },
      });

      jest.spyOn(usageRepository, 'create').mockResolvedValue(expectedUsage);

      const result = await service.createVersionUsage(user.uuid, period, delta);

      expect(result).toEqual(expectedUsage);
      expect(usageRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: user.uuid,
          period,
          delta,
          type: UsageType.Version,
        }),
      );
    });

    it('When delta is negative, then it should create usage with negative delta', async () => {
      const user = newUser();
      const period = new Date('2024-01-15T00:00:00Z');
      const delta = -500;
      const expectedUsage = newUsage({
        attributes: {
          userId: user.uuid,
          period,
          delta,
          type: UsageType.Version,
        },
      });

      jest.spyOn(usageRepository, 'create').mockResolvedValue(expectedUsage);

      const result = await service.createVersionUsage(user.uuid, period, delta);

      expect(result).toEqual(expectedUsage);
      expect(usageRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          delta,
          type: UsageType.Version,
        }),
      );
    });

    it('When delta is zero, then it should create usage with zero delta', async () => {
      const user = newUser();
      const period = new Date('2024-01-15T00:00:00Z');
      const delta = 0;
      const expectedUsage = newUsage({
        attributes: {
          userId: user.uuid,
          period,
          delta,
          type: UsageType.Version,
        },
      });

      jest.spyOn(usageRepository, 'create').mockResolvedValue(expectedUsage);

      const result = await service.createVersionUsage(user.uuid, period, delta);

      expect(result).toEqual(expectedUsage);
      expect(usageRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          delta: 0,
        }),
      );
    });
  });
});
