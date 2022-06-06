import { Injectable, NotFoundException } from '@nestjs/common';
import { CryptoService } from '../../services/crypto/crypto.service';
import { Folder } from './folder.model';
import { SequelizeFolderRepository } from './folder.repository';

@Injectable()
export class FolderService {
  constructor(
    private folderRepository: SequelizeFolderRepository,
    private cryptoService: CryptoService,
  ) {}

  async getFolder(folderId: number) {
    const folder = await this.folderRepository.findById(folderId);
    if (!folder) {
      throw new NotFoundException(`Folder with ID ${folderId} not found`);
    }
    return folder.toJSON();
  }

  async getChildrenFoldersToUser(
    folderId: number,
    userId: string,
    deleted = false,
  ) {
    const folders = await this.folderRepository.findAllByParentIdAndUserId(
      folderId,
      userId,
      deleted,
    );
    return folders.map((folder) => {
      folder.name = this.cryptoService.decryptName(folder.name, folderId);
      return folder.toJSON();
    });
  }

  async moveFolderToTrash(folderId: number): Promise<Folder> {
    return await this.folderRepository.updateByFolderId(folderId, {
      deleted: true,
      deletedAt: new Date(),
    });
  }
}
