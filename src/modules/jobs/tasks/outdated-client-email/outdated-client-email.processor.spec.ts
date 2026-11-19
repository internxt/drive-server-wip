import { createMock, type DeepMocked } from '@golevelup/ts-jest';
import { Test } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { type Job, type Queue, Worker } from 'bullmq';
import {
  OutdatedClientEmailProcessor,
  OUTDATED_EMAIL_CONFIG,
  OUTDATED_CLIENT_EMAIL_QUEUE,
  type OutdatedClientEmailJobData,
} from './outdated-client-email.processor';
import { SequelizeUserRepository } from '../../../user/user.repository';
import { SequelizeMailLimitRepository } from '../../../security/mail-limit/mail-limit.repository';
import { MailTypes } from '../../../security/mail-limit/mailTypes';
import { MailerService } from '../../../../externals/mailer/mailer.service';
import { newMailLimit, newUser } from '../../../../../test/fixtures';
import { Time } from '../../../../lib/time';

describe('OutdatedClientEmailProcessor', () => {
  let processor: OutdatedClientEmailProcessor;
  let userRepository: DeepMocked<SequelizeUserRepository>;
  let mailLimitRepository: DeepMocked<SequelizeMailLimitRepository>;
  let mailerService: DeepMocked<MailerService>;
  let configService: DeepMocked<ConfigService>;
  let queue: DeepMocked<Queue>;

  const user = newUser({ attributes: { email: 'user@example.com' } });
  const jobData: OutdatedClientEmailJobData = {
    userId: user.id,
    client: 'drive-desktop-windows',
    version: '2.3.0',
    sunsetAt: '2026-12-01T00:00:00.000Z',
  };
  const makeJob = ({
    timestamp = Time.now().getTime(),
    data = jobData,
  }: {
    timestamp?: number;
    data?: OutdatedClientEmailJobData;
  } = {}): DeepMocked<Job<OutdatedClientEmailJobData>> => {
    const job = createMock<Job<OutdatedClientEmailJobData>>({
      data,
      timestamp,
    });
    job.updateData.mockImplementation(async (newData) => {
      job.data = newData;
    });
    return job;
  };

  const neverSentMailLimit = () =>
    newMailLimit({
      userId: user.id,
      mailType: MailTypes.OutdatedClient,
      attemptsCount: 0,
      lastMailSent: Time.now(0),
    });

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [OutdatedClientEmailProcessor],
    })
      .setLogger(createMock<Logger>())
      .useMocker(() => createMock())
      .compile();

    processor = moduleRef.get(OutdatedClientEmailProcessor);
    userRepository = moduleRef.get(SequelizeUserRepository);
    mailLimitRepository = moduleRef.get(SequelizeMailLimitRepository);
    mailerService = moduleRef.get(MailerService);
    configService = moduleRef.get(ConfigService);
    queue = moduleRef.get(getQueueToken(OUTDATED_CLIENT_EMAIL_QUEUE));

    configService.get.mockReturnValue('outdated-client-template-id');
    userRepository.findById.mockResolvedValue(user);
    mailLimitRepository.findOrCreate.mockResolvedValue([
      neverSentMailLimit(),
      true,
    ]);
    mailLimitRepository.countSentSince.mockResolvedValue(0);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('process', () => {
    it('When the user was not notified recently, then the email is sent and marked as sent', async () => {
      const job = makeJob();

      await processor.process(job);

      expect(mailerService.sendOutdatedClientEmail).toHaveBeenCalledWith(
        user.email,
        jobData,
      );
      expect(
        mailLimitRepository.updateByUserIdAndMailType,
      ).toHaveBeenCalledWith(
        user.id,
        MailTypes.OutdatedClient,
        expect.objectContaining({ attemptsCount: 1 }),
      );
      expect(job.updateData).toHaveBeenCalledWith({
        ...jobData,
        emailSentAt: expect.any(String),
      });
    });

    it('When the email was already sent in a previous attempt, then it is only marked as sent', async () => {
      const emailSentAt = '2026-11-17T10:00:00.000Z';
      const retriedJob = makeJob({ data: { ...jobData, emailSentAt } });

      await processor.process(retriedJob);

      expect(mailerService.sendOutdatedClientEmail).not.toHaveBeenCalled();
      expect(
        mailLimitRepository.updateByUserIdAndMailType,
      ).toHaveBeenCalledWith(
        user.id,
        MailTypes.OutdatedClient,
        expect.objectContaining({ lastMailSent: Time.now(emailSentAt) }),
      );
    });

    it('When the email template is not configured, then nothing is sent and the user is not queued again', async () => {
      configService.get.mockReturnValue('');
      const job = makeJob();

      await processor.process(job);

      expect(userRepository.findById).not.toHaveBeenCalled();
      expect(mailerService.sendOutdatedClientEmail).not.toHaveBeenCalled();
      expect(job.removeDeduplicationKey).not.toHaveBeenCalled();
    });

    it('When the job has been waiting for too long, then nothing is sent and the user can be queued again', async () => {
      const oldTimestamp = Time.daysAgo(
        OUTDATED_EMAIL_CONFIG.MAX_JOB_AGE_DAYS,
      ).getTime();
      const job = makeJob({ timestamp: oldTimestamp });

      await processor.process(job);

      expect(mailerService.sendOutdatedClientEmail).not.toHaveBeenCalled();
      expect(job.removeDeduplicationKey).toHaveBeenCalled();
    });

    it('When the user no longer exists, then nothing is sent', async () => {
      userRepository.findById.mockResolvedValue(null);

      await processor.process(makeJob());

      expect(mailerService.sendOutdatedClientEmail).not.toHaveBeenCalled();
    });

    it('When the user was notified within the cooldown, then nothing is sent', async () => {
      mailLimitRepository.findOrCreate.mockResolvedValue([
        newMailLimit({
          userId: user.id,
          mailType: MailTypes.OutdatedClient,
          lastMailSent: Time.daysAgo(3),
        }),
        false,
      ]);

      const job = makeJob();

      await processor.process(job);

      expect(mailerService.sendOutdatedClientEmail).not.toHaveBeenCalled();
      expect(job.removeDeduplicationKey).not.toHaveBeenCalled();
    });

    it('When the daily cap is already reached in the database, then the queue waits until tomorrow and nothing is sent', async () => {
      mailLimitRepository.countSentSince.mockResolvedValue(
        OUTDATED_EMAIL_CONFIG.DAILY_CAP,
      );

      await expect(processor.process(makeJob())).rejects.toThrow(
        Worker.RateLimitError(),
      );

      expect(queue.rateLimit).toHaveBeenCalledWith(expect.any(Number));
      expect(mailerService.sendOutdatedClientEmail).not.toHaveBeenCalled();
    });

    it('When the email fails to send, then it is not marked as sent and the job fails to be retried', async () => {
      const sendError = new Error('SendGrid unavailable');
      mailerService.sendOutdatedClientEmail.mockRejectedValue(sendError);
      const job = makeJob();

      await expect(processor.process(job)).rejects.toThrow(sendError);

      expect(job.updateData).not.toHaveBeenCalled();
      expect(
        mailLimitRepository.updateByUserIdAndMailType,
      ).not.toHaveBeenCalled();
    });
  });

  describe('onFailed', () => {
    it('When a job fails, then the failure is logged with the user and attempt', () => {
      const errorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation();
      const job = makeJob();
      job.attemptsMade = 2;

      processor.onFailed(job, new Error('SendGrid unavailable'));

      expect(errorSpy).toHaveBeenCalledWith(
        {
          userId: jobData.userId,
          attemptsMade: 2,
          error: 'SendGrid unavailable',
        },
        'Outdated client email job failed',
      );
    });
  });
});
