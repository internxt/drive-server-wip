import { Injectable } from '@nestjs/common';
import { CryptoService } from '../../externals/crypto/crypto.service';
import { FolderAttributes } from '../folder/folder.domain';
import { FileAttributes } from './file.domain';
import { SequelizeFileRepository } from './file.repository';

@Injectable()
export class FileService {
  constructor(
    private fileRepository: SequelizeFileRepository,
    private cryptoService: CryptoService,
  ) {}

  async getByFolderAndUser(
    folderId: FolderAttributes['id'],
    userId: FolderAttributes['userId'],
    deleted: FolderAttributes['deleted'] = false,
  ) {
    const files = await this.fileRepository.findAllByFolderIdAndUserId(
      folderId,
      userId,
      deleted,
    );

    const filesWithNameDecrypted = [];

    for (const file of files) {
      filesWithNameDecrypted.push({
        ...file,
        name: this.cryptoService.decryptName(file.name, folderId),
      });
    }

    return filesWithNameDecrypted;
  }

  async moveFilesToTrash(
    fileIds: FileAttributes['fileId'][],
    userId: FileAttributes['userId'],
  ): Promise<void> {
    await this.fileRepository.updateManyByFieldIdAndUserId(fileIds, userId, {
      deleted: true,
      deletedAt: new Date(),
    });
  }

  moveFileToTrash(
    fileId: FileAttributes['fileId'],
    userId: FileAttributes['userId'],
  ) {
    return this.fileRepository.updateByFieldIdAndUserId(fileId, userId, {
      deleted: true,
      deletedAt: new Date(),
    });
  }
}
