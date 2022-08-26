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

  private async deleteFiles(files: Array<File>, user: User) {
    await Promise.all(
      files.map((file: File) =>
        this.fileUseCases
          .deleteFilePermanently(file, user)
          .catch((err) => Logger.error(err.message)),
      ),
    );
  }

  private async deleteFolders(folders: Array<Folder>, user: User) {
    if (folders.length === 0) {
      return;
    }

    const folderDeletion = folders.map((folder: Folder) =>
      this.folderUseCases
        .deleteFolderPermanently(folder)
        .catch((err) => Logger.error(err.message)),
    );

    await Promise.allSettled(folderDeletion);

    await this.folderUseCases.deleteOrphansFolders(user.id);
  }

  public async clearTrash(user: User) {
    const { rootFolderId: folderId, id: userId } = user;
    const deleted = true;

    const filesDeletion = this.fileUseCases
      .getByFolderAndUser(folderId, user.id, deleted)
      .then((files: Array<File>) => this.deleteFiles(files, user));

    const foldersDeletion = this.folderUseCases
      .getChildrenFoldersToUser(folderId, userId, deleted)
      .then((folders: Array<Folder>) => this.deleteFolders(folders, user));

    await Promise.allSettled([filesDeletion, foldersDeletion]);
  }
}
