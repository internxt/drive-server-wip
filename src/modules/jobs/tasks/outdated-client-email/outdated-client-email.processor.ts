import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  InjectQueue,
  OnWorkerEvent,
  Processor,
  WorkerHost,
} from '@nestjs/bullmq';
import { type Job, Queue, Worker } from 'bullmq';
import { SequelizeUserRepository } from '../../../user/user.repository';
import { type User } from '../../../user/user.domain';
import { SequelizeMailLimitRepository } from '../../../security/mail-limit/mail-limit.repository';
import { MailTypes } from '../../../security/mail-limit/mailTypes';
import { MailerService } from '../../../../externals/mailer/mailer.service';
import { Time } from '../../../../lib/time';

export const OUTDATED_CLIENT_EMAIL_QUEUE = 'outdated-client-email';

export interface OutdatedClientEmailJobData {
  userId: User['id'];
  client: string;
  version: string;
  sunsetAt: string | null;
  emailSentAt?: string;
}

export const OUTDATED_EMAIL_CONFIG = {
  // Global limit of emails per day across all users.
  DAILY_CAP: 200,
  EMAILS_PER_MINUTE: 20,
  COOLDOWN_DAYS: 14,
  MAX_JOB_AGE_DAYS: 7,
};

@Processor(OUTDATED_CLIENT_EMAIL_QUEUE, {
  limiter: {
    max: OUTDATED_EMAIL_CONFIG.EMAILS_PER_MINUTE,
    duration: Time.durationInMs(1, 'minute'),
  },
  removeOnComplete: { count: 0 },
  removeOnFail: { age: Time.durationInSeconds(7, 'day'), count: 1000 },
})
export class OutdatedClientEmailProcessor extends WorkerHost {
  private readonly logger = new Logger(OutdatedClientEmailProcessor.name);

  constructor(
    @InjectQueue(OUTDATED_CLIENT_EMAIL_QUEUE) private readonly queue: Queue,
    private readonly userRepository: SequelizeUserRepository,
    private readonly mailLimitRepository: SequelizeMailLimitRepository,
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  async process(job: Job<OutdatedClientEmailJobData>): Promise<void> {
    if (!this.isEmailConfigured()) {
      return this.discard(
        job,
        'Outdated client email template is not configured',
      );
    }
    if (this.isOlderThanMaxAge(job)) {
      return this.discard(job, 'Outdated client email job is too old');
    }

    const user = await this.userRepository.findById(job.data.userId);
    if (!user) {
      return;
    }

    const [mailLimit] = await this.mailLimitRepository.findOrCreate(
      { userId: user.id, mailType: MailTypes.OutdatedClient },
      { attemptsCount: 0, attemptsLimit: 1, lastMailSent: Time.now(0) },
    );
    if (mailLimit.wasSentInTheLastDays(OUTDATED_EMAIL_CONFIG.COOLDOWN_DAYS)) {
      this.logger.log(
        { userUuid: user.uuid },
        'Outdated client email skipped, sent recently',
      );
      return;
    }

    if (!job.data.emailSentAt) {
      await this.waitUntilTomorrowIfDailyCapReached();
      await this.mailerService.sendOutdatedClientEmail(user.email, job.data);
      // Lets a retry update mail_limits without sending the email again
      await job.updateData({
        ...job.data,
        emailSentAt: Time.now().toISOString(),
      });

      this.logger.log(
        {
          userUuid: user.uuid,
          client: job.data.client,
          version: job.data.version,
        },
        'Outdated client email sent',
      );
    }

    mailLimit.markAsSent(Time.now(job.data.emailSentAt));
    await this.mailLimitRepository.updateByUserIdAndMailType(
      user.id,
      MailTypes.OutdatedClient,
      mailLimit,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<OutdatedClientEmailJobData>, error: Error) {
    this.logger.error(
      {
        userId: job.data.userId,
        attemptsMade: job.attemptsMade,
        error: error.message,
      },
      'Outdated client email job failed',
    );
  }

  private async discard(job: Job, reason: string): Promise<void> {
    await job.removeDeduplicationKey();
    this.logger.warn({ userId: job.data.userId }, reason);
  }

  private isEmailConfigured(): boolean {
    return Boolean(this.configService.get('mailer.templates.outdatedClient'));
  }

  private isOlderThanMaxAge(job: Job): boolean {
    return (
      Time.daysSince(Time.now(job.timestamp)) >=
      OUTDATED_EMAIL_CONFIG.MAX_JOB_AGE_DAYS
    );
  }

  // Backup for the limiter, which resets if Redis loses its state
  private async waitUntilTomorrowIfDailyCapReached(): Promise<void> {
    const startOfToday = Time.startOf(Time.now(), 'day');
    const sentToday = await this.mailLimitRepository.countSentSince(
      MailTypes.OutdatedClient,
      startOfToday,
    );

    if (sentToday < OUTDATED_EMAIL_CONFIG.DAILY_CAP) {
      return;
    }

    this.logger.warn(
      { sentToday },
      'Outdated client email daily cap reached, pausing queue until tomorrow',
    );
    const startOfTomorrow = Time.dateWithTimeAdded(1, 'day', startOfToday);
    await this.queue.rateLimit(
      startOfTomorrow.getTime() - Time.now().getTime(),
    );
    throw Worker.RateLimitError();
  }
}
