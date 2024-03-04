import { Injectable, Logger } from '@nestjs/common';
import { Folder } from '../folder/folder.domain';
import { User } from '../user/user.domain';
import { File, FileStatus } from '../file/file.domain';
import { FolderUseCases } from '../folder/folder.usecase';
import { FileUseCases } from '../file/file.usecase';

@Injectable()
export class TrashUseCases {
  async clearTrash(user: User) {
    throw new Error('Method not implemented.');
  }
  constructor(
    private fileUseCases: FileUseCases,
    private folderUseCases: FolderUseCases,
  ) {}

  /**
   * Empties the trash of a given user
   * @param trashOwner User whose trash is going to be emptied
   */
  async emptyTrash(trashOwner: User): Promise<void> {
    const filesCount = await this.fileUseCases.getTrashFilesCount(
      trashOwner.id,
    );
    const foldersCount = await this.folderUseCases.getTrashFoldersCount(
      trashOwner.id,
    );
    const emptyTrashChunkSize = 100;
    for (let i = 0; i < foldersCount; i += emptyTrashChunkSize) {
      const folders = await this.folderUseCases.getFolders(
        trashOwner.id,
        { deleted: true, removed: false },
        { limit: emptyTrashChunkSize, offset: i },
      );

      await this.folderUseCases.deleteByUser(trashOwner, folders);
    }

    for (let i = 0; i < filesCount; i += emptyTrashChunkSize) {
      const files = await this.fileUseCases.getFiles(
        trashOwner.id,
        { status: FileStatus.TRASHED },
        { limit: emptyTrashChunkSize, offset: i },
      );

      await this.fileUseCases.deleteByUser(trashOwner, files);
    }
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

  async removeExpiredItems() {
    const startTime = new Date();
    try {
      Logger.log(
        `[TRASH/REMOVE-EXPIRED-ITEMS]: Cron job started at ${startTime.toISOString()}.`,
      );

      await this.folderUseCases.deleteTrashedExpiredFolders();
      await this.fileUseCases.deleteTrashedExpiredFiles();

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      Logger.log(
        `[TRASH/REMOVE-EXPIRED-ITEMS]: Cron job completed successfully. Started at: ${startTime.toISOString()}, finished at: ${endTime.toISOString()}, total duration: ${duration} ms.`,
      );
    } catch (err) {
      const errorTime = new Date();
      Logger.error(
        `[TRASH/REMOVE-EXPIRED-ITEMS]: Error encountered. Started at: ${startTime.toISOString()}, error occurred at: ${errorTime.toISOString()}, error details: ${
          err.message
        }, stack trace: ${err.stack}`,
      );
      throw err;
    }
  }
}
