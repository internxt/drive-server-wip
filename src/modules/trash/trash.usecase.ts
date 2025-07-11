import { Injectable } from '@nestjs/common';
import { Folder } from '../folder/folder.domain';
import { User } from '../user/user.domain';
import { File, FileStatus } from '../file/file.domain';
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
    const filesCount = await this.fileUseCases.getTrashFilesCount(
      trashOwner.id,
    );
    const foldersCount = await this.folderUseCases.getTrashFoldersCount(
      trashOwner.id,
    );

    const emptyTrashChunkSize = 1000;
    const deleteItemsChunks: Promise<void>[] = [];

    for (let i = 0; i < foldersCount; i += emptyTrashChunkSize) {
      deleteItemsChunks.push(
        this.folderUseCases
          .getFolders(
            trashOwner.id,
            { deleted: true, removed: false },
            { limit: emptyTrashChunkSize, offset: i },
          )
          .then((folders) =>
            this.folderUseCases.deleteByUser(trashOwner, folders),
          ),
      );
    }

    for (let i = 0; i < filesCount; i += emptyTrashChunkSize) {
      deleteItemsChunks.push(
        this.fileUseCases
          .getFiles(
            trashOwner.id,
            { status: FileStatus.TRASHED },
            { limit: emptyTrashChunkSize, offset: i },
          )
          .then((files) => this.fileUseCases.deleteByUser(trashOwner, files)),
      );
    }

    const promiseChunkSize = 10;
    for (let i = 0; i < deleteItemsChunks.length; i += promiseChunkSize) {
      await Promise.all(deleteItemsChunks.slice(i, i + promiseChunkSize));
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
}
