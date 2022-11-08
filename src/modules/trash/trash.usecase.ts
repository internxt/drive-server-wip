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

  public async deleteItems(
    filesId: Array<FileAttributes['fileId']>,
    foldersId: Array<FileAttributes['id']>,
    user: User,
  ): Promise<void> {
    const files: Array<File> = [];
    const folders: Array<Folder> = [];

    for (const fileId of filesId) {
      const file = await this.fileUseCases.getByFileIdAndUser(
        Number(fileId),
        user.id,
        { deleted: true },
      );
      if (file === null) {
        throw new NotFoundException(`file with id ${fileId} not found`);
      }

      files.push(file);
    }

    for (const folderId of foldersId) {
      const folder = await this.folderUseCases.getFolder(folderId, {
        deleted: true,
      });
      folders.push(folder);
    }

    const filesDeletion = this.deleteFiles(files, user);
    const foldersDeletion = this.deleteFolders(folders, user);

    await Promise.allSettled([filesDeletion, foldersDeletion]);
  }
}
