import { Injectable, forwardRef, Inject } from '@nestjs/common';
import { type Folder } from '../folder/folder.domain';
import { type User } from '../user/user.domain';
import { type File } from '../file/file.domain';
import { FolderUseCases } from '../folder/folder.usecase';
import { FileUseCases } from '../file/file.usecase';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TrashEmptyRequestedEvent } from './events/trash-empty-requested.event';
import { SequelizeTrashRepository } from './trash.repository';
import { TrashItemType } from './trash.attributes';
import { Trash } from './trash.domain';
import { Time, type TimeUnit } from '../../lib/time';
import { SequelizeFileRepository } from '../file/file.repository';
import { SequelizeFolderRepository } from '../folder/folder.repository';

const DEFAULT_TRASH_RETENTION = { amount: 2, unit: 'day' as TimeUnit };

const TRASH_RETENTION_BY_TIER: Record<
  string,
  { amount: number; unit: TimeUnit }
> = {
  essential_individual: { amount: 7, unit: 'day' },
  essential_lifetime_individual: { amount: 7, unit: 'day' },
  premium_individual: { amount: 15, unit: 'day' },
  premium_lifetime_individual: { amount: 15, unit: 'day' },
  ultimate_individual: { amount: 30, unit: 'day' },
  ultimate_lifetime_individual: { amount: 30, unit: 'day' },
  standard_business: { amount: 15, unit: 'day' },
  pro_business: { amount: 30, unit: 'day' },
};

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
    private readonly trashRepository: SequelizeTrashRepository,
    private readonly fileRepository: SequelizeFileRepository,
    private readonly folderRepository: SequelizeFolderRepository,
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
    const totalTrashItems = filesCount + foldersCount;

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

    const deleteTrashItems = async (): Promise<void> => {
      let trashProcessed = 0;
      while (trashProcessed < totalTrashItems) {
        const processedCount = await this.deleteUserTrashedItemsBatch(
          trashOwner,
          emptyTrashChunkSize,
        );
        if (processedCount === 0) break;

        trashProcessed += processedCount;
      }
    };

    await Promise.all([deleteFolders(), deleteFiles(), deleteTrashItems()]);
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
      await Promise.all([
        this.removeItemsFromTrash(
          files.slice(i, i + itemsDeletionChunkSize).map((file) => file.uuid),
          TrashItemType.File,
        ),
        this.fileUseCases.deleteByUser(
          user,
          files.slice(i, i + itemsDeletionChunkSize),
        ),
      ]);
    }

    for (let i = 0; i < folders.length; i += itemsDeletionChunkSize) {
      await Promise.all([
        this.removeItemsFromTrash(
          folders
            .slice(i, i + itemsDeletionChunkSize)
            .map((folder) => folder.uuid),
          TrashItemType.Folder,
        ),
        this.folderUseCases.deleteByUser(
          user,
          folders.slice(i, i + itemsDeletionChunkSize),
        ),
      ]);
    }
  }

  calculateCaducityDate(tierLabel: string, deletedAt: Date = new Date()): Date {
    const retentionConfig =
      TRASH_RETENTION_BY_TIER[tierLabel] ?? DEFAULT_TRASH_RETENTION;
    return Time.dateWithTimeAdded(
      retentionConfig.amount,
      retentionConfig.unit,
      deletedAt,
    );
  }

  async addItemsToTrash(
    itemIds: string[],
    itemType: TrashItemType,
    tierLabel: string,
    userId: number,
    deletedAt: Date = new Date(),
  ): Promise<void> {
    const caducityDate = this.calculateCaducityDate(tierLabel, deletedAt);
    await Promise.all(
      itemIds.map((itemId) =>
        this.trashRepository.create(
          Trash.build({ itemId, itemType, caducityDate, userId }),
        ),
      ),
    );
  }

  async removeItemsFromTrash(
    itemIds: string[],
    itemType: TrashItemType,
  ): Promise<void> {
    if (itemIds.length === 0) {
      return;
    }
    await this.trashRepository.deleteByItemIds(itemIds, itemType);
  }

  async getTrashEntriesByIds(
    itemIds: string[],
    itemType: TrashItemType,
  ): Promise<Trash[]> {
    if (itemIds.length === 0) {
      return [];
    }
    return this.trashRepository.findByItemIds(itemIds, itemType);
  }

  async deleteUserTrashedItemsBatch(
    user: User,
    batchSize: number,
  ): Promise<number> {
    return this.trashRepository.deleteByUserId(user.id, batchSize);
  }

  async deleteExpiredItems(items: Trash[]): Promise<{
    filesDeleted: number;
    foldersDeleted: number;
  }> {
    if (items.length === 0) {
      return { filesDeleted: 0, foldersDeleted: 0 };
    }

    const files = items.filter((item) => item.itemType === TrashItemType.File);
    const folders = items.filter(
      (item) => item.itemType === TrashItemType.Folder,
    );

    const fileUuids = files.map((item) => item.itemId);
    const folderUuids = folders.map((item) => item.itemId);

    const [filesDeleted, foldersDeleted] = await Promise.all([
      fileUuids.length > 0
        ? this.fileRepository.deleteFilesByUuid(fileUuids)
        : Promise.resolve(0),
      folderUuids.length > 0
        ? this.folderRepository.deleteFoldersByUuid(folderUuids)
        : Promise.resolve(0),
    ]);

    await Promise.all([
      fileUuids.length > 0
        ? this.trashRepository.deleteByItemIds(fileUuids, TrashItemType.File)
        : Promise.resolve(),
      folderUuids.length > 0
        ? this.trashRepository.deleteByItemIds(
            folderUuids,
            TrashItemType.Folder,
          )
        : Promise.resolve(),
    ]);

    return {
      filesDeleted,
      foldersDeleted,
    };
  }
}
