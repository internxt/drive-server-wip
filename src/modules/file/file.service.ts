import { Injectable } from '@nestjs/common';
import { SequelizeFileRepository } from './file.repository';

@Injectable()
export class FileService {
  constructor(private fileRepository: SequelizeFileRepository) {}

  async moveFileToTrash(fileId: string, userId: string) {
    return await this.fileRepository.updateByFieldIdAndUserId(fileId, userId, {
      deleted: true,
      deletedAt: new Date(),
    });
  }
}
