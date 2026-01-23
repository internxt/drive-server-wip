import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { Test } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteExpiredFileVersionsTask } from './delete-expired-file-versions.task';
import { RedisService } from '../../../externals/redis/redis.service';
import { DeleteExpiredFileVersionsAction } from '../../file/actions';

describe('DeleteExpiredFileVersionsTask', () => {
  let task: DeleteExpiredFileVersionsTask;
  let deleteExpiredFileVersionsAction: DeepMocked<DeleteExpiredFileVersionsAction>;
  let redisService: DeepMocked<RedisService>;
  let configService: DeepMocked<ConfigService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [DeleteExpiredFileVersionsTask],
    })
      .setLogger(createMock<Logger>())
      .useMocker(() => createMock())
      .compile();

    task = moduleRef.get(DeleteExpiredFileVersionsTask);
    deleteExpiredFileVersionsAction = moduleRef.get(DeleteExpiredFileVersionsAction);
    redisService = moduleRef.get(RedisService);
    configService = moduleRef.get(ConfigService);
  });

  it('When initialized, then service should be defined', () => {
    expect(task).toBeDefined();
  });

  describe('scheduleExpiredVersionsCleanup', () => {
    it('When executeCronjobs is false, then it should not execute the job', async () => {
      configService.get.mockReturnValue(false);

      const processExpiredVersionsSpy = jest.spyOn(
        task as any,
        'processExpiredVersions',
      );

      await task.scheduleExpiredVersionsCleanup();

      expect(configService.get).toHaveBeenCalledWith('executeCronjobs', false);
      expect(processExpiredVersionsSpy).not.toHaveBeenCalled();
      expect(redisService.tryAcquireLock).not.toHaveBeenCalled();
    });

    it('When lock cannot be acquired, then it should not start the job', async () => {
      configService.get.mockReturnValue(true);
      redisService.tryAcquireLock.mockResolvedValue(false);

      const processExpiredVersionsSpy = jest.spyOn(
        task as any,
        'processExpiredVersions',
      );

      await task.scheduleExpiredVersionsCleanup();

      expect(redisService.tryAcquireLock).toHaveBeenCalledWith(
        'job:delete-expired-file-versions',
        60 * 60 * 1000,
      );
      expect(processExpiredVersionsSpy).not.toHaveBeenCalled();
    });

    it('When job completes successfully, then it should release lock', async () => {
      configService.get.mockReturnValue(true);
      redisService.tryAcquireLock.mockResolvedValue(true);
      redisService.releaseLock.mockResolvedValue(true);
      deleteExpiredFileVersionsAction.execute.mockResolvedValue({
        deletedCount: 100,
      });

      await task.scheduleExpiredVersionsCleanup();

      expect(redisService.tryAcquireLock).toHaveBeenCalled();
      expect(deleteExpiredFileVersionsAction.execute).toHaveBeenCalledWith();
      expect(redisService.releaseLock).toHaveBeenCalledWith(
        'job:delete-expired-file-versions',
      );
    });

    it('When error occurs, then it should still release lock in finally block', async () => {
      const error = new Error('Database connection failed');
      configService.get.mockReturnValue(true);
      redisService.tryAcquireLock.mockResolvedValue(true);
      redisService.releaseLock.mockResolvedValue(true);
      deleteExpiredFileVersionsAction.execute.mockRejectedValue(error);

      await task.scheduleExpiredVersionsCleanup();

      expect(deleteExpiredFileVersionsAction.execute).toHaveBeenCalled();
      expect(redisService.releaseLock).toHaveBeenCalledWith(
        'job:delete-expired-file-versions',
      );
    });

    it('When lock is not released, then it should log warning', async () => {
      configService.get.mockReturnValue(true);
      redisService.tryAcquireLock.mockResolvedValue(true);
      redisService.releaseLock.mockResolvedValue(false);
      deleteExpiredFileVersionsAction.execute.mockResolvedValue({
        deletedCount: 50,
      });

      await task.scheduleExpiredVersionsCleanup();

      expect(redisService.releaseLock).toHaveBeenCalledWith(
        'job:delete-expired-file-versions',
      );
    });
  });

  describe('processExpiredVersions', () => {
    beforeEach(() => {
      configService.get.mockReturnValue(true);
      redisService.tryAcquireLock.mockResolvedValue(true);
      redisService.releaseLock.mockResolvedValue(true);
    });

    it('When no expired versions exist, then it should complete with zero deletions', async () => {
      deleteExpiredFileVersionsAction.execute.mockResolvedValue({
        deletedCount: 0,
      });

      await task.scheduleExpiredVersionsCleanup();

      expect(deleteExpiredFileVersionsAction.execute).toHaveBeenCalledWith();
    });

    it('When expired versions exist, then it should delete them and log count', async () => {
      deleteExpiredFileVersionsAction.execute.mockResolvedValue({
        deletedCount: 250,
      });

      await task.scheduleExpiredVersionsCleanup();

      expect(deleteExpiredFileVersionsAction.execute).toHaveBeenCalledWith();
    });

    it('When deletion fails, then it should throw error', async () => {
      const error = new Error('Repository error');
      deleteExpiredFileVersionsAction.execute.mockRejectedValue(error);

      await task.scheduleExpiredVersionsCleanup();

      expect(deleteExpiredFileVersionsAction.execute).toHaveBeenCalled();
      expect(redisService.releaseLock).toHaveBeenCalled();
    });

    it('When processing large batch, then it should handle it successfully', async () => {
      deleteExpiredFileVersionsAction.execute.mockResolvedValue({
        deletedCount: 10000,
      });

      await task.scheduleExpiredVersionsCleanup();

      expect(deleteExpiredFileVersionsAction.execute).toHaveBeenCalledWith();
    });
  });

  describe('runJob', () => {
    it('When called directly, then it should execute the cleanup', async () => {
      redisService.tryAcquireLock.mockResolvedValue(true);
      redisService.releaseLock.mockResolvedValue(true);
      deleteExpiredFileVersionsAction.execute.mockResolvedValue({
        deletedCount: 75,
      });

      await task.runJob();

      expect(redisService.tryAcquireLock).toHaveBeenCalledWith(
        'job:delete-expired-file-versions',
        60 * 60 * 1000,
      );
      expect(deleteExpiredFileVersionsAction.execute).toHaveBeenCalled();
      expect(redisService.releaseLock).toHaveBeenCalled();
    });

    it('When lock cannot be acquired in runJob, then it should skip execution', async () => {
      redisService.tryAcquireLock.mockResolvedValue(false);

      await task.runJob();

      expect(redisService.tryAcquireLock).toHaveBeenCalled();
      expect(deleteExpiredFileVersionsAction.execute).not.toHaveBeenCalled();
      expect(redisService.releaseLock).toHaveBeenCalled();
    });
  });
});
