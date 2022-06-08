import { Injectable, NotFoundException } from '@nestjs/common';
import { CryptoService } from '../../externals/crypto/crypto.service';
import { Folder, FolderAttributes } from './folder.domain';
import { SequelizeFolderRepository } from './folder.repository';

@Injectable()
export class FolderService {
  constructor(
    private folderRepository: SequelizeFolderRepository,
    private cryptoService: CryptoService,
  ) {}

  async getFolder(folderId: FolderAttributes['id']) {
    const folder = await this.folderRepository.findById(folderId);
    if (!folder) {
      throw new NotFoundException(`Folder with ID ${folderId} not found`);
    }
    folder.name = this.cryptoService.decryptName(folder.name, folderId);
    return folder.toJSON();
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

    const foldersWithNameDecrypted = [];

    for (const folder of folders) {
      foldersWithNameDecrypted.push({
        ...folder,
        name: this.cryptoService.decryptName(folder.name, folderId),
      });
    }

    return foldersWithNameDecrypted;
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
