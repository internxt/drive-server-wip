import { createMock, type DeepMocked } from '@golevelup/ts-jest';
import { Test } from '@nestjs/testing';
import { type Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { type Job, type Queue, Worker } from 'bullmq';
import {
  OutdatedClientEmailProcessor,
  OUTDATED_CLIENT_EMAIL_CONFIG,
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
    recommendedVersion: '2.8.1',
    sunsetAt: '2026-12-01T00:00:00.000Z',
  };
  const makeJob = (timestamp = Date.now()): Job<OutdatedClientEmailJobData> =>
    ({ data: jobData, timestamp }) as Job<OutdatedClientEmailJobData>;

  const neverSentMailLimit = () =>
    newMailLimit({
      userId: user.id,
      mailType: MailTypes.OutdatedClient,
      attemptsCount: 0,
      lastMailSent: new Date(0),
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
        {
          client: jobData.client,
          version: jobData.version,
          recommendedVersion: jobData.recommendedVersion,
          sunsetAt: jobData.sunsetAt,
        },
      );
      expect(
        mailLimitRepository.updateByUserIdAndMailType,
      ).toHaveBeenCalledWith(
        user.id,
        MailTypes.OutdatedClient,
        expect.objectContaining({ attemptsCount: 1 }),
      );
    });

    it('When the email template is not configured, then nothing is sent', async () => {
      configService.get.mockReturnValue('');

      await processor.process(makeJob());

      expect(userRepository.findById).not.toHaveBeenCalled();
      expect(mailerService.sendOutdatedClientEmail).not.toHaveBeenCalled();
    });

    it('When the job has been waiting for too long, then nothing is sent', async () => {
      const oldTimestamp = Time.daysAgo(
        OUTDATED_CLIENT_EMAIL_CONFIG.MAX_JOB_AGE_DAYS,
      ).getTime();

      await processor.process(makeJob(oldTimestamp));

      expect(mailerService.sendOutdatedClientEmail).not.toHaveBeenCalled();
    });

    it('When the user no longer exists, then nothing is sent', async () => {
      userRepository.findById.mockResolvedValue(null);

      await processor.process(makeJob());

      expect(mailerService.sendOutdatedClientEmail).not.toHaveBeenCalled();
    });

    it('When the user is internal, then nothing is sent', async () => {
      userRepository.findById.mockResolvedValue(
        newUser({ attributes: { email: 'someone@internxt.com' } }),
      );

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

      await processor.process(makeJob());

      expect(mailerService.sendOutdatedClientEmail).not.toHaveBeenCalled();
    });

    it('When the daily cap is already reached in the database, then the queue waits until tomorrow and nothing is sent', async () => {
      mailLimitRepository.countSentSince.mockResolvedValue(
        OUTDATED_CLIENT_EMAIL_CONFIG.DAILY_CAP,
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

      await expect(processor.process(makeJob())).rejects.toThrow(sendError);

      expect(
        mailLimitRepository.updateByUserIdAndMailType,
      ).not.toHaveBeenCalled();
    });
  });
});
