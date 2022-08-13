import { Injectable, NotFoundException } from '@nestjs/common';
import { FileUseCases } from '../file/file.usecase';
import { Folder, FolderAttributes } from './folder.domain';
import { SequelizeFolderRepository } from './folder.repository';

@Injectable()
export class FolderUseCases {
  constructor(
    private folderRepository: SequelizeFolderRepository,
    private fileUseCases: FileUseCases,
  ) {}

  async getFolder(folderId: FolderAttributes['id']) {
    const folder = await this.folderRepository.findById(folderId);
    if (!folder) {
      throw new NotFoundException(`Folder with ID ${folderId} not found`);
    }
    return folder;
  }

  async getChildrenFoldersToUser(
    folderId: FolderAttributes['id'],
    userId: FolderAttributes['userId'],
    deleted: FolderAttributes['deleted'] = false,
  ) {
    const folders = await this.folderRepository.findAllByParentIdAndUserId(
      folderId,
      userId,
      deleted,
    );

    return folders;
  }

  async moveFolderToTrash(folderId: FolderAttributes['id']): Promise<Folder> {
    return this.folderRepository.updateByFolderId(folderId, {
      deleted: true,
      deletedAt: new Date(),
    });
  }
  async moveFoldersToTrash(
    folderIds: FolderAttributes['id'][],
    userId: FolderAttributes['userId'],
  ): Promise<void> {
    this.folderRepository.updateManyByFolderIdAndUserId(folderIds, userId, {
      deleted: true,
      deletedAt: new Date(),
    });
  }

  async getFolderSize(folderId) {
    const folder = await this.folderRepository.findById(folderId);
    if (!folder) {
      throw new NotFoundException(`folder with id ${folderId} not exists`);
    }

    const foldersToCheck = [folder.id];
    let totalSize = 0;

    while (foldersToCheck.length > 0) {
      const currentFolderId = foldersToCheck.shift();

      const [childrenFolder, filesSize] = await Promise.all([
        this.folderRepository.findAllByParentIdAndUserId(
          currentFolderId,
          folder.user.id,
          false,
        ),
        this.fileUseCases.getTotalSizeOfFilesFromFolder(currentFolderId),
      ]);
      totalSize += filesSize;

      childrenFolder.forEach((fld: Folder) => foldersToCheck.push(fld.id));
    }

    return totalSize;
  }

  async getFoldersByParent(folderId: number, page, perPage) {
    return this.folderRepository.findAllByParentId(
      folderId,
      false,
      page,
      perPage,
    );
  }
}
