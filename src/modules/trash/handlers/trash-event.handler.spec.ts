import { createMock } from '@golevelup/ts-jest';
import { type Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TrashEventHandler } from './trash-event.handler';
import { TrashUseCases } from '../trash.usecase';
import { RedisService } from '../../../externals/redis/redis.service';
import { TrashEmptyRequestedEvent } from '../events/trash-empty-requested.event';
import { newUser } from '../../../../test/fixtures';

describe('TrashEventHandler', () => {
  let handler: TrashEventHandler;
  let trashUseCases: TrashUseCases;
  let redisService: RedisService;

  const user = newUser();
  const trashedFilesNumber = 10;
  const trashedFoldersNumber = 5;
  const lockKey = `empty-trash-lock:${user.id}`;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [TrashEventHandler],
    })
      .setLogger(createMock<Logger>())
      .useMocker(() => createMock())
      .compile();

    handler = moduleRef.get(TrashEventHandler);
    trashUseCases = moduleRef.get(TrashUseCases);
    redisService = moduleRef.get(RedisService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  describe('handleEmptyTrashRequested', () => {
    const createEvent = () =>
      new TrashEmptyRequestedEvent(
        user,
        trashedFilesNumber,
        trashedFoldersNumber,
      );

    it('When lock is acquired and deletion succeeds, then it should complete successfully and release lock', async () => {
      const event = createEvent();
      jest.spyOn(redisService, 'tryAcquireLock').mockResolvedValue(true);
      jest.spyOn(trashUseCases, 'performTrashDeletion').mockResolvedValue();
      jest.spyOn(redisService, 'releaseLock').mockResolvedValue(true);

      await handler.handleEmptyTrashRequested(event);

      expect(redisService.tryAcquireLock).toHaveBeenCalledWith(lockKey, 2000);
      expect(trashUseCases.performTrashDeletion).toHaveBeenCalledWith(
        user,
        trashedFilesNumber,
        trashedFoldersNumber,
        1000,
      );
      expect(redisService.releaseLock).toHaveBeenCalledWith(lockKey);
    });

    it('When lock cannot be acquired, then it should return early without processing', async () => {
      const event = createEvent();
      jest.spyOn(redisService, 'tryAcquireLock').mockResolvedValue(false);
      jest.spyOn(trashUseCases, 'performTrashDeletion');
      jest.spyOn(redisService, 'releaseLock');

      await handler.handleEmptyTrashRequested(event);

      expect(redisService.tryAcquireLock).toHaveBeenCalledWith(lockKey, 2000);
      expect(trashUseCases.performTrashDeletion).not.toHaveBeenCalled();
      expect(redisService.releaseLock).not.toHaveBeenCalled();
    });

    it('When trash deletion throws error, then it should release lock', async () => {
      const event = createEvent();
      const deletionError = new Error('Database connection failed');
      jest.spyOn(redisService, 'tryAcquireLock').mockResolvedValue(true);
      jest
        .spyOn(trashUseCases, 'performTrashDeletion')
        .mockRejectedValue(deletionError);
      jest.spyOn(redisService, 'releaseLock').mockResolvedValue(true);

      await handler.handleEmptyTrashRequested(event);

      expect(redisService.tryAcquireLock).toHaveBeenCalledWith(lockKey, 2000);
      expect(trashUseCases.performTrashDeletion).toHaveBeenCalledWith(
        user,
        trashedFilesNumber,
        trashedFoldersNumber,
        1000,
      );
      expect(redisService.releaseLock).toHaveBeenCalledWith(lockKey);
    });

    it('When lock release fails, then it should handle error gracefully', async () => {
      const event = createEvent();
      const lockReleaseError = new Error('Redis connection lost');
      jest.spyOn(redisService, 'tryAcquireLock').mockResolvedValue(true);
      jest.spyOn(trashUseCases, 'performTrashDeletion').mockResolvedValue();
      jest
        .spyOn(redisService, 'releaseLock')
        .mockRejectedValue(lockReleaseError);

      await handler.handleEmptyTrashRequested(event);

      expect(redisService.tryAcquireLock).toHaveBeenCalledWith(lockKey, 2000);
      expect(trashUseCases.performTrashDeletion).toHaveBeenCalledWith(
        user,
        trashedFilesNumber,
        trashedFoldersNumber,
        1000,
      );
      expect(redisService.releaseLock).toHaveBeenCalledWith(lockKey);
    });

    it('When lock system is unavailable, then it should proceed without lock', async () => {
      const event = createEvent();
      const redisError = new Error('Redis connection failed');
      jest.spyOn(redisService, 'tryAcquireLock').mockRejectedValue(redisError);
      jest.spyOn(trashUseCases, 'performTrashDeletion').mockResolvedValue();

      await handler.handleEmptyTrashRequested(event);

      expect(redisService.tryAcquireLock).toHaveBeenCalledWith(lockKey, 2000);
      expect(trashUseCases.performTrashDeletion).toHaveBeenCalledWith(
        user,
        trashedFilesNumber,
        trashedFoldersNumber,
        1000,
      );
    });
  });
});
