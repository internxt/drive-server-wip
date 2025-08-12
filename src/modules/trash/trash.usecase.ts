import { Injectable } from '@nestjs/common';
import { Folder } from '../folder/folder.domain';
import { User } from '../user/user.domain';
import { File } from '../file/file.domain';
import { FolderUseCases } from '../folder/folder.usecase';
import { FileUseCases } from '../file/file.usecase';

@Injectable()
export class TrashUseCases {
  constructor(
    private readonly fileUseCases: FileUseCases,
    private readonly folderUseCases: FolderUseCases,
  ) {}

  /**
   * Empties the trash of a given user
   * @param trashOwner User whose trash is going to be emptied
   */
  async emptyTrash(trashOwner: User): Promise<void> {
    const emptyTrashChunkSize = 100;

    const [filesCount, foldersCount] = await Promise.all([
      this.fileUseCases.getTrashFilesCount(trashOwner.id),
      this.folderUseCases.getTrashFoldersCount(trashOwner.id),
    ]);

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
}
