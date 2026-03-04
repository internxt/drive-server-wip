import { createMock, type DeepMocked } from '@golevelup/ts-jest';
import { Test } from '@nestjs/testing';
import { type Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InactiveUsersEmailTask } from './inactive-users-email.task';
import { SequelizeUserRepository } from '../../user/user.repository';
import { MailerService } from '../../../externals/mailer/mailer.service';
import { RedisService } from '../../../externals/redis/redis.service';
import { User } from '../../user/user.domain';
import { INACTIVE_USERS_EMAIL_CONFIG } from '../constants';
import { SequelizeFeatureLimitsRepository } from '../../feature-limit/feature-limit.repository';
import { Tier } from '../../feature-limit/domain/tier.domain';
import { SequelizeMailLimitRepository } from '../../security/mail-limit/mail-limit.repository';
import { MailTypes } from '../../security/mail-limit/mailTypes';

describe('InactiveUsersEmailTask', () => {
  let task: InactiveUsersEmailTask;
  let userRepository: DeepMocked<SequelizeUserRepository>;
  let mailerService: DeepMocked<MailerService>;
  let redisService: DeepMocked<RedisService>;
  let configService: DeepMocked<ConfigService>;
  let featureLimitsRepository: DeepMocked<SequelizeFeatureLimitsRepository>;
  let mailLimitRepository: DeepMocked<SequelizeMailLimitRepository>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [InactiveUsersEmailTask],
    })
      .setLogger(createMock<Logger>())
      .useMocker(() => createMock())
      .compile();

    task = moduleRef.get(InactiveUsersEmailTask);
    userRepository = moduleRef.get(SequelizeUserRepository);
    mailerService = moduleRef.get(MailerService);
    redisService = moduleRef.get(RedisService);
    configService = moduleRef.get(ConfigService);
    featureLimitsRepository = moduleRef.get(SequelizeFeatureLimitsRepository);
    mailLimitRepository = moduleRef.get(SequelizeMailLimitRepository);
  });

  it('When initialized, then service should be defined', () => {
    expect(task).toBeDefined();
  });

  describe('scheduleInactiveUsersEmail', () => {
    it('When executeCronjobs is false, then it should not execute the job', async () => {
      configService.get.mockReturnValue(false);

      const processInactiveUsersSpy = jest.spyOn(
        task as any,
        'processInactiveUsers',
      );

      await task.scheduleInactiveUsersEmail();

      expect(configService.get).toHaveBeenCalledWith('executeCronjobs', false);
      expect(processInactiveUsersSpy).not.toHaveBeenCalled();
      expect(redisService.tryAcquireLock).not.toHaveBeenCalled();
    });

    it('When lock cannot be acquired, then it should not start the job', async () => {
      configService.get.mockReturnValue(true);
      redisService.tryAcquireLock.mockResolvedValue(false);

      const processInactiveUsersSpy = jest.spyOn(
        task as any,
        'processInactiveUsers',
      );

      await task.scheduleInactiveUsersEmail();

      expect(redisService.tryAcquireLock).toHaveBeenCalledWith(
        'job:inactive-users-email',
        60 * 60 * 1000,
      );
      expect(processInactiveUsersSpy).not.toHaveBeenCalled();
    });

    it('When job completes, then it should release lock', async () => {
      configService.get.mockReturnValue(true);
      redisService.tryAcquireLock.mockResolvedValue(true);
      redisService.releaseLock.mockResolvedValue(true);
      userRepository.getInactiveUsersForEmail.mockResolvedValue([]);
      featureLimitsRepository.findTierByLabel.mockResolvedValue(
        Tier.build({
          id: 'tier-uuid-123',
          label: 'free_individual',
          context: 'drive',
        }),
      );

      await task.scheduleInactiveUsersEmail();

      expect(redisService.tryAcquireLock).toHaveBeenCalled();
      expect(redisService.releaseLock).toHaveBeenCalledWith(
        'job:inactive-users-email',
      );
    });

    it('When error occurs, then it should still release lock in finally block', async () => {
      const error = new Error('Database connection failed');
      configService.get.mockReturnValue(true);
      redisService.tryAcquireLock.mockResolvedValue(true);
      redisService.releaseLock.mockResolvedValue(true);
      featureLimitsRepository.findTierByLabel.mockResolvedValue(
        Tier.build({
          id: 'tier-uuid-123',
          label: 'free_individual',
          context: 'drive',
        }),
      );
      userRepository.getInactiveUsersForEmail.mockRejectedValue(error);

      await task.scheduleInactiveUsersEmail();

      expect(redisService.releaseLock).toHaveBeenCalledWith(
        'job:inactive-users-email',
      );
    });

    it('When tier is not found, then it should throw error and release lock', async () => {
      configService.get.mockReturnValue(true);
      redisService.tryAcquireLock.mockResolvedValue(true);
      redisService.releaseLock.mockResolvedValue(true);
      featureLimitsRepository.findTierByLabel.mockResolvedValue(null);

      await task.scheduleInactiveUsersEmail();

      expect(featureLimitsRepository.findTierByLabel).toHaveBeenCalledWith(
        'free_individual',
      );
      expect(userRepository.getInactiveUsersForEmail).not.toHaveBeenCalled();
      expect(redisService.releaseLock).toHaveBeenCalledWith(
        'job:inactive-users-email',
      );
    });
  });

  describe('processInactiveUsers', () => {
    const mockUser = User.build({
      id: 1,
      uuid: 'user-uuid-123',
      email: 'inactive@example.com',
      name: 'John',
      lastname: 'Doe',
      updatedAt: new Date('2024-09-01T10:00:00Z'),
      createdAt: new Date('2024-01-01T10:00:00Z'),
      userId: 'user-id-123',
      bridgeUser: 'bridge-user-123',
      password: '',
      mnemonic: '',
      rootFolderId: 1,
      hKey: undefined,
      secret_2FA: '',
      errorLoginCount: 0,
      isEmailActivitySended: 0,
      referralCode: '',
      referrer: '',
      syncDate: new Date(),
      lastResend: new Date(),
      credit: 0,
      welcomePack: false,
      registerCompleted: true,
      backupsBucket: '',
      sharedWorkspace: false,
      avatar: '',
      emailVerified: true,
      username: 'johndoe',
    });

    beforeEach(() => {
      const mockTier = Tier.build({
        id: 'tier-uuid-123',
        label: 'free_individual',
        context: 'drive',
      });

      configService.get.mockImplementation((key: string) => {
        if (key === 'executeCronjobs') return true;
        if (key === 'clients.drive.web') return 'https://drive.internxt.com';
        return undefined;
      });

      redisService.tryAcquireLock.mockResolvedValue(true);
      redisService.releaseLock.mockResolvedValue(true);
      featureLimitsRepository.findTierByLabel.mockResolvedValue(mockTier);
    });

    it('When no inactive users exist, then it should complete without errors', async () => {
      userRepository.getInactiveUsersForEmail.mockResolvedValue([]);

      await task.scheduleInactiveUsersEmail();

      expect(userRepository.getInactiveUsersForEmail).toHaveBeenCalledWith(
        0,
        INACTIVE_USERS_EMAIL_CONFIG.BATCH_SIZE,
        'tier-uuid-123',
        expect.any(Date),
        ['@inxt.com', '@internxt.com'],
      );
      expect(mailerService.sendDriveInactiveUsersEmail).not.toHaveBeenCalled();
      expect(mailLimitRepository.findOrCreate).not.toHaveBeenCalled();
    });

    it('When inactive users exist, then it should send emails and mark as sent', async () => {
      userRepository.getInactiveUsersForEmail.mockResolvedValue([mockUser]);

      mailerService.sendDriveInactiveUsersEmail.mockResolvedValue();
      mailLimitRepository.findOrCreate.mockResolvedValue([null, true]);

      await task.scheduleInactiveUsersEmail();

      expect(userRepository.getInactiveUsersForEmail).toHaveBeenCalledTimes(1);
      expect(mailerService.sendDriveInactiveUsersEmail).toHaveBeenCalledWith(
        'inactive@example.com',
      );

      expect(mailLimitRepository.findOrCreate).toHaveBeenCalledWith(
        { userId: mockUser.id, mailType: MailTypes.InactiveUsers },
        {
          userId: mockUser.id,
          mailType: MailTypes.InactiveUsers,
          attemptsCount: 1,
          attemptsLimit: 1,
          lastMailSent: expect.any(Date),
        },
      );
    });

    it('When inactive users exceed the batch limit, then it should only process up to the batch limit', async () => {
      const users = Array(INACTIVE_USERS_EMAIL_CONFIG.BATCH_SIZE)
        .fill(null)
        .map((_, i) =>
          User.build({ ...mockUser, uuid: `uuid-${i}`, id: i + 1 }),
        );

      userRepository.getInactiveUsersForEmail.mockResolvedValue(users);
      mailerService.sendDriveInactiveUsersEmail.mockResolvedValue();
      mailLimitRepository.findOrCreate.mockResolvedValue([null, true]);

      await task.scheduleInactiveUsersEmail();

      expect(userRepository.getInactiveUsersForEmail).toHaveBeenCalledTimes(1);
      expect(userRepository.getInactiveUsersForEmail).toHaveBeenCalledWith(
        0,
        INACTIVE_USERS_EMAIL_CONFIG.BATCH_SIZE,
        'tier-uuid-123',
        expect.any(Date),
        ['@inxt.com', '@internxt.com'],
      );
      expect(mailerService.sendDriveInactiveUsersEmail).toHaveBeenCalledTimes(
        INACTIVE_USERS_EMAIL_CONFIG.BATCH_SIZE,
      );
      expect(mailLimitRepository.findOrCreate).toHaveBeenCalledTimes(
        INACTIVE_USERS_EMAIL_CONFIG.BATCH_SIZE,
      );
    });

    it('When email fails for one user, then it should continue with next user and only update successful ones', async () => {
      const user1 = User.build({
        ...mockUser,
        email: 'user1@example.com',
        uuid: 'user-uuid-1',
      });
      const user2 = User.build({
        ...mockUser,
        email: 'user2@example.com',
        uuid: 'user-uuid-2',
      });

      userRepository.getInactiveUsersForEmail.mockResolvedValue([user1, user2]);

      mailerService.sendDriveInactiveUsersEmail
        .mockRejectedValueOnce(new Error('SendGrid API failed'))
        .mockResolvedValueOnce();

      mailLimitRepository.findOrCreate.mockResolvedValue([null, true]);

      await task.scheduleInactiveUsersEmail();

      expect(userRepository.getInactiveUsersForEmail).toHaveBeenCalledTimes(1);
      expect(mailerService.sendDriveInactiveUsersEmail).toHaveBeenCalledTimes(
        2,
      );
      expect(mailLimitRepository.findOrCreate).toHaveBeenCalledTimes(1);
      expect(mailLimitRepository.findOrCreate).toHaveBeenCalledWith(
        { userId: user2.id, mailType: MailTypes.InactiveUsers },
        {
          userId: user2.id,
          mailType: MailTypes.InactiveUsers,
          attemptsCount: 1,
          attemptsLimit: 1,
          lastMailSent: expect.any(Date),
        },
      );
    });

    it('When checking inactive users, then it should exclude internal emails (@inxt.com and @internxt.com)', async () => {
      userRepository.getInactiveUsersForEmail.mockResolvedValue([]);

      await task.scheduleInactiveUsersEmail();

      expect(userRepository.getInactiveUsersForEmail).toHaveBeenCalledWith(
        0,
        INACTIVE_USERS_EMAIL_CONFIG.BATCH_SIZE,
        'tier-uuid-123',
        expect.any(Date),
        ['@inxt.com', '@internxt.com'],
      );
    });
  });
});
