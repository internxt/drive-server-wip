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
import {
  File,
  FileAttributes,
  FileOptions,
  FileStatus,
  SortableFileAttributes,
} from './file.domain';
import { SequelizeFileRepository } from './file.repository';
import { FolderUseCases } from '../folder/folder.usecase';
import { ReplaceFileDto } from './dto/replace-file.dto';
import { FileDto } from './dto/file.dto';
import { Op } from 'sequelize';

type SortParams = Array<[SortableFileAttributes, 'ASC' | 'DESC']>;

@Injectable()
export class FileUseCases {
  constructor(
    private fileRepository: SequelizeFileRepository,
    @Inject(forwardRef(() => ShareUseCases))
    private shareUseCases: ShareUseCases,
    @Inject(forwardRef(() => FolderUseCases))
    private folderUsecases: FolderUseCases,
    private network: BridgeService,
    private cryptoService: CryptoService,
  ) {}

  getByUuid(uuid: FileAttributes['uuid']): Promise<File> {
    return this.fileRepository.findById(uuid);
  }

  getByUserExceptParents(arg: any): Promise<File[]> {
    throw new Error('Method not implemented.');
  }

  getByFileIdAndUser(arg: any): Promise<File> {
    throw new Error('Method not implemented.');
  }

  async deleteFilePermanently(file: File, user: User): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async getFileMetadata(user: User, fileUuid: File['uuid']): Promise<File> {
    const file = await this.fileRepository.findByUuid(fileUuid, user.id);

    if (!file) {
      throw new NotFoundException('File not found');
    }

    return this.decrypFileName(file);
  }

  getByUuids(uuids: File['uuid'][]): Promise<File[]> {
    return this.fileRepository.findByUuids(uuids);
  }

  async getFilesByFolderId(
    folderId: FileAttributes['folderId'],
    userId: FileAttributes['userId'],
    options: { limit: number; offset: number; sort?: SortParams } = {
      limit: 20,
      offset: 0,
    },
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
      { folderId, status: FileStatus.EXISTS },
      options,
    );
  }

  getFilesByIds(user: User, fileIds: File['id'][]): Promise<File[]> {
    return this.fileRepository.findByIds(user.id, fileIds);
  }

  getAllFilesUpdatedAfter(
    userId: UserAttributes['id'],
    updatedAfter: Date,
    options: { limit: number; offset: number; sort?: SortParams },
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
        status: FileStatus.EXISTS,
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
      { status: FileStatus.DELETED },
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
      { status: FileStatus.TRASHED },
      updatedAfter,
      options,
    );
  }

  async getFilesUpdatedAfter(
    userId: UserAttributes['id'],
    where: Partial<FileAttributes>,
    updatedAfter: Date,
    options: { limit: number; offset: number; sort?: SortParams },
  ): Promise<File[]> {
    const additionalOrders: SortParams = options.sort ?? [['updatedAt', 'ASC']];

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
    options: {
      limit: number;
      offset: number;
      sort?: SortParams;
      withoutThumbnails?: boolean;
      updatedAfter?: Date;
    } = {
      limit: 20,
      offset: 0,
    },
  ): Promise<File[]> {
    let filesWithMaybePlainName;
    const updatedAfterCondition = options.updatedAfter
      ? { updatedAt: { [Op.gte]: options.updatedAfter } }
      : null;

    if (options?.withoutThumbnails)
      filesWithMaybePlainName = await this.fileRepository.findAllCursor(
        { ...where, userId, ...updatedAfterCondition },
        options.limit,
        options.offset,
        options.sort,
      );
    else
      filesWithMaybePlainName =
        await this.fileRepository.findAllCursorWithThumbnails(
          { ...where, userId, ...updatedAfterCondition },
          options.limit,
          options.offset,
          options.sort,
        );

    const filesWithThumbnailsModified = filesWithMaybePlainName.map((file) =>
      this.addOldAttributes(file),
    );

    return filesWithThumbnailsModified.map((file) =>
      file.plainName ? file : this.decrypFileName(file),
    );
  }

  async getFilesNotDeleted(
    userId: UserAttributes['id'],
    where: Partial<FileAttributes>,
    options: {
      limit: number;
      offset: number;
    } = {
      limit: 20,
      offset: 0,
    },
  ): Promise<File[]> {
    return this.fileRepository.findAllNotDeleted(
      {
        ...where,
        userId,
      },
      options.limit,
      options.offset,
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

  async getEncryptionKeyFromFile(
    file: File,
    encryptedMnemonic: string,
    code: string,
    network: Environment,
  ): Promise<string> {
    const mnemonic = aes.decrypt(encryptedMnemonic, code);
    const { index } = await network.getFileInfo(file.bucket, file.fileId);
    const encryptionKey = await Environment.utils.generateFileKey(
      mnemonic,
      file.bucket,
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

  async replaceFile(
    user: User,
    fileUuid: File['fileId'],
    newFileData: ReplaceFileDto,
  ): Promise<FileDto> {
    const file = await this.fileRepository.findByUuid(fileUuid, user.id);

    if (!file) {
      throw new NotFoundException(`File ${fileUuid} not found`);
    }

    const { fileId: oldFileId, bucket } = file;
    const { fileId, size } = newFileData;

    await this.fileRepository.updateByUuidAndUserId(fileUuid, user.id, {
      fileId,
      size,
    });
    await this.network.deleteFile(user, bucket, oldFileId);

    return {
      ...file.toJSON(),
      fileId,
      size,
    };
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

  addOldAttributes(file: File): any {
    const thumbnails = file.thumbnails;

    const thumbnailsWithOldAttributers = thumbnails.map((thumbnail) => ({
      ...thumbnail,
      bucket_id: thumbnail.bucketId,
      bucket_file: thumbnail.bucketFile,
    }));

    return File.build({
      ...file,
      thumbnails: thumbnailsWithOldAttributers,
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
    return this.fileRepository.getFilesCountWhere({
      userId,
      status: FileStatus.TRASHED,
    });
  }

  getDriveFilesCount(userId: UserAttributes['id']) {
    return this.fileRepository.getFilesCountWhere({
      userId,
      status: FileStatus.EXISTS,
    });
  }

  async deleteTrashedExpiredFiles() {
    const limit = 1000;
    let hasMore = true;

    while (hasMore) {
      const files = await this.fileRepository.getTrashedExpiredFiles(limit);
      await this.fileRepository.deleteTrashedFilesById(
        files.map((file) => file.fileId),
      );
      hasMore = files.length === limit;
    }
  }
}
