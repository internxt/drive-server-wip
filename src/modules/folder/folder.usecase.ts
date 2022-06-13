import { Injectable, NotFoundException } from '@nestjs/common';
import { Folder, FolderAttributes } from './folder.domain';
import { SequelizeFolderRepository } from './folder.repository';

@Injectable()
export class FolderUseCases {
  constructor(private folderRepository: SequelizeFolderRepository) {}

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
  async moveFoldersToTrash(folderIds: FolderAttributes['id'][]): Promise<void> {
    this.folderRepository.updateManyByFolderId(folderIds, {
      deleted: true,
      deletedAt: new Date(),
    });
  }
}
