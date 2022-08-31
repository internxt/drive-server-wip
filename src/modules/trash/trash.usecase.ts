import { Injectable, Logger } from '@nestjs/common';
import { Folder } from '../folder/folder.domain';
import { User } from '../user/user.domain';
import { File } from '../file/file.domain';
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
        .deleteFolderPermanently(folder)
        .catch((err) => Logger.error(err.message));
    }

    await this.folderUseCases.deleteOrphansFolders(user.id);
  }

  public async clearTrash(user: User) {
    const { rootFolderId: folderId, id: userId } = user;
    const deleted = true;

    const foldersToDelete = await this.folderUseCases.getChildrenFoldersToUser(
      folderId,
      userId,
      deleted,
    );

    const foldersIdToDelete = foldersToDelete.map(
      (folder: Folder) => folder.id,
    );

    const filesDeletion = this.fileUseCases
      .getByUserExceptParents(userId, foldersIdToDelete, deleted)
      .then((files: Array<File>) => this.deleteFiles(files, user));

    const foldersDeletion = this.deleteFolders(foldersToDelete, user);

    await Promise.allSettled([filesDeletion, foldersDeletion]);
  }
}
