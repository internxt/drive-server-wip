import { Test, type TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { DeleteExpiredFileVersionsAction } from './delete-expired-file-versions.action';
import { SequelizeFileVersionRepository } from '../file-version.repository';
import { FileVersionStatus } from '../file-version.domain';

const buildExpiredVersions = (
  count: number,
  offset = 0,
  userId = 'user-uuid',
) =>
  Array.from({ length: count }, (_, i) => ({
    id: `version-${i + offset}`,
    userId,
    createdAt: `2026-01-01 00:00:00.${String(i + offset).padStart(6, '0')}+00`,
  }));

const toIds = (versions: { id: string }[]) => versions.map((v) => v.id);

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
      ).toHaveBeenCalledWith(101, undefined);
      expect(fileVersionRepository.updateStatusBatch).not.toHaveBeenCalled();
    });

    it('When expired versions exist, then should process all in batches', async () => {
      const response1 = buildExpiredVersions(101);
      const response2 = buildExpiredVersions(101, 100);
      const response3 = buildExpiredVersions(50, 200);

      jest
        .spyOn(fileVersionRepository, 'findExpiredVersionIdsByTierLimits')
        .mockResolvedValueOnce(response1)
        .mockResolvedValueOnce(response2)
        .mockResolvedValueOnce(response3);
      jest
        .spyOn(fileVersionRepository, 'updateStatusBatch')
        .mockResolvedValue();

      const result = await action.execute();

      expect(result).toEqual({ deletedCount: 250 });
      expect(
        fileVersionRepository.findExpiredVersionIdsByTierLimits,
      ).toHaveBeenCalledTimes(3);
      expect(fileVersionRepository.updateStatusBatch).toHaveBeenNthCalledWith(
        1,
        toIds(response1.slice(0, 100)),
        FileVersionStatus.DELETED,
      );
      expect(fileVersionRepository.updateStatusBatch).toHaveBeenNthCalledWith(
        2,
        toIds(response2.slice(0, 100)),
        FileVersionStatus.DELETED,
      );
      expect(fileVersionRepository.updateStatusBatch).toHaveBeenNthCalledWith(
        3,
        toIds(response3),
        FileVersionStatus.DELETED,
      );
    });

    it('When custom batch size is provided, then should request one extra row over that batch size', async () => {
      const response1 = buildExpiredVersions(51);
      const response2 = buildExpiredVersions(30, 50);

      jest
        .spyOn(fileVersionRepository, 'findExpiredVersionIdsByTierLimits')
        .mockResolvedValueOnce(response1)
        .mockResolvedValueOnce(response2);
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
      ).toHaveBeenNthCalledWith(1, 51, undefined);
    });

    it('When exactly batch size is returned, then should stop without an extra query', async () => {
      const response = buildExpiredVersions(100);

      jest
        .spyOn(fileVersionRepository, 'findExpiredVersionIdsByTierLimits')
        .mockResolvedValueOnce(response);
      jest
        .spyOn(fileVersionRepository, 'updateStatusBatch')
        .mockResolvedValue();

      const result = await action.execute();

      expect(result).toEqual({ deletedCount: 100 });
      expect(
        fileVersionRepository.findExpiredVersionIdsByTierLimits,
      ).toHaveBeenCalledTimes(1);
      expect(fileVersionRepository.updateStatusBatch).toHaveBeenCalledWith(
        toIds(response),
        FileVersionStatus.DELETED,
      );
    });

    it('When more rows than batch size are returned, then should not delete the extra row', async () => {
      const response1 = buildExpiredVersions(101);
      const response2 = buildExpiredVersions(1, 100);

      jest
        .spyOn(fileVersionRepository, 'findExpiredVersionIdsByTierLimits')
        .mockResolvedValueOnce(response1)
        .mockResolvedValueOnce(response2);
      jest
        .spyOn(fileVersionRepository, 'updateStatusBatch')
        .mockResolvedValue();

      const result = await action.execute();

      expect(result).toEqual({ deletedCount: 101 });
      expect(fileVersionRepository.updateStatusBatch).toHaveBeenNthCalledWith(
        1,
        toIds(response1.slice(0, 100)),
        FileVersionStatus.DELETED,
      );
      expect(fileVersionRepository.updateStatusBatch).toHaveBeenNthCalledWith(
        2,
        toIds(response2),
        FileVersionStatus.DELETED,
      );
    });

    it('When there are more rows, then should request the next batch from the last processed version', async () => {
      const response1 = [
        ...buildExpiredVersions(60, 0, 'user-a'),
        ...buildExpiredVersions(41, 60, 'user-b'),
      ];
      const response2 = buildExpiredVersions(10, 100, 'user-b');
      const lastProcessed = response1[99];

      jest
        .spyOn(fileVersionRepository, 'findExpiredVersionIdsByTierLimits')
        .mockResolvedValueOnce(response1)
        .mockResolvedValueOnce(response2);
      jest
        .spyOn(fileVersionRepository, 'updateStatusBatch')
        .mockResolvedValue();

      await action.execute();

      expect(
        fileVersionRepository.findExpiredVersionIdsByTierLimits,
      ).toHaveBeenNthCalledWith(1, 101, undefined);
      expect(
        fileVersionRepository.findExpiredVersionIdsByTierLimits,
      ).toHaveBeenNthCalledWith(2, 101, {
        userId: 'user-b',
        createdAt: lastProcessed.createdAt,
      });
    });

    it('When a single user has more expired versions than batch size, then should keep the cursor on that user', async () => {
      const response1 = buildExpiredVersions(101, 0, 'user-a');
      const response2 = buildExpiredVersions(20, 100, 'user-a');

      jest
        .spyOn(fileVersionRepository, 'findExpiredVersionIdsByTierLimits')
        .mockResolvedValueOnce(response1)
        .mockResolvedValueOnce(response2);
      jest
        .spyOn(fileVersionRepository, 'updateStatusBatch')
        .mockResolvedValue();

      const result = await action.execute();

      expect(result).toEqual({ deletedCount: 120 });
      expect(
        fileVersionRepository.findExpiredVersionIdsByTierLimits,
      ).toHaveBeenNthCalledWith(2, 101, {
        userId: 'user-a',
        createdAt: response1[99].createdAt,
      });
    });
  });
});
