import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Op } from 'sequelize';
import { JobName, INACTIVE_USERS_EMAIL_CONFIG } from '../constants';
import { SequelizeUserRepository } from '../../user/user.repository';
import { MailerService } from '../../../externals/mailer/mailer.service';
import { RedisService } from '../../../externals/redis/redis.service';
import { User } from '../../user/user.domain';
import { ConfigService } from '@nestjs/config';
import { SequelizeFeatureLimitsRepository } from '../../feature-limit/feature-limit.repository';
import { PLAN_FREE_INDIVIDUAL_TIER_LABEL } from '../../feature-limit/limits.enum';

@Injectable()
export class InactiveUsersEmailTask {
  private readonly logger = new Logger(InactiveUsersEmailTask.name);
  private readonly lockTtl = 60 * 60 * 1000;
  private readonly lockKey = 'job:inactive-users-email';
  private readonly batchSize = INACTIVE_USERS_EMAIL_CONFIG.BATCH_SIZE;
  private readonly concurrentEmailsPerBatch =
    INACTIVE_USERS_EMAIL_CONFIG.CONCURRENT_EMAILS_PER_BATCH;

  constructor(
    private readonly userRepository: SequelizeUserRepository,
    private readonly mailerService: MailerService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly featureLimitsRepository: SequelizeFeatureLimitsRepository,
  ) {}

  @Cron('0 2 * * *', { name: JobName.INACTIVE_USERS_EMAIL })
  async scheduleInactiveUsersEmail() {
    const shouldExecuteCronjobs = this.configService.get<boolean>(
      'executeCronjobs',
      false,
    );

    if (!shouldExecuteCronjobs) {
      return;
    }

    await this.runJob();
  }

  async runJob() {
    this.logger.log('Starting inactive users email job');

    try {
      const lockAcquired = await this.redisService.tryAcquireLock(
        this.lockKey,
        this.lockTtl,
      );

      if (!lockAcquired) {
        this.logger.warn(
          'Lock already acquired by another instance, skipping...',
        );
        return;
      }

      this.logger.log('Lock acquired! Starting job execution');
      await this.processInactiveUsers();
    } catch (error) {
      this.logger.error(`Inactive users email job failed: ${error.message}`);
    } finally {
      const released = await this.redisService.releaseLock(this.lockKey);
      if (released) {
        this.logger.log('Lock released successfully');
      } else {
        this.logger.warn('Lock was not released (may have expired)');
      }
    }
  }

  private async processInactiveUsers(): Promise<void> {
    const freeIndividualTier =
      await this.featureLimitsRepository.findTierByLabel(
        PLAN_FREE_INDIVIDUAL_TIER_LABEL,
      );

    if (!freeIndividualTier) {
      const errorMessage = `Tier with label "${PLAN_FREE_INDIVIDUAL_TIER_LABEL}" not found`;
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }

    this.logger.log(
      `Using tier: ${freeIndividualTier.label} (${freeIndividualTier.id})`,
    );

    let processedCount = 0;
    let errorCount = 0;

    for await (const users of this.getInactiveUsersBatches(
      freeIndividualTier.id,
    )) {
      if (users.length === 0) {
        this.logger.log('No more inactive users to process');
        break;
      }

      this.logger.log(`Processing batch of ${users.length} users`);

      const successfulUuids: string[] = [];

      for (let i = 0; i < users.length; i += this.concurrentEmailsPerBatch) {
        const chunk = users.slice(i, i + this.concurrentEmailsPerBatch);

        const results = await Promise.allSettled(
          chunk.map((user) =>
            this.mailerService.sendDriveInactiveUsersEmail(user.email),
          ),
        );

        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            processedCount++;
            successfulUuids.push(chunk[index].uuid);
          } else {
            errorCount++;
            this.logger.error(
              `Failed to send email to user ${chunk[index].uuid}: ${result.reason.message}`,
            );
          }
        });
      }

      const batchCompletedAt = new Date();

      if (successfulUuids.length > 0) {
        await this.userRepository.bulkUpdateBy(
          { uuid: { [Op.in]: successfulUuids } },
          { inactiveEmailSentAt: batchCompletedAt },
        );
      }

      this.logger.log(
        `Batch processed: ${successfulUuids.length}/${users.length} emails sent successfully`,
      );
    }

    this.logger.log(
      `Inactive users email job completed: ${processedCount} total emails sent, ${errorCount} total errors`,
    );
  }

  private async *getInactiveUsersBatches(
    tierId: string,
  ): AsyncGenerator<User[]> {
    let offset = 0;

    while (true) {
      const users = await this.userRepository.getInactiveUsersForEmail(
        offset,
        this.batchSize,
        tierId,
      );

      if (users.length === 0) {
        break;
      }

      yield users;
      offset += this.batchSize;
    }
  }
}
