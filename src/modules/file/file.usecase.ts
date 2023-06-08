import { Environment } from '@internxt/inxt-js';
import { aes } from '@internxt/lib';
import {
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CryptoService } from '../../externals/crypto/crypto.service';
import { BridgeService } from '../../externals/bridge/bridge.service';
import { FolderAttributes } from '../folder/folder.attributes';
import { Share } from '../share/share.domain';
import { ShareUseCases } from '../share/share.usecase';
import { User } from '../user/user.domain';
import { UserAttributes } from '../user/user.attributes';
import { File, FileAttributes, FileOptions } from './file.domain';
import { SequelizeFileRepository } from './file.repository';
import { FolderUseCases } from '../folder/folder.usecase';

@Injectable()
export class FileUseCases {
  constructor(
    private fileRepository: SequelizeFileRepository,
    @Inject(forwardRef(() => ShareUseCases))
    private shareUseCases: ShareUseCases,
    private folderUsecases: FolderUseCases,
    private network: BridgeService,
    private cryptoService: CryptoService,
  ) {}

  async getFileMetadata(user: User, fileUuid: File['uuid']): Promise<File> {
    const file = await this.fileRepository.findByUuid(fileUuid, user.id);

    if (!file) {
      throw new NotFoundException('File not found');
    }

    return file;
  }

  getByFileIdAndUser(
    fileId: FileAttributes['id'],
    userId: UserAttributes['id'],
    options: FileOptions = { deleted: false },
  ): Promise<File> {
    return this.fileRepository.findOne(fileId, userId, options);
  }

  async getFilesByFolderId(
    folderId: FolderAttributes['id'],
    userId: UserAttributes['id'],
    options = { deleted: false, limit: 20, offset: 0 },
  ) {
    const parentFolder = await this.folderUsecases.getFolderByUserId(
      folderId,
      userId,
    );

    if (!parentFolder) {
      throw new NotFoundException();
    }

    if (parentFolder.userId !== userId) {
      throw new ForbiddenException();
    }

    return this.getFiles(
      userId,
      { folderId, deleted: options.deleted },
      options,
    );
  }

  getFilesByIds(user: User, fileIds: File['id'][]): Promise<File[]> {
    return this.fileRepository.findByIds(user.id, fileIds);
  }

  getAllFilesUpdatedAfter(
    userId: UserAttributes['id'],
    updatedAfter: Date,
    options: { limit: number; offset: number },
  ): Promise<File[]> {
    return this.getFilesUpdatedAfter(userId, {}, updatedAfter, options);
  }

  getNotTrashedFilesUpdatedAfter(
    userId: UserAttributes['id'],
    updatedAfter: Date,
    options: { limit: number; offset: number },
  ): Promise<File[]> {
    return this.getFilesUpdatedAfter(
      userId,
      {
        deleted: false,
        removed: false,
      },
      updatedAfter,
      options,
    );
  }

  getRemovedFilesUpdatedAfter(
    userId: UserAttributes['id'],
    updatedAfter: Date,
    options: { limit: number; offset: number },
  ): Promise<File[]> {
    return this.getFilesUpdatedAfter(
      userId,
      { removed: true },
      updatedAfter,
      options,
    );
  }

  getTrashedFilesUpdatedAfter(
    userId: UserAttributes['id'],
    updatedAfter: Date,
    options: { limit: number; offset: number },
  ): Promise<File[]> {
    return this.getFilesUpdatedAfter(
      userId,
      { deleted: true, removed: false },
      updatedAfter,
      options,
    );
  }

  async getFilesUpdatedAfter(
    userId: UserAttributes['id'],
    where: Partial<FileAttributes>,
    updatedAfter: Date,
    options: { limit: number; offset: number },
  ): Promise<File[]> {
    const additionalOrders: Array<[keyof FileAttributes, 'ASC' | 'DESC']> = [
      ['updatedAt', 'ASC'],
    ];
    const files = await this.fileRepository.findAllCursorWhereUpdatedAfter(
      { ...where, userId },
      updatedAfter,
      options.limit,
      options.offset,
      additionalOrders,
    );
    return files.map((file) => file.toJSON());
  }

  async getFiles(
    userId: UserAttributes['id'],
    where: Partial<FileAttributes>,
    options = { limit: 20, offset: 0 },
  ): Promise<File[]> {
    const filesWithMaybePlainName = await this.fileRepository.findAllCursor(
      {
        ...where,
        // enforce userId always
        userId,
      },
      options.limit,
      options.offset,
    );

    return filesWithMaybePlainName.map((file) =>
      file.plainName ? file : this.decrypFileName(file),
    );
  }

  async getByFolderAndUser(
    folderId: FolderAttributes['id'],
    userId: FolderAttributes['userId'],
    options: FileOptions,
  ) {
    const files = await this.fileRepository.findAllByFolderIdAndUserId(
      folderId,
      userId,
      options,
    );

    return files.map((file) => file.toJSON());
  }

  async getByUserExceptParents(
    userId: FolderAttributes['userId'],
    exceptFolderIds: FolderAttributes['id'][],
    options: FileOptions = { deleted: false },
  ) {
    const files = await this.fileRepository.findAllByUserIdExceptFolderIds(
      userId,
      exceptFolderIds,
      options,
    );

    return files.map((file) => file.toJSON());
  }

  moveFilesToTrash(
    user: User,
    fileIds: FileAttributes['fileId'][],
  ): Promise<void> {
    return this.fileRepository.updateFilesStatusToTrashed(user, fileIds);
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

  /**
   * Deletes files of a given user. The file will be deleted in this order:
   * - From the network
   * - From the database
   * @param user User whose files are going to be deleted
   * @param files Files to be deleted
   */
  async deleteByUser(user: User, files: File[]): Promise<void> {
    await this.fileRepository.deleteFilesByUser(user, files);
  }

  decrypFileName(file: File): any {
    const decryptedName = this.cryptoService.decryptName(
      file.name,
      file.folderId,
    );

    if (decryptedName === '') {
      return File.build(file).toJSON();
    }

    return File.build({
      ...file,
      name: decryptedName,
      plainName: decryptedName,
    }).toJSON();
  }

  /**
   * Gets the number of orphan files of a given user
   * @param userId User whose files are orphan
   * @returns The number of orphan files
   */
  getOrphanFilesCount(userId: UserAttributes['id']) {
    return this.fileRepository.getFilesWhoseFolderIdDoesNotExist(userId);
  }

  getTrashFilesCount(userId: UserAttributes['id']) {
    return this.fileRepository.getFilesCountWhere({ userId, deleted: true });
  }

  getDriveFilesCount(userId: UserAttributes['id']) {
    return this.fileRepository.getFilesCountWhere({ userId, deleted: false });
  }
}
