import { Injectable } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { User } from '../../modules/user/user.domain';
import { NotificationEvent } from './events/notification.event';

enum StorageEvents {
  FILE_CREATED = 'FILE_CREATED',
  FOLDER_CREATED = 'FOLDER_CREATED',
  FILE_UPDATED = 'FILE_UPDATED',
  FOLDER_UPDATED = 'FOLDER_UPDATED',
  ITEMS_TO_TRASH = 'ITEMS_TO_TRASH',
}

interface EventArguments {
  payload: any;
  user: User;
  clientId: string;
}

@Injectable()
export class StorageNotificationService {
  constructor(private notificationService: NotificationService) {}

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
  }
}
