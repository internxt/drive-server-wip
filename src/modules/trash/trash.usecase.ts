import { Injectable, forwardRef, Inject } from '@nestjs/common';
import { type Folder } from '../folder/folder.domain';
import { type User } from '../user/user.domain';
import { type File } from '../file/file.domain';
import { FolderUseCases } from '../folder/folder.usecase';
import { FileUseCases } from '../file/file.usecase';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TrashEmptyRequestedEvent } from './events/trash-empty-requested.event';
import { Time } from '../../lib/time';
import { FeatureLimitService } from '../feature-limit/feature-limit.service';
import {
  DEFAULT_TRASH_RETENTION_DAYS,
  LimitLabels,
} from '../feature-limit/limits.enum';

export interface EmptyTrashResult {
  message: string;
  status: 'processing' | 'completed';
}

@Injectable()
export class TrashUseCases {
  constructor(
    @Inject(forwardRef(() => FileUseCases))
    private readonly fileUseCases: FileUseCases,
    @Inject(forwardRef(() => FolderUseCases))
    private readonly folderUseCases: FolderUseCases,
    private readonly eventEmitter: EventEmitter2,
    private readonly featureLimitService: FeatureLimitService,
  ) {}

  /**
   * Empties the trash of a given user
   * @param trashOwner User whose trash is going to be emptied
   */
  async emptyTrash(trashOwner: User): Promise<EmptyTrashResult> {
    const [filesCount, foldersCount] = await Promise.all([
      this.fileUseCases.getTrashFilesCount(trashOwner.id),
      this.folderUseCases.getTrashFoldersCount(trashOwner.id),
    ]);
    const totalCount = filesCount + foldersCount;

    if (totalCount > 10000) {
      this.eventEmitter.emit(
        'trash.empty.requested',
        new TrashEmptyRequestedEvent(trashOwner, filesCount, foldersCount),
      );

      return {
        message: 'Empty trash operation started',
        status: 'processing',
      };
    }

    await this.performTrashDeletion(trashOwner, filesCount, foldersCount, 100);

    return {
      message: 'Trash emptied successfully',
      status: 'completed',
    };
  }

  /**
   * Performs the actual deletion of trashed files and folders
   */
  async performTrashDeletion(
    trashOwner: User,
    filesCount: number,
    foldersCount: number,
    chunkSize?: number,
  ): Promise<void> {
    const emptyTrashChunkSize = chunkSize ?? 100;

    const deleteFolders = async (): Promise<void> => {
      let foldersProcessed = 0;
      while (foldersProcessed < foldersCount) {
        const processedCount =
          await this.folderUseCases.deleteUserTrashedFoldersBatch(
            trashOwner,
            emptyTrashChunkSize,
          );
        if (processedCount === 0) break;

        foldersProcessed += processedCount;
      }
    };

    const deleteFiles = async (): Promise<void> => {
      let filesProcessed = 0;
      while (filesProcessed < filesCount) {
        const processedCount =
          await this.fileUseCases.deleteUserTrashedFilesBatch(
            trashOwner,
            emptyTrashChunkSize,
          );
        if (processedCount === 0) break;

        filesProcessed += processedCount;
      }
    };

    await Promise.all([deleteFolders(), deleteFiles()]);
  }

  /**
   * Deletes items from the trash (permanently)
   * @param user User whose items are going to be deleted
   * @param filesIds Ids of the files to be deleted
   * @param foldersIds Ids of the folders to be deleted
   */
  async deleteItems(
    user: User,
    files: File[],
    folders: Folder[],
  ): Promise<void> {
    const itemsDeletionChunkSize = 10;

    for (let i = 0; i < files.length; i += itemsDeletionChunkSize) {
      await this.fileUseCases.deleteByUser(
        user,
        files.slice(i, i + itemsDeletionChunkSize),
      );
    }

    for (let i = 0; i < folders.length; i += itemsDeletionChunkSize) {
      await this.folderUseCases.deleteByUser(
        user,
        folders.slice(i, i + itemsDeletionChunkSize),
      );
    }
  }

  async getTrashRetentionDays(user: User): Promise<number> {
    const limit = await this.featureLimitService.getUserLimitByLabel(
      LimitLabels.TrashRetentionDays,
      user,
    );
    return limit ? Number(limit.value) : DEFAULT_TRASH_RETENTION_DAYS;
  }

  calculateExpiryDate(
    retentionDays: number,
    deletedAt: Date = new Date(),
  ): Date {
    return Time.dateWithTimeAdded(retentionDays, 'day', deletedAt);
  }
}
