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

    it('When file is created today, then should return null', async () => {
      const existingUsage = newUsage();
      const todayFile = newFile({
        attributes: {
          size: BigInt(200),
          createdAt: new Date(),
        },
      });

      jest
        .spyOn(usageRepository, 'getLatestTemporalUsage')
        .mockResolvedValue(existingUsage);

      const result = await service.addFileReplacementDelta(
        user,
        oldFile,
        todayFile,
      );

      expect(result).toBeNull();
    });

    it('When file size increased and not created today, then should create replacement usage with positive delta', async () => {
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
        yesterdayFile,
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

    it('When file size decreased and not created today, then should create replacement usage with negative delta', async () => {
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
        yesterdayFile,
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
