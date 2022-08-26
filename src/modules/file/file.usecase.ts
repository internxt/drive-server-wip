import { Environment } from '@internxt/inxt-js';
import { aes } from '@internxt/lib';
import {
  forwardRef,
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { FolderAttributes } from '../folder/folder.domain';
import { Share } from '../share/share.domain';
import { ShareUseCases } from '../share/share.usecase';
import { User, UserAttributes } from '../user/user.domain';
import { File, FileAttributes } from './file.domain';
import { SequelizeFileRepository } from './file.repository';
@Injectable()
export class FileUseCases {
  constructor(
    private fileRepository: SequelizeFileRepository,
    @Inject(forwardRef(() => ShareUseCases))
    private shareUseCases: ShareUseCases,
  ) {}

  async getByFileIdAndUser(
    fileId: FileAttributes['fileId'],
    userId: UserAttributes['id'],
  ): Promise<File> {
    return await this.fileRepository.findOne(fileId, userId);
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

  getTotalSizeOfFilesFromFolder(folderId: number) {
    return this.fileRepository.getTotalSizeByFolderId(folderId);
  }

  async deleteFilePermanently(file: File, user: User): Promise<void> {
    if (!file.deleted) {
      throw new UnprocessableEntityException(
        `file with id ${file.id} cannot be permanently deleted`,
      );
    }

    await this.shareUseCases.deleteFileShare(file.id, user);
    // TODO: delete file from bridge
    await this.fileRepository.deleteByFileId(file.fileId);
  }
}
