import {
  ConflictException,
  Injectable,
  Logger,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { type Folder } from '../folder/folder.domain';
import { type User } from '../user/user.domain';
import { type File } from '../file/file.domain';
import { FolderUseCases } from '../folder/folder.usecase';
import { FileUseCases } from '../file/file.usecase';
import { FavoriteUseCases } from '../favorite/favorite.usecase';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TrashEmptyRequestedEvent } from './events/trash-empty-requested.event';
import { FeatureLimitService } from '../feature-limit/feature-limit.service';
import { LimitLabels } from '../feature-limit/limits.enum';
import { ItemToTrashType } from './dto/controllers/move-items-to-trash.dto';
import {
  type FailedRestoreItemDto,
  type ItemToRestoreDto,
  RestoreFailureReason,
} from './dto/controllers/restore-items-from-trash.dto';

export interface RestoredItems {
  restoredFiles: File[];
  restoredFolders: Folder[];
  failed: FailedRestoreItemDto[];
}

export interface EmptyTrashResult {
  message: string;
  status: 'processing' | 'completed';
}

const isAvailableFolder = (folder?: Folder) =>
  !!folder && !folder.deleted && !folder.removed;

@Injectable()
export class TrashUseCases {
  private readonly logger = new Logger(TrashUseCases.name);

  constructor(
    @Inject(forwardRef(() => FileUseCases))
    private readonly fileUseCases: FileUseCases,
    @Inject(forwardRef(() => FolderUseCases))
    private readonly folderUseCases: FolderUseCases,
    @Inject(forwardRef(() => FavoriteUseCases))
    private readonly favoriteUseCases: FavoriteUseCases,
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

    await this.favoriteUseCases.removeOrphanedFavorites(trashOwner);
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

  /**
   * Puts trashed files and folders back in the folders they were trashed from, one by one and folders first, so an
   * item whose folder is restored in the same request goes back too. An item that can't be restored is reported
   * with the reason and doesn't stop the others.
   * @param user User whose items are going to be restored
   * @param items Items to be restored
   * @returns Restored and failed items
   */
  async restoreItems(
    user: User,
    items: ItemToRestoreDto[],
  ): Promise<RestoredItems> {
    const folderItems = items.filter(
      ({ type }) => type === ItemToTrashType.FOLDER,
    );
    const fileItems = items.filter(({ type }) => type === ItemToTrashType.FILE);

    const [files, folders] = await Promise.all([
      this.fileUseCases.getByUuids(fileItems.map(({ uuid }) => uuid)),
      this.folderUseCases.getByUuids(
        folderItems.map(({ uuid }) => uuid),
        user,
      ),
    ]);

    const filesByUuid = new Map(
      files.filter((file) => file.isOwnedBy(user)).map((f) => [f.uuid, f]),
    );
    const foldersByUuid = new Map(folders.map((f) => [f.uuid, f]));
    const parents = await this.folderUseCases.getByUuids(
      [
        ...[...filesByUuid.values()].map(({ folderUuid }) => folderUuid),
        ...folders.map(({ parentUuid }) => parentUuid),
      ],
      user,
    );
    const parentsByUuid = new Map(parents.map((p) => [p.uuid, p]));

    const result: RestoredItems = {
      restoredFiles: [],
      restoredFolders: [],
      failed: [],
    };

    for (const item of [...folderItems, ...fileItems]) {
      const isFile = item.type === ItemToTrashType.FILE;
      const file = filesByUuid.get(item.uuid);
      const folder = foldersByUuid.get(item.uuid);
      const itemToRestore = isFile ? file : folder;
      const isTrashed = itemToRestore?.isTrashed();
      if (!isTrashed) {
        this.logger.warn(
          `Item to restore is not trashed: ${JSON.stringify(item)}`,
        );
        result.failed.push({
          ...item,
          reason: RestoreFailureReason.NotRestorable,
        });
        continue;
      }

      const parentUuid = isFile ? file.folderUuid : folder.parentUuid;
      if (!isAvailableFolder(parentsByUuid.get(parentUuid))) {
        result.failed.push({
          ...item,
          reason: RestoreFailureReason.ParentNotAvailable,
        });
        continue;
      }

      const destination = { destinationFolder: parentUuid };
      try {
        if (isFile) {
          result.restoredFiles.push(
            await this.fileUseCases.moveFile(user, item.uuid, destination),
          );
        } else {
          const restoredFolder = await this.folderUseCases.moveFolder(
            user,
            item.uuid,
            destination,
          );
          result.restoredFolders.push(restoredFolder);
          parentsByUuid.set(restoredFolder.uuid, restoredFolder);
        }
      } catch (error) {
        result.failed.push({
          ...item,
          reason: this.toRestoreFailure(error, user, item),
        });
      }
    }

    return result;
  }

  private toRestoreFailure(
    error: unknown,
    user: User,
    item: ItemToRestoreDto,
  ): RestoreFailureReason {
    if (error instanceof ConflictException) {
      return RestoreFailureReason.NameConflict;
    }
    this.logger.error(
      { user: user.uuid, item, error: (error as Error).message },
      '[TRASH/RESTORE] ERROR: item could not be restored',
    );
    return RestoreFailureReason.NotRestorable;
  }

  async getTrashRetentionDays(user: User): Promise<number | null> {
    const limit = await this.featureLimitService.getUserLimitByLabel(
      LimitLabels.TrashRetentionDays,
      user,
    );
    return limit ? Number(limit.value) : null;
  }
}
