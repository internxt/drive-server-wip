import { Environment } from '@internxt/inxt-js';
import { aes } from '@internxt/lib';
import {
  BadRequestException,
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
import { WorkspaceAttributes } from '../workspaces/attributes/workspace.attributes';
import { Folder } from '../folder/folder.domain';
import { getPathFileData } from '../../lib/path';
import { isStringEmpty } from '../../lib/validators';
import { FileModel } from './file.model';

export type SortParamsFile = Array<[SortableFileAttributes, 'ASC' | 'DESC']>;

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

  getByUuidsAndUser(
    user: User,
    uuids: FileAttributes['uuid'][],
  ): Promise<File[]> {
    return this.fileRepository.findByUuids(uuids, { userId: user.id });
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

    const cryptoFileName = this.cryptoService.encryptName(
      newFileDto.plainName,
      folder.id,
    );

    const exists = await this.fileRepository.findByPlainNameAndFolderId(
      user.id,
      newFileDto.plainName,
      newFileDto.type,
      folder.id,
      FileStatus.EXISTS,
    );
    if (exists) {
      throw new ConflictException('File already exists');
    }

    const newFile = await this.fileRepository.create({
      uuid: v4(),
      name: cryptoFileName,
      plainName: newFileDto.plainName,
      type: newFileDto.type,
      size: newFileDto.size,
      folderId: folder.id,
      fileId: newFileDto.fileId,
      bucket: newFileDto.bucket,
      encryptVersion: newFileDto.encryptVersion,
      userId: user.id,
      folderUuid: folder.uuid,
      deleted: false,
      deletedAt: null,
      removed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      removedAt: null,
      status: FileStatus.EXISTS,
      modificationTime: newFileDto.modificationTime || new Date(),
      creationTime: newFileDto.creationTime || newFileDto.date || new Date(),
    });

    return newFile;
  }

  async searchFilesInFolder(
    folder: Folder,
    searchFilter: { plainName: File['plainName']; type?: File['type'] }[],
  ): Promise<File[]> {
    return this.fileRepository.findFilesInFolderByName(
      folder.uuid,
      searchFilter,
    );
  }

  async updateFileMetaData(
    user: User,
    fileUuid: File['uuid'],
    newFileMetadata: UpdateFileMetaDto,
  ) {
    if (
      isStringEmpty(newFileMetadata.plainName) &&
      isStringEmpty(newFileMetadata.type)
    ) {
      throw new BadRequestException('Filename cannot be empty');
    }

    const file = await this.fileRepository.findOneBy({
      uuid: fileUuid,
      status: FileStatus.EXISTS,
      userId: user.id,
    });
    if (!file) {
      throw new NotFoundException('File not found');
    }
    if (!file.isOwnedBy(user)) {
      throw new ForbiddenException('This file is not yours');
    }

    const plainName =
      newFileMetadata.plainName ??
      file.plainName ??
      this.cryptoService.decryptName(file.name, file.folderId);
    const cryptoFileName = newFileMetadata.plainName
      ? this.cryptoService.encryptName(newFileMetadata.plainName, file.folderId)
      : file.name;
    const type = newFileMetadata.type ?? file.type;

    const updatedFile = File.build({
      ...file,
      name: cryptoFileName,
      plainName,
      type,
    });

    const fileWithSameNameExists = await this.findByPlainNameAndFolderId(
      updatedFile.userId,
      updatedFile.plainName,
      updatedFile.type,
      updatedFile.folderId,
    );
    if (fileWithSameNameExists) {
      throw new ConflictException(
        'A file with this name already exists in this location',
      );
    }

    const modificationTime = new Date();

    await this.fileRepository.updateByUuidAndUserId(updatedFile.uuid, user.id, {
      plainName: updatedFile.plainName,
      name: updatedFile.name,
      type: updatedFile.type,
      modificationTime: modificationTime,
    });

    return {
      ...updatedFile.toJSON(),
      modificationTime,
    };
  }

  async getFilesByFolderUuid(
    folderUuid: FileAttributes['folderUuid'],
    status: FileStatus,
  ) {
    return this.fileRepository.getFilesByFolderUuid(folderUuid, status);
  }

  async getFilesByFolderId(
    folderId: FileAttributes['folderId'],
    userId: FileAttributes['userId'],
    options: { limit: number; offset: number; sort?: SortParamsFile } = {
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
    options: { limit: number; offset: number; sort?: SortParamsFile },
    bucket?: File['bucket'],
  ): Promise<File[]> {
    const where: Partial<FileAttributes> = {};

    if (bucket) {
      where.bucket = bucket;
    }

    return this.getFilesUpdatedAfter(userId, where, updatedAfter, options);
  }

  getNotTrashedFilesUpdatedAfter(
    userId: UserAttributes['id'],
    updatedAfter: Date,
    options: { limit: number; offset: number },
    bucket?: File['bucket'],
  ): Promise<File[]> {
    const where: Partial<FileAttributes> = { status: FileStatus.EXISTS };

    if (bucket) {
      where.bucket = bucket;
    }

    return this.getFilesUpdatedAfter(userId, where, updatedAfter, options);
  }

  getRemovedFilesUpdatedAfter(
    userId: UserAttributes['id'],
    updatedAfter: Date,
    options: { limit: number; offset: number },
    bucket?: File['bucket'],
  ): Promise<File[]> {
    const where: Partial<FileAttributes> = { status: FileStatus.DELETED };

    if (bucket) {
      where.bucket = bucket;
    }

    return this.getFilesUpdatedAfter(userId, where, updatedAfter, options);
  }

  getTrashedFilesUpdatedAfter(
    userId: UserAttributes['id'],
    updatedAfter: Date,
    options: { limit: number; offset: number },
    bucket?: File['bucket'],
  ): Promise<File[]> {
    const where: Partial<FileAttributes> = { status: FileStatus.TRASHED };

    if (bucket) {
      where.bucket = bucket;
    }

    return this.getFilesUpdatedAfter(userId, where, updatedAfter, options);
  }

  async getFilesUpdatedAfter(
    userId: UserAttributes['id'],
    where: Partial<FileAttributes>,
    updatedAfter: Date,
    options: { limit: number; offset: number; sort?: SortParamsFile },
  ): Promise<File[]> {
    const additionalOrders: SortParamsFile = options.sort ?? [
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

  async getWorkspaceFilesUpdatedAfter(
    createdBy: UserAttributes['uuid'],
    workspaceId: WorkspaceAttributes['id'],
    updatedAfter: Date,
    where: Partial<FileAttributes>,
    options: {
      limit: number;
      offset: number;
      sort?: SortParamsFile;
    },
  ): Promise<File[]> {
    const additionalOrders: Array<[keyof FileModel, string]> = options.sort ?? [
      ['updatedAt', 'ASC'],
    ];

    const files =
      await this.fileRepository.findAllCursorWhereUpdatedAfterInWorkspace(
        createdBy,
        workspaceId,
        { ...where },
        updatedAfter,
        options.limit,
        options.offset,
        additionalOrders,
      );

    return files;
  }

  async getFiles(
    userId: UserAttributes['id'],
    where: Partial<FileAttributes>,
    options: {
      limit: number;
      offset: number;
      sort?: SortParamsFile;
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

  async getWorkspaceFilesSizeSumByStatuses(
    createdBy: UserAttributes['uuid'],
    workspaceId: WorkspaceAttributes['id'],
    statuses: FileStatus[],
  ) {
    return this.fileRepository.getSumSizeOfFilesInWorkspaceByStatuses(
      createdBy,
      workspaceId,
      statuses,
    );
  }

  async getFilesInWorkspace(
    createdBy: UserAttributes['uuid'],
    workspaceId: WorkspaceAttributes['id'],
    where: Partial<FileAttributes>,
    options: {
      limit: number;
      offset: number;
      sort?: SortParamsFile;
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
          workspaceId,
          { ...where },
          options.limit,
          options.offset,
          options.sort,
        );
    else
      filesWithMaybePlainName =
        await this.fileRepository.findAllCursorWithThumbnailsInWorkspace(
          createdBy,
          workspaceId,
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

    const destinationFolder = await this.folderUsecases.getFolderByUuid(
      destinationUuid,
      user,
    );
    if (!destinationFolder || destinationFolder.removed === true) {
      throw new UnprocessableEntityException(
        `File can not be moved to ${destinationUuid}`,
      );
    }

    const exists = await this.fileRepository.findByPlainNameAndFolderId(
      file.userId,
      file.plainName,
      file.type,
      destinationFolder.id,
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

    const destinationEncryptedName = this.cryptoService.encryptName(
      file.plainName,
      destinationFolder.id,
    );

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

  async findByPlainNameAndFolderId(
    userId: FileAttributes['userId'],
    plainName: FileAttributes['plainName'],
    type: FileAttributes['type'],
    folderId: FileAttributes['folderId'],
  ): Promise<File | null> {
    return this.fileRepository.findByPlainNameAndFolderId(
      userId,
      plainName,
      type,
      folderId,
      FileStatus.EXISTS,
    );
  }

  async getFileMetadataByPath(
    user: UserAttributes,
    filePath: string,
  ): Promise<File | null> {
    const path = getPathFileData(filePath);

    const folder = await this.folderUsecases.getFolderMetadataByPath(
      user,
      path.folderPath,
    );
    if (!folder) {
      throw new NotFoundException('Parent folders not found');
    }

    const file = await this.findByPlainNameAndFolderId(
      user.id,
      path.fileName,
      path.fileType,
      folder.id,
    );
    return file;
  }
}
