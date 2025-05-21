import { Injectable } from '@nestjs/common';
import { Folder } from '../storage/folder/folder.domain';
import { User } from '../user/user.domain';
import { File, FileStatus } from '../storage/file/file.domain';
import { FolderUseCases } from '../storage/folder/folder.usecase';
import { FileUseCases } from '../storage/file/file.usecase';

@Injectable()
export class TrashUseCases {
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
}
