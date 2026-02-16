import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
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

    action = module.get<UndoFileVersioningAction>(UndoFileVersioningAction);
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
        .mockResolvedValueOnce(1000)
        .mockResolvedValueOnce(1000)
        .mockResolvedValueOnce(500);

      const result = await action.execute(userUuid);

      expect(result).toEqual({ deletedCount: 2500 });
      expect(
        fileVersionRepository.deleteUserVersionsBatch,
      ).toHaveBeenCalledWith(userUuid, 1000);
      expect(
        fileVersionRepository.deleteUserVersionsBatch,
      ).toHaveBeenCalledTimes(3);
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
        .mockResolvedValueOnce(1000)
        .mockResolvedValueOnce(1000)
        .mockResolvedValueOnce(1000)
        .mockResolvedValueOnce(300);

      const result = await action.execute(userUuid);

      expect(result).toEqual({ deletedCount: 3300 });
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
        .mockResolvedValueOnce(1000)
        .mockResolvedValueOnce(500);

      const result = await action.execute(userUuid);

      expect(result).toEqual({ deletedCount: 1500 });
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
        .mockResolvedValueOnce(1000)
        .mockResolvedValueOnce(500);

      const result = await action.execute(userUuid);

      expect(result).toEqual({ deletedCount: 1500 });
      expect(delaySpy).toHaveBeenCalledWith(1000);
      expect(delaySpy).toHaveBeenCalledWith(2000);
      expect(
        fileVersionRepository.deleteUserVersionsBatch,
      ).toHaveBeenCalledTimes(4);
    });

    it('When a batch fails 3 times, then should throw error with partial success info', async () => {
      const delaySpy = jest
        .spyOn(action as any, 'delay')
        .mockResolvedValue(undefined);

      jest
        .spyOn(fileVersionRepository, 'deleteUserVersionsBatch')
        .mockResolvedValueOnce(1000)
        .mockRejectedValueOnce(new Error('Corrupted data'))
        .mockRejectedValueOnce(new Error('Corrupted data'))
        .mockRejectedValueOnce(new Error('Corrupted data'));

      await expect(action.execute(userUuid)).rejects.toThrow(
        InternalServerErrorException,
      );

      expect(delaySpy).toHaveBeenCalledTimes(2);
      expect(delaySpy).toHaveBeenCalledWith(1000);
      expect(delaySpy).toHaveBeenCalledWith(2000);
      expect(
        fileVersionRepository.deleteUserVersionsBatch,
      ).toHaveBeenCalledTimes(4);
    });

    it('When batches fail, then delays should use exponential backoff', async () => {
      const delaySpy = jest
        .spyOn(action as any, 'delay')
        .mockResolvedValue(undefined);

      jest
        .spyOn(fileVersionRepository, 'deleteUserVersionsBatch')
        .mockRejectedValueOnce(new Error('Error'))
        .mockRejectedValueOnce(new Error('Error'))
        .mockRejectedValueOnce(new Error('Error'));

      await expect(action.execute(userUuid)).rejects.toThrow(
        InternalServerErrorException,
      );

      expect(delaySpy).toHaveBeenCalledTimes(2);
      expect(delaySpy).toHaveBeenNthCalledWith(1, 1000);
      expect(delaySpy).toHaveBeenNthCalledWith(2, 2000);
    });

    it('When limits are provided, then should delete versions exceeding limits', async () => {
      const limits = {
        retentionDays: 30,
        maxVersions: 5,
      };

      jest
        .spyOn(fileVersionRepository, 'deleteUserVersionsByLimits')
        .mockResolvedValueOnce(1000)
        .mockResolvedValueOnce(1000)
        .mockResolvedValueOnce(500);

      const result = await action.execute(userUuid, { limits });

      expect(result).toEqual({ deletedCount: 2500 });
      expect(
        fileVersionRepository.deleteUserVersionsByLimits,
      ).toHaveBeenCalledWith(userUuid, 30, 5, 1000);
      expect(
        fileVersionRepository.deleteUserVersionsByLimits,
      ).toHaveBeenCalledTimes(3);
    });

    it('When limits are provided with custom batch size, then should use custom batch size', async () => {
      const limits = {
        retentionDays: 60,
        maxVersions: 10,
      };
      const customBatchSize = 500;

      jest
        .spyOn(fileVersionRepository, 'deleteUserVersionsByLimits')
        .mockResolvedValueOnce(500)
        .mockResolvedValueOnce(200);

      const result = await action.execute(userUuid, {
        limits,
        batchSize: customBatchSize,
      });

      expect(result).toEqual({ deletedCount: 700 });
      expect(
        fileVersionRepository.deleteUserVersionsByLimits,
      ).toHaveBeenCalledWith(userUuid, 60, 10, customBatchSize);
    });

    it('When limits are provided and batch fails, then should retry', async () => {
      const limits = {
        retentionDays: 30,
        maxVersions: 5,
      };

      const delaySpy = jest
        .spyOn(action as any, 'delay')
        .mockResolvedValue(undefined);

      jest
        .spyOn(fileVersionRepository, 'deleteUserVersionsByLimits')
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce(1000)
        .mockResolvedValueOnce(500);

      const result = await action.execute(userUuid, { limits });

      expect(result).toEqual({ deletedCount: 1500 });
      expect(delaySpy).toHaveBeenCalledWith(1000);
      expect(
        fileVersionRepository.deleteUserVersionsByLimits,
      ).toHaveBeenCalledTimes(3);
    });

    it('When limits are provided and user has no versions to delete, then should return zero', async () => {
      const limits = {
        retentionDays: 30,
        maxVersions: 5,
      };

      jest
        .spyOn(fileVersionRepository, 'deleteUserVersionsByLimits')
        .mockResolvedValueOnce(0);

      const result = await action.execute(userUuid, { limits });

      expect(result).toEqual({ deletedCount: 0 });
      expect(
        fileVersionRepository.deleteUserVersionsByLimits,
      ).toHaveBeenCalledTimes(1);
    });
  });
});
