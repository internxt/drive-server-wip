import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { type Queue } from 'bullmq';
import { NotificationService } from './notification.service';
import { type User } from '../../modules/user/user.domain';
import { NotificationEvent } from './events/notification.event';
import { ApnService } from '../apn/apn.service';
import { SequelizeUserRepository } from '../../modules/user/user.repository';
import { type FolderDto } from '../../modules/folder/dto/responses/folder.dto';
import { type FileDto } from '../../modules/file/dto/responses/file.dto';
import { type ItemToTrashDto } from '../../modules/trash/dto/controllers/move-items-to-trash.dto';

export const APN_REFRESH_QUEUE = 'apn-refresh';
export const APN_REFRESH_DEBOUNCE_MS = 15_000;

export interface ApnRefreshJobData {
  userUuid: string;
}

enum StorageEvents {
  FILE_CREATED = 'FILE_CREATED',
  FOLDER_CREATED = 'FOLDER_CREATED',
  FILE_UPDATED = 'FILE_UPDATED',
  FOLDER_UPDATED = 'FOLDER_UPDATED',
  ITEMS_TO_TRASH = 'ITEMS_TO_TRASH',
  FILE_DELETED = 'FILE_DELETED',
  FOLDER_DELETED = 'FOLDER_DELETED',
  PLAN_UPDATED = 'PLAN_UPDATED',
  WORKSPACE_JOINED = 'WORKSPACE_JOINED',
  WORKSPACE_LEFT = 'WORKSPACE_LEFT',
}

interface EventArguments<T> {
  payload: T;
  user: User;
  clientId: string;
}

@Injectable()
export class StorageNotificationService {
  private readonly logger = new Logger(StorageNotificationService.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly apnService: ApnService,
    private readonly userRepository: SequelizeUserRepository,
    @InjectQueue(APN_REFRESH_QUEUE)
    private readonly apnRefreshQueue: Queue<ApnRefreshJobData>,
  ) {}

  fileCreated({ payload, user, clientId }: EventArguments<FileDto>) {
    const event = new NotificationEvent(
      'notification.itemCreated',
      payload,
      user.email,
      clientId,
      user.uuid,
      StorageEvents.FILE_CREATED,
    );

    this.notificationService.add(event);

    if (!user.ownsBackupsBucket(payload.bucket)) {
      this.enqueueApnRefresh(user.uuid);
    }
  }

  fileUpdated({ payload, user, clientId }: EventArguments<FileDto>) {
    const event = new NotificationEvent(
      'notification.itemUpdated',
      payload,
      user.email,
      clientId,
      user.uuid,
      StorageEvents.FILE_UPDATED,
    );

    this.notificationService.add(event);

    if (!user.ownsBackupsBucket(payload.bucket)) {
      this.enqueueApnRefresh(user.uuid);
    }
  }

  fileDeleted({
    payload,
    user,
    clientId,
  }: EventArguments<{ id: number; uuid: string }>) {
    const event = new NotificationEvent(
      'notification.itemDeleted',
      payload,
      user.email,
      clientId,
      user.uuid,
      StorageEvents.FILE_DELETED,
    );

    this.notificationService.add(event);
    this.enqueueApnRefresh(user.uuid);
  }

  folderCreated({ payload, user, clientId }: EventArguments<FolderDto>) {
    const event = new NotificationEvent(
      'notification.itemCreated',
      payload,
      user.email,
      clientId,
      user.uuid,
      StorageEvents.FOLDER_CREATED,
    );

    this.notificationService.add(event);
    this.enqueueApnRefresh(user.uuid);
  }

  folderUpdated({ payload, user, clientId }: EventArguments<FolderDto>) {
    const event = new NotificationEvent(
      'notification.itemUpdated',
      payload,
      user.email,
      clientId,
      user.uuid,
      StorageEvents.FOLDER_UPDATED,
    );

    this.notificationService.add(event);
    this.enqueueApnRefresh(user.uuid);
  }

  folderDeleted({
    payload,
    user,
    clientId,
  }: EventArguments<{ id: number; uuid: string; userId: number }>) {
    const event = new NotificationEvent(
      'notification.itemDeleted',
      payload,
      user.email,
      clientId,
      user.uuid,
      StorageEvents.FOLDER_DELETED,
    );

    this.notificationService.add(event);
    this.enqueueApnRefresh(user.uuid);
  }

  itemsTrashed({ payload, user, clientId }: EventArguments<ItemToTrashDto[]>) {
    const event = new NotificationEvent(
      'notification.itemsToTrash',
      payload,
      user.email,
      clientId,
      user.uuid,
      StorageEvents.ITEMS_TO_TRASH,
    );

    this.notificationService.add(event);
    this.enqueueApnRefresh(user.uuid);
  }

  planUpdated({
    payload,
    user,
    clientId,
  }: EventArguments<{ maxSpaceBytes: number }>) {
    const event = new NotificationEvent(
      'notification.planUpdated',
      payload,
      user.email,
      clientId,
      user.uuid,
      StorageEvents.PLAN_UPDATED,
    );

    this.notificationService.add(event);
    this.getTokensAndSendApnNotification(user.uuid, {
      isStorageNotification: false,
      customKeys: { event: StorageEvents.PLAN_UPDATED },
    });
  }

  workspaceJoined({
    payload,
    user,
    clientId,
  }: EventArguments<{ workspaceId: string; workspaceName: string }>) {
    const event = new NotificationEvent(
      'notification.workspaceJoined',
      payload,
      user.email,
      clientId,
      user.uuid,
      StorageEvents.WORKSPACE_JOINED,
    );

    this.notificationService.add(event);
    this.getTokensAndSendApnNotification(user.uuid, {
      isStorageNotification: false,
      customKeys: { event: StorageEvents.WORKSPACE_JOINED },
    });
  }

  workspaceLeft({
    payload,
    user,
    clientId,
  }: EventArguments<{ workspaceId: string; workspaceName: string }>) {
    const event = new NotificationEvent(
      'notification.workspaceLeft',
      payload,
      user.email,
      clientId,
      user.uuid,
      StorageEvents.WORKSPACE_LEFT,
    );

    this.notificationService.add(event);
    this.getTokensAndSendApnNotification(user.uuid, {
      isStorageNotification: false,
      customKeys: { event: StorageEvents.WORKSPACE_LEFT },
    });
  }

  enqueueApnRefresh(userUuid: string) {
    this.apnRefreshQueue
      .add(
        'refresh',
        { userUuid },
        {
          delay: APN_REFRESH_DEBOUNCE_MS,
          deduplication: { id: userUuid },
          attempts: 3,
          backoff: { type: 'exponential', delay: 5_000 },
          removeOnComplete: true,
          removeOnFail: true,
        },
      )
      .catch((error) => {
        this.logger.error({ userUuid, error }, 'Error enqueuing APN refresh.');
      });
  }

  async getTokensAndSendApnNotification(
    userUuid: string,
    options: {
      isStorageNotification: boolean;
      customKeys: Record<string, string>;
    } = {
      isStorageNotification: true,
      customKeys: null,
    },
  ) {
    const tokens = await this.userRepository.getNotificationTokens(userUuid, {
      type: 'macos',
    });

    const tokenPromises = tokens.map(async ({ token }: { token: string }) => {
      try {
        const response = await this.apnService.sendNotification(
          token,
          {},
          userUuid,
          options.isStorageNotification,
          options.customKeys,
        );
        return response.statusCode === 410 ? token : null;
      } catch (error) {
        this.logger.error(
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
