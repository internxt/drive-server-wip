import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { UndoFileVersioningAction } from './undo-file-versioning.action';
import { SequelizeFileVersionRepository } from '../file-version.repository';
import { v4 } from 'uuid';

describe('UndoFileVersioningAction', () => {
  let action: UndoFileVersioningAction;
  let fileVersionRepository: SequelizeFileVersionRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UndoFileVersioningAction,
        {
          provide: SequelizeFileVersionRepository,
          useValue: createMock<SequelizeFileVersionRepository>(),
        },
      ],
    }).compile();

    action = module.get<UndoFileVersioningAction>(
      UndoFileVersioningAction,
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
    const userUuid = v4();

    it('When versioning is disabled, then should delete all user versions', async () => {
      jest
        .spyOn(fileVersionRepository, 'deleteUserVersionsBatch')
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(0);

      const result = await action.execute(userUuid);

      expect(result).toEqual({ deletedCount: 150 });
      expect(
        fileVersionRepository.deleteUserVersionsBatch,
      ).toHaveBeenCalledWith(userUuid, 100);
    });

    it('When versioning is disabled and user has no versions, then should return zero deleted', async () => {
      jest
        .spyOn(fileVersionRepository, 'deleteUserVersionsBatch')
        .mockResolvedValueOnce(0);

      const result = await action.execute(userUuid);

      expect(result).toEqual({ deletedCount: 0 });
      expect(
        fileVersionRepository.deleteUserVersionsBatch,
      ).toHaveBeenCalledTimes(1);
    });

    it('When custom batch size is provided, then should use that batch size', async () => {
      const customBatchSize = 50;

      jest
        .spyOn(fileVersionRepository, 'deleteUserVersionsBatch')
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(25)
        .mockResolvedValueOnce(0);

      const result = await action.execute(userUuid, {
        batchSize: customBatchSize,
      });

      expect(result).toEqual({ deletedCount: 75 });
      expect(
        fileVersionRepository.deleteUserVersionsBatch,
      ).toHaveBeenCalledWith(userUuid, customBatchSize);
    });

    it('When deleting in batches, then should continue until batch returns less than batch size', async () => {
      jest
        .spyOn(fileVersionRepository, 'deleteUserVersionsBatch')
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(30);

      const result = await action.execute(userUuid);

      expect(result).toEqual({ deletedCount: 330 });
      expect(
        fileVersionRepository.deleteUserVersionsBatch,
      ).toHaveBeenCalledTimes(4);
    });

    it('When a batch fails once, then should retry and succeed', async () => {
      const delaySpy = jest
        .spyOn(action as any, 'delay')
        .mockResolvedValue(undefined);

      jest
        .spyOn(fileVersionRepository, 'deleteUserVersionsBatch')
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(50);

      const result = await action.execute(userUuid);

      expect(result).toEqual({ deletedCount: 150 });
      expect(delaySpy).toHaveBeenCalledWith(1000);
      expect(
        fileVersionRepository.deleteUserVersionsBatch,
      ).toHaveBeenCalledTimes(3);
    });

    it('When a batch fails twice, then should retry twice and succeed on third attempt', async () => {
      const delaySpy = jest
        .spyOn(action as any, 'delay')
        .mockResolvedValue(undefined);

      jest
        .spyOn(fileVersionRepository, 'deleteUserVersionsBatch')
        .mockRejectedValueOnce(new Error('Lock timeout'))
        .mockRejectedValueOnce(new Error('Lock timeout'))
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(0);

      const result = await action.execute(userUuid);

      expect(result).toEqual({ deletedCount: 100 });
      expect(delaySpy).toHaveBeenCalledWith(1000);
      expect(delaySpy).toHaveBeenCalledWith(2000);
      expect(
        fileVersionRepository.deleteUserVersionsBatch,
      ).toHaveBeenCalledTimes(4);
    });

    it('When a batch fails 3 times, then should skip that batch and continue with next batches', async () => {
      const delaySpy = jest
        .spyOn(action as any, 'delay')
        .mockResolvedValue(undefined);

      jest
        .spyOn(fileVersionRepository, 'deleteUserVersionsBatch')
        .mockResolvedValueOnce(100)
        .mockRejectedValueOnce(new Error('Corrupted data'))
        .mockRejectedValueOnce(new Error('Corrupted data'))
        .mockRejectedValueOnce(new Error('Corrupted data'))
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(50);

      const result = await action.execute(userUuid);

      expect(result).toEqual({ deletedCount: 250 });
      expect(delaySpy).toHaveBeenCalledTimes(2);
      expect(delaySpy).toHaveBeenCalledWith(1000);
      expect(delaySpy).toHaveBeenCalledWith(2000);
      expect(
        fileVersionRepository.deleteUserVersionsBatch,
      ).toHaveBeenCalledTimes(6);
    });

    it('When batches fail, then delays should use exponential backoff', async () => {
      const delaySpy = jest
        .spyOn(action as any, 'delay')
        .mockResolvedValue(undefined);

      jest
        .spyOn(fileVersionRepository, 'deleteUserVersionsBatch')
        .mockRejectedValueOnce(new Error('Error'))
        .mockRejectedValueOnce(new Error('Error'))
        .mockRejectedValueOnce(new Error('Error'))
        .mockResolvedValueOnce(0);

      await action.execute(userUuid);

      expect(delaySpy).toHaveBeenCalledTimes(2);
      expect(delaySpy).toHaveBeenNthCalledWith(1, 1000);
      expect(delaySpy).toHaveBeenNthCalledWith(2, 2000);
    });
  });
});
