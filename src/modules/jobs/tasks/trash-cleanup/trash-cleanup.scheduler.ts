import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SequelizeFeatureLimitsRepository } from '../../../feature-limit/feature-limit.repository';
import { LimitLabels } from '../../../feature-limit/limits.enum';
import { JobName } from '../../constants';

export const TRASH_CLEANUP_QUEUE = 'trash-cleanup';

@Injectable()
export class TrashCleanupScheduler {
  private readonly logger = new Logger(TrashCleanupScheduler.name);

  constructor(
    @InjectQueue(TRASH_CLEANUP_QUEUE) private readonly queue: Queue,
    private readonly featureLimitsRepository: SequelizeFeatureLimitsRepository,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES, {
    name: JobName.EXPIRED_TRASH_ITEMS_CLEANUP,
  })
  async scheduleCleanup() {
    const tierConfigs =
      await this.featureLimitsRepository.findTiersWithLimitByLabel(
        LimitLabels.TrashRetentionDays,
      );

    this.logger.log(
      {
        tierCount: tierConfigs.length,
        tiers: tierConfigs.map((c) => ({
          tierId: c.tier.id,
          tierLabel: c.tier.label,
          retentionDays: c.limit.value,
        })),
      },
      'Enqueueing trash cleanup jobs for tiers.',
    );

    for (const { tier } of tierConfigs) {
      await this.queue.add(
        'process-tier',
        { tierId: tier.id, tierName: tier.label },
        {
          jobId: `trash-cleanup:tier:${tier.id}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5_000 },
          removeOnComplete: true,
          removeOnFail: 100,
        },
      );
    }

    this.logger.log(
      { tierCount: tierConfigs.length },
      'Trash cleanup jobs enqueued.',
    );
  }
}
