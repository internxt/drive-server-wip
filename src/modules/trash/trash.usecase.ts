import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Folder } from '../folder/folder.domain';
import { User } from '../user/user.domain';
import { File, FileAttributes } from '../file/file.domain';
import { FolderUseCases } from '../folder/folder.usecase';
import { FileUseCases } from '../file/file.usecase';

@Injectable()
export class TrashUseCases {
  constructor(
    private fileUseCases: FileUseCases,
    private folderUseCases: FolderUseCases,
  ) {}

  private async deleteFiles(files: Array<File>, user: User): Promise<void> {
    for (const file of files) {
      await this.fileUseCases
        .deleteFilePermanently(file, user)
        .catch((err) => Logger.error(err.message));
    }
  }

  private async deleteFolders(
    folders: Array<Folder>,
    user: User,
  ): Promise<void> {
    if (folders.length === 0) {
      return;
    }

    for (const folder of folders) {
      await this.folderUseCases
        .deleteFolderPermanently(folder, user)
        .catch((err) => Logger.error(err.message));
    }

    await this.folderUseCases.deleteOrphansFolders(user.id);
  }

  public async clearTrash(user: User) {
    const { id: userId } = user;

    const foldersToDelete = await this.folderUseCases.getFoldersToUser(userId, {
      deleted: true,
    });

    const foldersIdToDelete = foldersToDelete.map(
      (folder: Folder) => folder.id,
    );

    const filesDeletion = this.fileUseCases
      .getByUserExceptParents(userId, foldersIdToDelete, { deleted: true })
      .then((files: Array<File>) => this.deleteFiles(files, user));

    const foldersDeletion = this.deleteFolders(foldersToDelete, user);

    await Promise.allSettled([filesDeletion, foldersDeletion]);
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
