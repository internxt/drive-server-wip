import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue, OnWorkerEvent } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { SequelizeJobExecutionRepository } from '../repositories/job-execution.repository';
import { SequelizeFolderRepository } from '../../folder/folder.repository';
import { SequelizeFileRepository } from '../../file/file.repository';
import { JobName } from '../constants';
import { JobExecutionModel } from '../models/job-execution.model';

const HOUR_IN_MS = 60 * 60 * 1000;
const JOB_INTERVAL = 4 * HOUR_IN_MS;

@Processor('cleanup-process', { maxStalledCount: 0 })
@Injectable()
export class DeletedItemsCleanupTask
  extends WorkerHost
  implements OnModuleInit
{
  private readonly logger = new Logger(DeletedItemsCleanupTask.name);

  constructor(
    @InjectQueue('cleanup-process')
    private readonly cleanupQueue: Queue,
    private readonly jobExecutionRepository: SequelizeJobExecutionRepository,
    private readonly folderRepository: SequelizeFolderRepository,
    private readonly fileRepository: SequelizeFileRepository,
  ) {
    super();
  }

  async onModuleInit() {
    this.setupJobScheduler();
  }

  async process(job: Job) {
    this.logger.log(`Cleanup job process received ${job.id}`);

    const { startDate, untilDate, startedJob } =
      await this.initializeJobExecution(job);

    this.logger.log(`Starting cleanup job from ${startDate} to ${untilDate})}`);

    try {
      this.logger.log('Phase 1: Starting to process undeleted folders');

      for await (const folderUuids of this.yieldDeletedFoldersWithActiveChildren(
        startDate,
        untilDate,
        100,
      )) {
        if (folderUuids.length === 0) {
          this.logger.log(
            'No more deleted folders with undeleted folders to process',
          );
          break;
        }

        await this.folderRepository.markChildFoldersAsRemoved(folderUuids);
      }

      this.logger.log('Phase 2: Starting to process files');

      for await (const folderUuids of this.yieldDeletedFoldersWithActiveFiles(
        startDate,
        untilDate,
        100,
      )) {
        if (folderUuids.length === 0) {
          this.logger.log(
            'No more deleted folders with not deleted files to process',
          );
          break;
        }

        await this.fileRepository.markFilesInFolderAsRemoved(folderUuids);
      }

      const completedJob = await this.jobExecutionRepository.markAsCompleted(
        startedJob.id,
      );
      this.logger.log(`Cleanup completed at ${completedJob?.completedAt}`);
    } catch (error) {
      this.logger.error(
        `Error while executin deleted folders cleanup ${JSON.stringify({ error })}`,
      );
      const errorMessage = error.message;
      await this.jobExecutionRepository.markAsFailed(startedJob.id, {
        errorMessage,
      });
      throw error;
    }
  }

  async *yieldDeletedFoldersWithActiveChildren(
    startDate: Date,
    untilDate: Date,
    batchSize: number = 1000,
  ) {
    let resultCount = 0;
    do {
      const folderUuids =
        await this.folderRepository.getDeletedFoldersWithNotDeletedChildren({
          startDate,
          untilDate,
          limit: batchSize,
        });
      resultCount = folderUuids.length;

      yield folderUuids;
    } while (resultCount === batchSize);
  }

  async *yieldDeletedFoldersWithActiveFiles(
    startDate: Date,
    untilDate: Date,
    batchSize: number = 1000,
  ) {
    let resultCount = 0;
    do {
      const folderUuids =
        await this.folderRepository.getDeletedFoldersWithNotDeletedFiles({
          startDate,
          untilDate,
          limit: batchSize,
        });

      resultCount = folderUuids.length;

      yield folderUuids;
    } while (resultCount === batchSize);
  }

  async initializeJobExecution(job: Job) {
    const lastCompletedJob =
      await this.jobExecutionRepository.getLastSuccessful(
        JobName.DELETED_ITEMS_CLEANUP,
      );

    const startedJob = await this.jobExecutionRepository.startJob(
      JobName.DELETED_ITEMS_CLEANUP,
      { metadata: { jobId: job.id } },
    );

    const untilDate = startedJob.startedAt;
    const startDate = this.calculateStartDate(lastCompletedJob);

    return { startDate, untilDate, startedJob };
  }

  private calculateStartDate(lastCompletedJob: JobExecutionModel | null): Date {
    if (lastCompletedJob?.startedAt) {
      return lastCompletedJob.startedAt;
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    this.logger.warn(
      `No previous successful execution found. Cleanup will process items deleted from ${startOfToday}`,
    );

    return startOfToday;
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.log(
      `Processing job ${job.id} of type ${job.name} with data ${job.data}...`,
    );
  }

  @OnWorkerEvent('failed')
  onFail(job: Job) {
    this.logger.error(
      `Error while processing job ${job.id} of type ${job.name}`,
    );
  }

  private async setupJobScheduler() {
    try {
      await this.cleanupQueue.upsertJobScheduler('orphan-cleanup', {
        every: JOB_INTERVAL,
        immediately: false,
      });
      this.logger.log(
        `Setup deleted items cleanup job every ${JOB_INTERVAL} ms`,
      );
    } catch (error) {
      this.logger.error(
        `Deleted items cleanup job could not be setup ${JSON.stringify({ error })}`,
      );
    }
  }
}
