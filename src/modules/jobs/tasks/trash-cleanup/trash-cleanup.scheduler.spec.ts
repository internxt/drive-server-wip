import { createMock, type DeepMocked } from '@golevelup/ts-jest';
import { Test } from '@nestjs/testing';
import { type Logger } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { type Queue } from 'bullmq';
import {
  TrashCleanupScheduler,
  TRASH_CLEANUP_QUEUE,
} from './trash-cleanup.scheduler';
import { SequelizeFeatureLimitsRepository } from '../../../feature-limit/feature-limit.repository';
import { LimitLabels, LimitTypes } from '../../../feature-limit/limits.enum';
import { newFeatureLimit, newTier } from '../../../../../test/fixtures';

describe('TrashCleanupScheduler', () => {
  let scheduler: TrashCleanupScheduler;
  let featureLimitsRepository: DeepMocked<SequelizeFeatureLimitsRepository>;
  let queue: DeepMocked<Queue>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        TrashCleanupScheduler,
        {
          provide: getQueueToken(TRASH_CLEANUP_QUEUE),
          useValue: createMock<Queue>(),
        },
      ],
    })
      .setLogger(createMock<Logger>())
      .useMocker(() => createMock())
      .compile();

    scheduler = moduleRef.get(TrashCleanupScheduler);
    featureLimitsRepository = moduleRef.get(SequelizeFeatureLimitsRepository);
    queue = moduleRef.get(getQueueToken(TRASH_CLEANUP_QUEUE));
  });

  it('When initialized, then service should be defined', () => {
    expect(scheduler).toBeDefined();
  });

  describe('scheduleCleanup', () => {
    it('When no tiers have a retention limit configured, then it should not enqueue any jobs', async () => {
      featureLimitsRepository.findTiersWithLimitByLabel.mockResolvedValue([]);

      await scheduler.scheduleCleanup();

      expect(queue.add).not.toHaveBeenCalled();
    });

    it('When tiers with retention limits exist, then it should enqueue one job per tier', async () => {
      const tier1 = newTier();
      const tier2 = newTier();
      const limit = newFeatureLimit({
        type: LimitTypes.Counter,
        value: '30',
        label: LimitLabels.TrashRetentionDays,
      });

      featureLimitsRepository.findTiersWithLimitByLabel.mockResolvedValue([
        { tier: tier1, limit },
        { tier: tier2, limit },
      ]);

      await scheduler.scheduleCleanup();

      expect(queue.add).toHaveBeenCalledTimes(2);
    });

    it('When enqueueing, then it should use a jobId based on tierId to avoid duplicates', async () => {
      const tier = newTier();
      const limit = newFeatureLimit({
        type: LimitTypes.Counter,
        value: '30',
        label: LimitLabels.TrashRetentionDays,
      });

      featureLimitsRepository.findTiersWithLimitByLabel.mockResolvedValue([
        { tier, limit },
      ]);

      await scheduler.scheduleCleanup();

      expect(queue.add).toHaveBeenCalledWith(
        'process-tier',
        { tierId: tier.id, tierName: tier.label },
        expect.objectContaining({ jobId: `trash-cleanup:tier:${tier.id}` }),
      );
    });

    it('When called, then it should query limits using the TrashRetentionDays label', async () => {
      featureLimitsRepository.findTiersWithLimitByLabel.mockResolvedValue([]);

      await scheduler.scheduleCleanup();

      expect(
        featureLimitsRepository.findTiersWithLimitByLabel,
      ).toHaveBeenCalledWith(LimitLabels.TrashRetentionDays);
    });

    it('When findTiersWithLimitByLabel throws, then it should propagate the error', async () => {
      const error = new Error('DB unavailable');
      featureLimitsRepository.findTiersWithLimitByLabel.mockRejectedValue(
        error,
      );

      await expect(scheduler.scheduleCleanup()).rejects.toThrow(error);
    });
  });
});
