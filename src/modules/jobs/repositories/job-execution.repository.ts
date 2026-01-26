import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { JobExecutionModel } from '../models/job-execution.model';
import { JobName, JobStatus } from '../constants';

interface JobExecutionRepository {
  startJob(name: string, metadata?: any): Promise<JobExecutionModel>;
  markAsCompleted(
    jobId: string,
    metadata?: Record<string, any>,
  ): Promise<JobExecutionModel | null>;
  markAsFailed(jobId: string, metadata?: Record<string, any>): Promise<void>;
  getLastSuccessful(name: string): Promise<JobExecutionModel | null>;
}

@Injectable()
export class SequelizeJobExecutionRepository implements JobExecutionRepository {
  constructor(
    @InjectModel(JobExecutionModel)
    private readonly jobExecutionModel: typeof JobExecutionModel,
  ) {}

  async startJob(
    name: JobName,
    extraData?: Partial<JobExecutionModel>,
  ): Promise<JobExecutionModel> {
    const job = await this.jobExecutionModel.create({
      name,
      status: JobStatus.RUNNING,
      startedAt: new Date(),
      ...extraData,
    });

    return job;
  }

  async markAsCompleted(
    jobId: string,
    metadata?: Record<string, any>,
  ): Promise<JobExecutionModel | null> {
    const [updatedCount, updatedJob] = await this.jobExecutionModel.update(
      {
        status: JobStatus.COMPLETED,
        completedAt: new Date(),
        metadata,
      },
      {
        where: { id: jobId },
        returning: true,
      },
    );
    return updatedCount > 0 ? updatedJob[0] : null;
  }

  async markAsFailed(
    jobId: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.jobExecutionModel.update(
      {
        status: JobStatus.FAILED,
        completedAt: new Date(),
        metadata,
      },
      {
        where: { id: jobId },
      },
    );
  }

  async getLastSuccessful(name: string): Promise<JobExecutionModel | null> {
    return this.jobExecutionModel.findOne({
      where: {
        name,
        status: JobStatus.COMPLETED,
      },
      order: [['completedAt', 'DESC']],
    });
  }
}
