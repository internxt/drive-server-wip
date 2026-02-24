import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDeep, MockProxy } from 'vitest-mock-extended';
import { Logger } from '@nestjs/common';
import { StorageNotificationService } from './storage.notifications.service';
import { NotificationService } from './notification.service';
import { ApnService } from '../apn/apn.service';
import { SequelizeUserRepository } from '../../modules/user/user.repository';
import { NotificationEvent } from './events/notification.event';
import { newUser } from '../../../test/fixtures';
import { UserNotificationTokens } from '../../modules/user/user-notification-tokens.domain';
import { v4 } from 'uuid';
import { FolderDto } from '../../modules/folder/dto/responses/folder.dto';
import { FileDto } from '../../modules/file/dto/responses/file.dto';
import {
  ItemToTrashDto,
  ItemToTrashType,
} from '../../modules/trash/dto/controllers/move-items-to-trash.dto';
import { mockLogger } from '../../../test/helpers/auth.helper';

describe('StorageNotificationService', () => {
  const fixedSystemCurrentDate = new Date('2021-01-01T00:00:00Z');
  let service: StorageNotificationService;
  let notificationService: MockProxy<NotificationService>;
  let apnService: MockProxy<ApnService>;
  let userRepository: MockProxy<SequelizeUserRepository>;

  beforeEach(async () => {
    notificationService = mockDeep<NotificationService>();
    apnService = mockDeep<ApnService>();
    userRepository = mockDeep<SequelizeUserRepository>();

    vi.useFakeTimers();
    vi.setSystemTime(fixedSystemCurrentDate);

    service = new StorageNotificationService(
      notificationService,
      apnService,
      userRepository,
    );

    mockLogger();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('fileCreated', () => {
    const user = newUser();
    const payload = {
      fileId: '123',
      fileName: 'test.pdf',
    } as unknown as FileDto;
    const clientId = 'test-client';

    it('When called, then it should add a notification event and send APN notification', () => {
      vi.spyOn(service, 'getTokensAndSendApnNotification');
      const notification = new NotificationEvent(
        'notification.itemCreated',
        payload,
        user.email,
        clientId,
        user.uuid,
        'FILE_CREATED',
      );

      service.fileCreated({ payload, user, clientId });

      expect(notificationService.add).toHaveBeenCalledWith(
        expect.objectContaining(notification),
      );
      expect(service.getTokensAndSendApnNotification).toHaveBeenCalledWith(
        user.uuid,
      );
    });
  });

  describe('fileUpdated', () => {
    const user = newUser();
    const payload = {
      fileId: '123',
      fileName: 'test.pdf',
    } as unknown as FileDto;
    const clientId = 'test-client';

    it('When called, then it should add a notification event and send APN notification', () => {
      vi.spyOn(service, 'getTokensAndSendApnNotification');
      const notification = new NotificationEvent(
        'notification.itemUpdated',
        payload,
        user.email,
        clientId,
        user.uuid,
        'FILE_UPDATED',
      );
      service.fileUpdated({ payload, user, clientId });

      expect(notificationService.add).toHaveBeenCalledWith(
        expect.objectContaining(notification),
      );
      expect(service.getTokensAndSendApnNotification).toHaveBeenCalledWith(
        user.uuid,
      );
    });
  });

  describe('folderCreated', () => {
    const user = newUser();
    const payload = {
      folderId: '123',
      folderName: 'test-folder',
    } as unknown as FolderDto;
    const clientId = 'test-client';

    it('When called, then it should add a notification event and send APN notification', () => {
      vi.spyOn(service, 'getTokensAndSendApnNotification');
      const notification = new NotificationEvent(
        'notification.itemCreated',
        payload,
        user.email,
        clientId,
        user.uuid,
        'FOLDER_CREATED',
      );

      service.folderCreated({ payload, user, clientId });

      expect(notificationService.add).toHaveBeenCalledWith(
        expect.objectContaining(notification),
      );
      expect(service.getTokensAndSendApnNotification).toHaveBeenCalledWith(
        user.uuid,
      );
    });
  });

  describe('folderUpdated', () => {
    const user = newUser();
    const payload = {
      folderId: '123',
      folderName: 'test-folder',
    } as unknown as FolderDto;
    const clientId = 'test-client';

    it('When called, then it should add a notification event and send APN notification', () => {
      vi.spyOn(service, 'getTokensAndSendApnNotification');
      const notification = new NotificationEvent(
        'notification.itemUpdated',
        payload,
        user.email,
        clientId,
        user.uuid,
        'FOLDER_UPDATED',
      );

      service.folderUpdated({ payload, user, clientId });

      expect(notificationService.add).toHaveBeenCalledWith(
        expect.objectContaining(notification),
      );
      expect(service.getTokensAndSendApnNotification).toHaveBeenCalledWith(
        user.uuid,
      );
    });
  });

  describe('itemsTrashed', () => {
    const user = newUser();
    const payload: ItemToTrashDto[] = [
      { id: '123', type: ItemToTrashType.FILE },
    ];
    const clientId = 'test-client';

    it('When called, then it should add a notification event and send APN notification', () => {
      vi.spyOn(service, 'getTokensAndSendApnNotification');
      const notification = new NotificationEvent(
        'notification.itemsToTrash',
        payload,
        user.email,
        clientId,
        user.uuid,
        'ITEMS_TO_TRASH',
      );

      service.itemsTrashed({ payload, user, clientId });

      expect(notificationService.add).toHaveBeenCalledWith(
        expect.objectContaining(notification),
      );
      expect(service.getTokensAndSendApnNotification).toHaveBeenCalledWith(
        user.uuid,
      );
    });
  });

  describe('planUpdated', () => {
    const user = newUser();
    const payload = { maxSpaceBytes: 1000000 };
    const clientId = 'test-client';

    it('When called, then it should add a notification event and send APN notification with custom options', () => {
      const notification = new NotificationEvent(
        'notification.planUpdated',
        payload,
        user.email,
        clientId,
        user.uuid,
        'PLAN_UPDATED',
      );
      vi.spyOn(service, 'getTokensAndSendApnNotification');

      service.planUpdated({ payload, user, clientId });

      expect(notificationService.add).toHaveBeenCalledWith(
        expect.objectContaining(notification),
      );
      expect(service.getTokensAndSendApnNotification).toHaveBeenCalledWith(
        user.uuid,
        {
          isStorageNotification: false,
          customKeys: { event: 'PLAN_UPDATED' },
        },
      );
    });
  });

  describe('workspaceJoined', () => {
    const user = newUser();
    const payload = { workspaceId: '123', workspaceName: 'test-workspace' };
    const clientId = 'test-client';

    it('When called, then it should add a notification event and send APN notification', () => {
      vi.spyOn(service, 'getTokensAndSendApnNotification');
      const notification = new NotificationEvent(
        'notification.workspaceJoined',
        payload,
        user.email,
        clientId,
        user.uuid,
        'WORKSPACE_JOINED',
      );

      service.workspaceJoined({ payload, user, clientId });

      expect(notificationService.add).toHaveBeenCalledWith(
        expect.objectContaining(notification),
      );
      expect(service.getTokensAndSendApnNotification).toHaveBeenCalledWith(
        user.uuid,
        {
          isStorageNotification: false,
          customKeys: { event: 'WORKSPACE_JOINED' },
        },
      );
    });
  });

  describe('workspaceLeft', () => {
    const user = newUser();
    const payload = { workspaceId: '123', workspaceName: 'test-workspace' };
    const clientId = 'test-client';

    it('When called, then it should add a notification event and send APN notification', () => {
      vi.spyOn(service, 'getTokensAndSendApnNotification');
      const notification = new NotificationEvent(
        'notification.workspaceLeft',
        payload,
        user.email,
        clientId,
        user.uuid,
        'WORKSPACE_LEFT',
      );

      service.workspaceLeft({ payload, user, clientId });

      expect(notificationService.add).toHaveBeenCalledWith(
        expect.objectContaining(notification),
      );
      expect(service.getTokensAndSendApnNotification).toHaveBeenCalledWith(
        user.uuid,
        {
          isStorageNotification: false,
          customKeys: { event: 'WORKSPACE_LEFT' },
        },
      );
    });
  });

  describe('getTokensAndSendApnNotification', () => {
    const user = newUser();

    const tokens = [
      new UserNotificationTokens({
        id: v4(),
        token: 'token',
        type: 'macos',
        userId: user.uuid,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      new UserNotificationTokens({
        id: v4(),
        token: 'token2',
        type: 'macos',
        userId: user.uuid,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      new UserNotificationTokens({
        id: v4(),
        token: 'token3',
        type: 'macos',
        userId: user.uuid,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ];

    it('When called with valid tokens, then it should send notifications to all tokens', async () => {
      userRepository.getNotificationTokens.mockResolvedValue(tokens);
      apnService.sendNotification.mockResolvedValue({
        statusCode: 200,
        body: '',
      });

      await service.getTokensAndSendApnNotification(user.uuid);

      expect(userRepository.getNotificationTokens).toHaveBeenCalledWith(
        user.uuid,
        { type: 'macos' },
      );
      expect(apnService.sendNotification).toHaveBeenCalledTimes(3);
      tokens.forEach(({ token }) => {
        expect(apnService.sendNotification).toHaveBeenCalledWith(
          token,
          {},
          user.uuid,
          true,
          null,
        );
      });
      expect(
        userRepository.deleteUserNotificationTokens,
      ).not.toHaveBeenCalled();
    });

    it('When some tokens are expired, then it should delete them', async () => {
      userRepository.getNotificationTokens.mockResolvedValue(tokens);
      apnService.sendNotification
        .mockResolvedValueOnce({ statusCode: 200, body: '' })
        .mockResolvedValueOnce({ statusCode: 410, body: '' }) // expired token
        .mockResolvedValueOnce({ statusCode: 200, body: '' });

      await service.getTokensAndSendApnNotification(user.uuid);

      expect(userRepository.deleteUserNotificationTokens).toHaveBeenCalledWith(
        user.uuid,
        ['token2'],
      );
    });

    it('When sending notification fails, then it should log error and continue', async () => {
      userRepository.getNotificationTokens.mockResolvedValue(tokens);
      const error = new Error('APN error');
      apnService.sendNotification
        .mockResolvedValueOnce({ statusCode: 200, body: '' })
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({ statusCode: 200, body: '' });

      const errorSpy = vi.spyOn(Logger.prototype, 'error');

      await service.getTokensAndSendApnNotification(user.uuid);

      expect(apnService.sendNotification).toHaveBeenCalledTimes(3);
      expect(errorSpy).toHaveBeenCalled();
    });

    it('When called with custom options, then it should pass them properly', async () => {
      userRepository.getNotificationTokens.mockResolvedValue([
        { token: 'token1' },
      ] as any);
      apnService.sendNotification.mockResolvedValue({
        statusCode: 200,
        body: '',
      });

      const options = {
        isStorageNotification: false,
        customKeys: { event: 'CUSTOM_EVENT' },
      };

      await service.getTokensAndSendApnNotification(user.uuid, options);

      expect(apnService.sendNotification).toHaveBeenCalledWith(
        'token1',
        {},
        user.uuid,
        options.isStorageNotification,
        options.customKeys,
      );
    });
  });
});
