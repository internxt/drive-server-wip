import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { BadRequestException } from '@nestjs/common';
import { NotificationsUseCases } from './notifications.usecase';
import { NotificationRepository } from './notifications.repository';
import { SequelizeUserRepository } from '../user/user.repository';
import { NotificationTargetType } from './domain/notification.domain';
import { CreateNotificationDto } from './dto/create-notification.dto';
import {
  newNotification,
  newUser,
  newUserNotificationStatus,
} from '../../../test/fixtures';
import { v4 } from 'uuid';

const mockSystemDate = new Date('2024-01-01T00:00:00.000Z');

describe('NotificationsUseCases', () => {
  let usecases: NotificationsUseCases;
  let notificationRepository: DeepMocked<NotificationRepository>;
  let userRepository: DeepMocked<SequelizeUserRepository>;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(mockSystemDate);

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [NotificationsUseCases],
    })
      .useMocker(createMock)
      .compile();

    usecases = moduleRef.get<NotificationsUseCases>(NotificationsUseCases);
    notificationRepository = moduleRef.get(NotificationRepository);
    userRepository = moduleRef.get(SequelizeUserRepository);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('When created, then it should be defined', () => {
    expect(usecases).toBeDefined();
    expect(notificationRepository).toBeDefined();
  });

  describe('createNotification', () => {
    it('When creating notification with target type ALL, then it should create notification without user lookup', async () => {
      const createDto: CreateNotificationDto = {
        link: 'https://example.com',
        message: 'Test notification for all',
      };

      const expectedNotification = newNotification({
        attributes: {
          link: createDto.link,
          message: createDto.message,
          targetType: NotificationTargetType.ALL,
          targetValue: null,
          expiresAt: null,
        },
      });

      notificationRepository.create.mockResolvedValueOnce(expectedNotification);

      const result = await usecases.createNotification(createDto);

      expect(userRepository.findByEmail).not.toHaveBeenCalled();
      expect(notificationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          targetValue: null,
          targetType: NotificationTargetType.ALL,
        }),
      );
      expect(result).toEqual(expectedNotification);
    });

    it('When creating notification with target type USER and valid email, then it should lookup user and create notification', async () => {
      const user = newUser();
      const createDto: CreateNotificationDto = {
        link: 'https://example.com',
        message: 'Test notification for user',
        email: user.email,
      };

      const expectedNotification = newNotification({
        attributes: {
          link: createDto.link,
          message: createDto.message,
          targetType: NotificationTargetType.USER,
          targetValue: user.uuid,
        },
      });

      userRepository.findByEmail.mockResolvedValueOnce(user);
      notificationRepository.create.mockResolvedValueOnce(expectedNotification);

      const result = await usecases.createNotification(createDto);

      expect(userRepository.findByEmail).toHaveBeenCalledWith(user.email);
      expect(notificationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          targetValue: user.uuid,
          targetType: NotificationTargetType.USER,
        }),
      );
      expect(result).toEqual(expectedNotification);
    });

    it('When creating notification with target type USER and invalid email, then it should throw BadRequestException', async () => {
      const createDto: CreateNotificationDto = {
        link: 'https://example.com',
        message: 'Test notification for user',
        email: 'not valid email',
      };

      userRepository.findByEmail.mockResolvedValueOnce(null);

      await expect(usecases.createNotification(createDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('When creating notification with expiration date, then it should set expiresAt correctly', async () => {
      const expirationTime = '2024-12-31T23:59:59.000Z';
      const createDto: CreateNotificationDto = {
        link: 'https://example.com',
        message: 'Test notification with expiration',
        expiresAt: expirationTime,
      };

      const expectedExpirationDate = new Date('2024-12-31T23:59:59.000Z');

      const expectedNotification = newNotification({
        attributes: {
          link: createDto.link,
          message: createDto.message,
          targetType: NotificationTargetType.ALL,
          targetValue: null,
          expiresAt: expectedExpirationDate,
        },
      });

      notificationRepository.create.mockResolvedValueOnce(expectedNotification);

      const result = await usecases.createNotification(createDto);

      expect(notificationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          targetType: NotificationTargetType.ALL,
          expiresAt: expectedExpirationDate,
        }),
      );
      expect(result).toEqual(expectedNotification);
    });
  });

  describe('getUserNotifications', () => {
    it('When user has notifications with status, then it should return notifications with status', async () => {
      const userId = v4();
      const mockNotification = newNotification();
      const mockStatus = newUserNotificationStatus({
        attributes: {
          deliveredAt: new Date('2024-01-01T00:00:00.000Z'),
          readAt: new Date('2024-01-01T12:00:00.000Z'),
        },
      });

      const mockUserNotifications = [
        {
          notification: mockNotification,
          status: mockStatus,
        },
      ];

      notificationRepository.getNotificationsForUser.mockResolvedValueOnce(
        mockUserNotifications,
      );

      const result = await usecases.getUserNotifications(userId, {
        includeReadNotifications: false,
      });

      expect(
        notificationRepository.getNotificationsForUser,
      ).toHaveBeenCalledWith(userId, { includeReadNotifications: false });
      expect(result).toEqual([
        {
          notification: mockNotification,
          isRead: true,
          deliveredAt: mockStatus.deliveredAt,
          readAt: mockStatus.readAt,
        },
      ]);
    });

    it('When user has notifications without status, then it should create status and return with default values', async () => {
      const userId = v4();
      const mockNotification = newNotification();
      const statusAttributes = {
        userId,
        notificationId: mockNotification.id,
        deliveredAt: mockSystemDate,
        readAt: null,
        createdAt: mockSystemDate,
        updatedAt: mockSystemDate,
      };
      const mockUserNotifications = [
        {
          notification: mockNotification,
          status: null,
        },
      ];

      notificationRepository.getNotificationsForUser.mockResolvedValueOnce(
        mockUserNotifications,
      );

      const result = await usecases.getUserNotifications(userId, {
        includeReadNotifications: true,
      });

      expect(
        notificationRepository.createManyUserNotificationStatuses,
      ).toHaveBeenCalledWith([
        expect.objectContaining({
          ...statusAttributes,
        }),
      ]);
      expect(result).toEqual([
        {
          notification: mockNotification,
          isRead: false,
          deliveredAt: mockSystemDate,
          readAt: null,
        },
      ]);
    });
  });
});
