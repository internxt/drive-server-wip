import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
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
  recommendedVersion: string | null;
  sunsetAt: string | null;
}

export const OUTDATED_CLIENT_EMAIL_CONFIG = {
  DAILY_CAP: 500,
  COOLDOWN_DAYS: 14,
  MAX_JOB_AGE_DAYS: 7,
  EXCLUDED_EMAIL_DOMAINS: ['@inxt.com', '@internxt.com'],
};

const { DAILY_CAP, COOLDOWN_DAYS, MAX_JOB_AGE_DAYS, EXCLUDED_EMAIL_DOMAINS } =
  OUTDATED_CLIENT_EMAIL_CONFIG;

// The limiter is shared by every worker of the queue, jobs over the cap keep waiting for the next window.
// It lives in Redis, so the daily cap is also checked against Postgres in case Redis loses its state.
@Processor(OUTDATED_CLIENT_EMAIL_QUEUE, {
  concurrency: 5,
  limiter: { max: DAILY_CAP, duration: 24 * 60 * 60 * 1000 },
  removeOnComplete: { count: 0 },
  removeOnFail: { age: 7 * 24 * 60 * 60, count: 1000 },
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
    if (!this.isEmailConfigured() || this.isOlderThanMaxAge(job)) {
      return;
    }

    const user = await this.userRepository.findById(job.data.userId);
    if (!user || this.isInternalUser(user)) {
      return;
    }

    const [mailLimit] = await this.mailLimitRepository.findOrCreate(
      { userId: user.id, mailType: MailTypes.OutdatedClient },
      { attemptsCount: 0, attemptsLimit: 1, lastMailSent: new Date(0) },
    );
    if (mailLimit.wasSentInTheLastDays(COOLDOWN_DAYS)) {
      return;
    }

    await this.waitUntilTomorrowIfDailyCapReached();

    const { client, version, recommendedVersion, sunsetAt } = job.data;
    await this.mailerService.sendOutdatedClientEmail(user.email, {
      client,
      version,
      recommendedVersion,
      sunsetAt,
    });

    mailLimit.markAsSent();
    await this.mailLimitRepository.updateByUserIdAndMailType(
      user.id,
      MailTypes.OutdatedClient,
      mailLimit,
    );

    this.logger.log(
      { userUuid: user.uuid, client, version },
      'Outdated client email sent',
    );
  }

  private isEmailConfigured(): boolean {
    return Boolean(this.configService.get('mailer.templates.outdatedClient'));
  }

  private isOlderThanMaxAge(job: Job): boolean {
    return Time.daysSince(new Date(job.timestamp)) >= MAX_JOB_AGE_DAYS;
  }

  private isInternalUser(user: User): boolean {
    return EXCLUDED_EMAIL_DOMAINS.some((domain) => user.email.endsWith(domain));
  }

  private async waitUntilTomorrowIfDailyCapReached(): Promise<void> {
    const startOfToday = Time.startOf(Time.now(), 'day');
    const sentToday = await this.mailLimitRepository.countSentSince(
      MailTypes.OutdatedClient,
      startOfToday,
    );
    if (sentToday < DAILY_CAP) {
      return;
    }

    const startOfTomorrow = Time.dateWithTimeAdded(1, 'day', startOfToday);
    // Pauses the whole queue and puts this job back, it does not count as a failed attempt
    await this.queue.rateLimit(startOfTomorrow.getTime() - Date.now());
    throw Worker.RateLimitError();
  }
}
