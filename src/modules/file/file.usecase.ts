import { Environment } from '@internxt/inxt-js';
import { aes } from '@internxt/lib';
import { Injectable } from '@nestjs/common';
import { FolderAttributes } from '../folder/folder.domain';
import { Share } from '../share/share.domain';
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
    return file;
  }
  async getByFolderAndUser(
    folderId: FolderAttributes['id'],
    userId: FolderAttributes['userId'],
    deleted: FolderAttributes['deleted'] = false,
    page?: number,
    perPage?: number,
  ) {
    const files = await this.fileRepository.findAllByFolderIdAndUserId(
      folderId,
      userId,
      deleted,
      page,
      perPage,
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

  async getEncryptionKeyFileFromShare(
    fileId: string,
    network: any,
    share: Share,
    code: string,
  ) {
    const encryptedMnemonic = share.mnemonic.toString();
    const mnemonic = aes.decrypt(encryptedMnemonic, code);
    const { index } = await network.getFileInfo(share.bucket, fileId);
    const encryptionKey = await Environment.utils.generateFileKey(
      mnemonic,
      share.bucket,
      Buffer.from(index, 'hex'),
    );
    return encryptionKey.toString('hex');
  }

  async getTotalSizeOfFilesFromFolder(folderId: number) {
    return await this.fileRepository.getTotalSizeByFolderId(folderId);
  }
}
