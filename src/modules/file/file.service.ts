import { Injectable } from '@nestjs/common';
import { CryptoService } from '../../services/crypto/crypto.service';
import { SequelizeFileRepository } from './file.repository';

@Injectable()
export class FileService {
  constructor(
    private fileRepository: SequelizeFileRepository,
    private cryptoService: CryptoService,
  ) {}

  async getByFolderAndUser(folderId: number, userId: string, deleted = false) {
    const files = await this.fileRepository.findAllByFolderIdAndUserId(
      folderId,
      userId,
      deleted,
    );
    return files.map((file) => {
      file.name = this.cryptoService.decryptName(file.name, folderId);
      return file;
    });
  }

  moveFileToTrash(fileId: string, userId: string) {
    return this.fileRepository.updateByFieldIdAndUserId(fileId, userId, {
      deleted: true,
      deletedAt: new Date(),
    });
  }
}
