import { Injectable } from '@nestjs/common';
import { FolderAttributes } from '../folder/folder.domain';
import { UserAttributes } from '../user/user.domain';
import { FileAttributes } from './file.domain';
import { SequelizeFileRepository } from './file.repository';
@Injectable()
export class FileUseCases {
  constructor(private fileRepository: SequelizeFileRepository) {}

  async getByFileIdAndUser(
    fileId: FileAttributes['fileId'],
    userId: UserAttributes['id'],
  ) {
    const file = await this.fileRepository.findOne(fileId, userId);
    return file.toJSON();
  }
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

    return files.map((file) => file.toJSON());
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
