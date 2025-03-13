import { Injectable, Logger } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { User } from '../../modules/user/user.domain';
import { NotificationEvent } from './events/notification.event';
import { ApnService } from '../apn/apn.service';
import { SequelizeUserRepository } from '../../modules/user/user.repository';

enum StorageEvents {
  FILE_CREATED = 'FILE_CREATED',
  FOLDER_CREATED = 'FOLDER_CREATED',
  FILE_UPDATED = 'FILE_UPDATED',
  FOLDER_UPDATED = 'FOLDER_UPDATED',
  ITEMS_TO_TRASH = 'ITEMS_TO_TRASH',
  FILE_DELETED = 'FILE_DELETED',
  FOLDER_DELETED = 'FOLDER_DELETED',
}

interface EventArguments {
  payload: any;
  user: User;
  clientId: string;
}

@Injectable()
export class StorageNotificationService {
  constructor(
    private notificationService: NotificationService,
    private apnService: ApnService,
    private userRepository: SequelizeUserRepository,
  ) {}

  fileCreated({ payload, user, clientId }: EventArguments) {
    const event = new NotificationEvent(
      'notification.itemCreated',
      payload,
      user.email,
      clientId,
      user.uuid,
      StorageEvents.FILE_CREATED,
    );

    this.notificationService.add(event);
    this.getTokensAndSendNotification(user.uuid);
  }

  fileUpdated({ payload, user, clientId }: EventArguments) {
    const event = new NotificationEvent(
      'notification.itemUpdated',
      payload,
      user.email,
      clientId,
      user.uuid,
      StorageEvents.FILE_UPDATED,
    );

    this.notificationService.add(event);
    this.getTokensAndSendNotification(user.uuid);
  }

  fileDeleted({ payload, user, clientId }: EventArguments) {
    const event = new NotificationEvent(
      'notification.itemDeleted',
      payload,
      user.email,
      clientId,
      user.uuid,
      StorageEvents.FILE_DELETED,
    );

    this.notificationService.add(event);
    this.getTokensAndSendNotification(user.uuid);
  }

  folderCreated({ payload, user, clientId }: EventArguments) {
    const event = new NotificationEvent(
      'notification.itemCreated',
      payload,
      user.email,
      clientId,
      user.uuid,
      StorageEvents.FOLDER_CREATED,
    );

    this.notificationService.add(event);
    this.getTokensAndSendNotification(user.uuid);
  }

  folderUpdated({ payload, user, clientId }: EventArguments) {
    const event = new NotificationEvent(
      'notification.itemUpdated',
      payload,
      user.email,
      clientId,
      user.uuid,
      StorageEvents.FOLDER_UPDATED,
    );

    this.notificationService.add(event);
    this.getTokensAndSendNotification(user.uuid);
  }

  folderDeleted({ payload, user, clientId }: EventArguments) {
    const event = new NotificationEvent(
      'notification.itemDeleted',
      payload,
      user.email,
      clientId,
      user.uuid,
      StorageEvents.FOLDER_DELETED,
    );

    this.notificationService.add(event);
    this.getTokensAndSendNotification(user.uuid);
  }

  itemsTrashed({ payload, user, clientId }: EventArguments) {
    const event = new NotificationEvent(
      'notification.itemsToTrash',
      payload,
      user.email,
      clientId,
      user.uuid,
      StorageEvents.ITEMS_TO_TRASH,
    );

    this.notificationService.add(event);
    this.getTokensAndSendNotification(user.uuid);
  }

  public async getTokensAndSendNotification(userUuid: string) {
    const tokens = await this.userRepository.getNotificationTokens(userUuid, {
      type: 'macos',
    });

    const tokenPromises = tokens.map(async ({ token }: { token: string }) => {
      try {
        const response = await this.apnService.sendNotification(
          token,
          {},
          userUuid,
          true,
        );
        return response.statusCode === 410 ? token : null;
      } catch (error) {
        Logger.error(
          `Error sending APN notification to ${userUuid}: ${
            (error as Error).message
          }`,
        );
      }
    });

    const results = await Promise.all(tokenPromises);

    const expiredTokens = results.filter((token) => token !== null);

    if (expiredTokens.length > 0) {
      await this.userRepository.deleteUserNotificationTokens(
        userUuid,
        expiredTokens,
      );
    }
  }
}
