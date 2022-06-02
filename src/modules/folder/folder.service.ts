import { Injectable } from '@nestjs/common';
import { Folder } from './folder.model';
import { SequelizeFolderRepository } from './folder.repository';

@Injectable()
export class FolderService {
  constructor(private folderRepository: SequelizeFolderRepository) {}
  async moveFolderToTrash(folderId: number): Promise<Folder> {
    return await this.folderRepository.updateByFolderId(folderId, {
      deleted: true,
      deletedAt: new Date(),
    });
  }
}
