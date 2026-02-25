import { Test, type TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { DeleteExpiredFileVersionsAction } from './delete-expired-file-versions.action';
import { SequelizeFileVersionRepository } from '../file-version.repository';
import { FileVersionStatus } from '../file-version.domain';

describe('DeleteExpiredFileVersionsAction', () => {
  let action: DeleteExpiredFileVersionsAction;
  let fileVersionRepository: SequelizeFileVersionRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteExpiredFileVersionsAction,
        {
          provide: SequelizeFileVersionRepository,
          useValue: createMock<SequelizeFileVersionRepository>(),
        },
      ],
    }).compile();

    action = module.get<DeleteExpiredFileVersionsAction>(
      DeleteExpiredFileVersionsAction,
    );
    fileVersionRepository = module.get<SequelizeFileVersionRepository>(
      SequelizeFileVersionRepository,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(action).toBeDefined();
  });

  describe('execute', () => {
    it('When no expired versions exist, then should return 0 deleted', async () => {
      jest
        .spyOn(fileVersionRepository, 'findExpiredVersionIdsByTierLimits')
        .mockResolvedValue([]);

      const result = await action.execute();

      expect(result).toEqual({ deletedCount: 0 });
      expect(
        fileVersionRepository.findExpiredVersionIdsByTierLimits,
      ).toHaveBeenCalledWith(100);
      expect(fileVersionRepository.updateStatusBatch).not.toHaveBeenCalled();
    });

    it('When expired versions exist, then should process all in batches', async () => {
      const batch1 = Array.from({ length: 100 }, (_, i) => `version-${i}`);
      const batch2 = Array.from(
        { length: 100 },
        (_, i) => `version-${i + 100}`,
      );
      const batch3 = Array.from({ length: 50 }, (_, i) => `version-${i + 200}`);

      jest
        .spyOn(fileVersionRepository, 'findExpiredVersionIdsByTierLimits')
        .mockResolvedValueOnce(batch1)
        .mockResolvedValueOnce(batch2)
        .mockResolvedValueOnce(batch3);

      jest
        .spyOn(fileVersionRepository, 'updateStatusBatch')
        .mockResolvedValue();

      const result = await action.execute();

      expect(result).toEqual({ deletedCount: 250 });
      expect(
        fileVersionRepository.findExpiredVersionIdsByTierLimits,
      ).toHaveBeenCalledTimes(3);
      expect(fileVersionRepository.updateStatusBatch).toHaveBeenCalledTimes(3);
      expect(fileVersionRepository.updateStatusBatch).toHaveBeenNthCalledWith(
        1,
        batch1,
        FileVersionStatus.DELETED,
      );
      expect(fileVersionRepository.updateStatusBatch).toHaveBeenNthCalledWith(
        2,
        batch2,
        FileVersionStatus.DELETED,
      );
      expect(fileVersionRepository.updateStatusBatch).toHaveBeenNthCalledWith(
        3,
        batch3,
        FileVersionStatus.DELETED,
      );
    });

    it('When custom batch size is provided, then should use that batch size', async () => {
      const batch1 = Array.from({ length: 50 }, (_, i) => `version-${i}`);
      const batch2 = Array.from({ length: 30 }, (_, i) => `version-${i + 50}`);

      jest
        .spyOn(fileVersionRepository, 'findExpiredVersionIdsByTierLimits')
        .mockResolvedValueOnce(batch1)
        .mockResolvedValueOnce(batch2);

      jest
        .spyOn(fileVersionRepository, 'updateStatusBatch')
        .mockResolvedValue();

      const result = await action.execute({ batchSize: 50 });

      expect(result).toEqual({ deletedCount: 80 });
      expect(
        fileVersionRepository.findExpiredVersionIdsByTierLimits,
      ).toHaveBeenCalledTimes(2);
      expect(
        fileVersionRepository.findExpiredVersionIdsByTierLimits,
      ).toHaveBeenCalledWith(50);
    });

    it('When single batch with less than batch size, then should stop after one iteration', async () => {
      const batch = Array.from({ length: 30 }, (_, i) => `version-${i}`);

      jest
        .spyOn(fileVersionRepository, 'findExpiredVersionIdsByTierLimits')
        .mockResolvedValueOnce(batch);

      jest
        .spyOn(fileVersionRepository, 'updateStatusBatch')
        .mockResolvedValue();

      const result = await action.execute();

      expect(result).toEqual({ deletedCount: 30 });
      expect(
        fileVersionRepository.findExpiredVersionIdsByTierLimits,
      ).toHaveBeenCalledTimes(1);
      expect(fileVersionRepository.updateStatusBatch).toHaveBeenCalledTimes(1);
    });

    it('When exactly batch size returned, then should check for more batches', async () => {
      const batch1 = Array.from({ length: 100 }, (_, i) => `version-${i}`);

      jest
        .spyOn(fileVersionRepository, 'findExpiredVersionIdsByTierLimits')
        .mockResolvedValueOnce(batch1)
        .mockResolvedValueOnce([]);

      jest
        .spyOn(fileVersionRepository, 'updateStatusBatch')
        .mockResolvedValue();

      const result = await action.execute();

      expect(result).toEqual({ deletedCount: 100 });
      expect(
        fileVersionRepository.findExpiredVersionIdsByTierLimits,
      ).toHaveBeenCalledTimes(2);
    });

    it('When processing multiple batches, then should accumulate count correctly', async () => {
      const batches = [
        Array.from({ length: 100 }, (_, i) => `v-${i}`),
        Array.from({ length: 100 }, (_, i) => `v-${i + 100}`),
        Array.from({ length: 100 }, (_, i) => `v-${i + 200}`),
        Array.from({ length: 100 }, (_, i) => `v-${i + 300}`),
        Array.from({ length: 25 }, (_, i) => `v-${i + 400}`),
      ];

      jest
        .spyOn(fileVersionRepository, 'findExpiredVersionIdsByTierLimits')
        .mockResolvedValueOnce(batches[0])
        .mockResolvedValueOnce(batches[1])
        .mockResolvedValueOnce(batches[2])
        .mockResolvedValueOnce(batches[3])
        .mockResolvedValueOnce(batches[4]);

      jest
        .spyOn(fileVersionRepository, 'updateStatusBatch')
        .mockResolvedValue();

      const result = await action.execute();

      expect(result).toEqual({ deletedCount: 425 });
      expect(
        fileVersionRepository.findExpiredVersionIdsByTierLimits,
      ).toHaveBeenCalledTimes(5);
      expect(fileVersionRepository.updateStatusBatch).toHaveBeenCalledTimes(5);
    });
  });
});
