import { Environment } from '@internxt/inxt-js';
import { aes } from '@internxt/lib';
import {
  ConflictException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CryptoService } from '../../externals/crypto/crypto.service';
import { BridgeService } from '../../externals/bridge/bridge.service';
import { FolderAttributes } from '../folder/folder.attributes';
import { Share } from '../share/share.domain';
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
import { SharingService } from '../sharing/sharing.service';
import { SharingItemType } from '../sharing/sharing.domain';
import { v4 } from 'uuid';
import { CreateFileDto } from './dto/create-file.dto';
import { UpdateFileMetaDto } from './dto/update-file-meta.dto';

type SortParams = Array<[SortableFileAttributes, 'ASC' | 'DESC']>;

@Injectable()
export class FileUseCases {
  constructor(
    private fileRepository: SequelizeFileRepository,
    @Inject(forwardRef(() => FolderUseCases))
    private folderUsecases: FolderUseCases,
    @Inject(forwardRef(() => SharingService))
    private sharingUsecases: SharingService,
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

  async createFile(user: User, newFileDto: CreateFileDto) {
    const folder = await this.folderUsecases.getByUuid(newFileDto.folderUuid);

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    const isTheFolderOwner = folder.isOwnedBy(user);

    if (!isTheFolderOwner) {
      throw new ForbiddenException('Folder is not yours');
    }

    const maybeAlreadyExistentFile = await this.fileRepository.findOneBy({
      name: newFileDto.name,
      folderId: folder.id,
      type: newFileDto.type,
      userId: user.id,
      status: FileStatus.EXISTS,
    });

    const fileAlreadyExists = !!maybeAlreadyExistentFile;

    if (fileAlreadyExists) {
      throw new ConflictException('File already exists');
    }

    const newFile = await this.fileRepository.create({
      uuid: v4(),
      name: newFileDto.name,
      plainName: newFileDto.plainName,
      type: newFileDto.type,
      size: newFileDto.size,
      folderId: folder.id,
      fileId: newFileDto.fileId,
      bucket: newFileDto.bucket,
      encryptVersion: newFileDto.encryptVersion,
      userId: user.id,
      folderUuid: folder.uuid,
      modificationTime: newFileDto.modificationTime || new Date(),
      deleted: false,
      deletedAt: null,
      removed: false,
      createdAt: newFileDto.date ?? new Date(),
      updatedAt: new Date(),
      removedAt: null,
      status: FileStatus.EXISTS,
    });

    return newFile;
  }

  async updateFileMetaData(
    user: User,
    fileUuid: File['uuid'],
    newFileMetada: UpdateFileMetaDto,
  ) {
    const file = await this.fileRepository.findOneBy({
      uuid: fileUuid,
      status: FileStatus.EXISTS,
    });

    if (!file.isOwnedBy(user)) {
      throw new ForbiddenException('This file is not yours');
    }

    const cryptoFileName = this.cryptoService.encryptName(
      newFileMetada.plainName,
      file.folderId,
    );

    const fileWithSameNameExists = await this.fileRepository.findOneBy({
      name: cryptoFileName,
      folderId: file.folderId,
      type: file.type,
      status: FileStatus.EXISTS,
    });

    if (fileWithSameNameExists) {
      throw new ConflictException(
        'A file with this name already exists in this location',
      );
    }

    const updatedFile = await this.fileRepository.updateByUuidAndUserId(
      file.uuid,
      user.id,
      { plainName: newFileMetada.plainName, name: cryptoFileName },
    );

    return updatedFile;
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
    } = {
      limit: 20,
      offset: 0,
    },
  ): Promise<File[]> {
    let filesWithMaybePlainName;
    if (options?.withoutThumbnails)
      filesWithMaybePlainName = await this.fileRepository.findAllCursor(
        { ...where, userId },
        options.limit,
        options.offset,
        options.sort,
      );
    else
      filesWithMaybePlainName =
        await this.fileRepository.findAllCursorWithThumbnails(
          { ...where, userId },
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

  async getFilesInWorkspace(
    createdBy: UserAttributes['uuid'],
    where: Partial<FileAttributes>,
    options: {
      limit: number;
      offset: number;
      sort?: SortParams;
      withoutThumbnails?: boolean;
    } = {
      limit: 20,
      offset: 0,
    },
  ): Promise<File[]> {
    let filesWithMaybePlainName;
    if (options?.withoutThumbnails)
      filesWithMaybePlainName =
        await this.fileRepository.findAllCursorInWorkspace(
          createdBy,
          { ...where },
          options.limit,
          options.offset,
          options.sort,
        );
    else
      filesWithMaybePlainName =
        await this.fileRepository.findAllCursorWithThumbnailsInWorkspace(
          createdBy,
          { ...where },
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

  async moveFilesToTrash(
    user: User,
    fileIds: FileAttributes['fileId'][],
    fileUuids: FileAttributes['uuid'][] = [],
  ): Promise<void> {
    const files = await this.fileRepository.findByFileIds(user.id, fileIds);
    const allFileUuids = [...fileUuids, ...files.map((file) => file.uuid)];

    await Promise.all([
      this.fileRepository.updateFilesStatusToTrashed(user, fileIds),
      this.fileRepository.updateFilesStatusToTrashedByUuid(user, fileUuids),
      this.sharingUsecases.bulkRemoveSharings(
        user,
        allFileUuids,
        SharingItemType.File,
      ),
    ]);
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

  async moveFile(
    user: User,
    fileUuid: File['fileId'],
    destinationUuid: File['folderUuid'],
  ): Promise<File> {
    const file = await this.fileRepository.findByUuid(fileUuid, user.id);
    if (!file || file.removed === true || file.status === FileStatus.DELETED) {
      throw new UnprocessableEntityException(
        `File ${fileUuid} can not be moved`,
      );
    }

    const destinationFolder = await this.folderUsecases.getFolderByUuidAndUser(
      destinationUuid,
      user,
    );
    if (!destinationFolder || destinationFolder.removed === true) {
      throw new UnprocessableEntityException(
        `File can not be moved to ${destinationUuid}`,
      );
    }

    const originalPlainName = this.cryptoService.decryptName(
      file.name,
      file.folderId,
    );
    const destinationEncryptedName = this.cryptoService.encryptName(
      originalPlainName,
      destinationFolder.id,
    );

    const exists = await this.fileRepository.findByNameAndFolderUuid(
      destinationEncryptedName,
      file.type,
      destinationFolder.uuid,
      FileStatus.EXISTS,
    );
    if (exists) {
      if (exists.uuid === file.uuid) {
        throw new ConflictException(
          `File ${fileUuid} was already moved to that location`,
        );
      }
      throw new ConflictException(
        'A file with the same name already exists in destination folder',
      );
    }

    const updateData: Partial<File> = {
      folderId: destinationFolder.id,
      folderUuid: destinationFolder.uuid,
      name: destinationEncryptedName,
      status: FileStatus.EXISTS,
    };

    await this.fileRepository.updateByUuidAndUserId(
      fileUuid,
      user.id,
      updateData,
    );

    return Object.assign(file, updateData);
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
}
