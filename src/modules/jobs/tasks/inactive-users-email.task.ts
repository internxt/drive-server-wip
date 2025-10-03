import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { JobName } from '../constants';
import { SequelizeUserRepository } from '../../user/user.repository';
import { MailerService } from '../../../externals/mailer/mailer.service';
import { SequelizeFeatureLimitsRepository } from '../../feature-limit/feature-limit.repository';
import { RedisService } from '../../../externals/redis/redis.service';
import { User } from '../../user/user.domain';
import { PLAN_FREE_INDIVIDUAL_TIER_ID } from '../../feature-limit/limits.enum';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InactiveUsersEmailTask {
  private readonly logger = new Logger(InactiveUsersEmailTask.name);
  private readonly lockTtl = 60 * 60 * 1000; // 1 hour in milliseconds
  private readonly lockKey = 'job:inactive-users-email';
  private readonly batchSize = 500;
  private readonly rateLimitDelay = 100; // 100ms between emails (10 emails/second)

  constructor(
    private readonly userRepository: SequelizeUserRepository,
    private readonly mailerService: MailerService,
    private readonly featureLimitsRepository: SequelizeFeatureLimitsRepository,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
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
      const errorObject = {
        timestamp: new Date().toISOString(),
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
      this.logger.error(
        `Inactive users email job failed: ${JSON.stringify(errorObject)}`,
      );
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
    let processedCount = 0;
    let errorCount = 0;
    let offset = 0;

    const freeTier = await this.getFreeTier();
    if (!freeTier) {
      this.logger.error('Free tier not found, aborting job');
      return;
    }

    this.logger.log(`Using free tier: ${freeTier.label} (${freeTier.id})`);

    while (true) {
      const users = await this.userRepository.getInactiveUsersForEmail(
        offset,
        this.batchSize,
        freeTier.id,
      );

      if (users.length === 0) {
        this.logger.log('No more inactive users to process');
        break;
      }

      this.logger.log(
        `Processing batch of ${users.length} users (offset: ${offset})`,
      );

      for (const user of users) {
        try {
          await this.sendInactiveUserEmail(user);
          processedCount++;
          await this.delay(this.rateLimitDelay);
        } catch (error) {
          errorCount++;
          this.logger.error(
            `Failed to process user ${user.id}: ${error.message}`,
          );
        }
      }

      offset += this.batchSize;
      this.logger.log(
        `Batch completed: ${processedCount} emails sent, ${errorCount} errors`,
      );
    }

    this.logger.log(
      `Inactive users email job completed: ${processedCount} total emails sent, ${errorCount} total errors`,
    );
  }

  private async getFreeTier() {
    const tiers = await this.featureLimitsRepository.findAll();
    return tiers.find((tier) => tier.label === PLAN_FREE_INDIVIDUAL_TIER_ID);
  }

  private async sendInactiveUserEmail(user: User): Promise<void> {
    const now = new Date();
    const daysInactive = Math.floor(
      (now.getTime() - user.updatedAt.getTime()) / (1000 * 60 * 60 * 24),
    );

    const loginUrl =
      this.configService.get('clients.drive.web') ||
      'https://drive.internxt.com';

    const context = {
      user_name: user.name || 'User',
      last_login_date: user.updatedAt.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      days_inactive: daysInactive,
      login_url: loginUrl,
    };

    await this.mailerService.sendDriveInactiveUsersEmail(user.email, context);

    await this.userRepository.updateByUuid(user.uuid, {
      inactiveEmailSentAt: now,
    });

    this.logger.log(
      `Inactive user email sent to ${user.email} (${daysInactive} days inactive)`,
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
