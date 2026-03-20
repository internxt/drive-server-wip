import { Test, type TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import {
  UsageQueueProcessor,
  type UsageJobData,
} from './usage-queue.processor';
import { FileUseCases } from '../file/file.usecase';
import { BackupUseCase } from '../backups/backup.usecase';
import { CacheManagerService } from '../cache-manager/cache-manager.service';
import { type Job } from 'bullmq';
import { v4 } from 'uuid';

describe('UsageQueueProcessor', () => {
  let processor: UsageQueueProcessor;
  let fileUseCases: FileUseCases;
  let backupUseCases: BackupUseCase;
  let cacheManager: CacheManagerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsageQueueProcessor,
        {
          provide: FileUseCases,
          useValue: createMock<FileUseCases>(),
        },
        {
          provide: BackupUseCase,
          useValue: createMock<BackupUseCase>(),
        },
        {
          provide: CacheManagerService,
          useValue: createMock<CacheManagerService>(),
        },
      ],
    }).compile();

    processor = module.get(UsageQueueProcessor);
    fileUseCases = module.get(FileUseCases);
    backupUseCases = module.get(BackupUseCase);
    cacheManager = module.get(CacheManagerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('When processing a job, then it should compute usage and cache it', async () => {
    const userUuid = v4();
    const userId = 42;
    const driveUsage = 1024;
    const backupUsage = 512;

    jest
      .spyOn(fileUseCases, 'getUserUsedStorage')
      .mockResolvedValue(driveUsage);
    jest
      .spyOn(backupUseCases, 'sumExistentBackupSizes')
      .mockResolvedValue(backupUsage);

    const job = {
      data: { userUuid, userId, source: 'file.create' },
    } as Job<UsageJobData>;

    await processor.process(job);

    expect(fileUseCases.getUserUsedStorage).toHaveBeenCalledWith(
      expect.objectContaining({ uuid: userUuid, id: userId }),
    );
    expect(backupUseCases.sumExistentBackupSizes).toHaveBeenCalledWith(userId);
    expect(cacheManager.setUserUsage).toHaveBeenCalledWith(
      userUuid,
      driveUsage,
      backupUsage,
    );
  });

  it('When drive and backup queries run, then they should run in parallel', async () => {
    const userUuid = v4();
    const callOrder: string[] = [];

    jest.spyOn(fileUseCases, 'getUserUsedStorage').mockImplementation(
      () =>
        new Promise((resolve) => {
          callOrder.push('drive-start');
          setTimeout(() => {
            callOrder.push('drive-end');
            resolve(100);
          }, 10);
        }),
    );
    jest.spyOn(backupUseCases, 'sumExistentBackupSizes').mockImplementation(
      () =>
        new Promise((resolve) => {
          callOrder.push('backup-start');
          setTimeout(() => {
            callOrder.push('backup-end');
            resolve(50);
          }, 10);
        }),
    );

    await processor.process({
      data: { userUuid, userId: 1, source: 'test' },
    } as Job<UsageJobData>);

    expect(callOrder[0]).toBe('drive-start');
    expect(callOrder[1]).toBe('backup-start');
  });
});
