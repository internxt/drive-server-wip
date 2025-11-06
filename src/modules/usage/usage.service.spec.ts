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
      const usagePeriod = new Date('2024-06-15T00:00:00.000Z');
      const dateBeforeUsage = new Date('2024-06-10T00:00:00.000Z');

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
      const usagePeriod = new Date('2024-06-15T00:00:00.000Z');
      const dateInSameYear = new Date('2024-01-10T00:00:00.000Z');

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
      const usagePeriod = new Date('2024-06-15T08:00:00.000Z');
      const dateSameDayAsUsage = new Date('2024-06-15T14:30:00.000Z');

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
});
