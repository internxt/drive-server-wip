import { Environment } from '@internxt/inxt-js';
import { aes } from '@internxt/lib';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CryptoService } from '../../externals/crypto/crypto.service';
import { BridgeService } from '../../externals/bridge/bridge.service';
import { FolderAttributes } from '../folder/folder.attributes';
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
import { ThumbnailUseCases } from '../thumbnail/thumbnail.usecase';
import { UsageService } from '../usage/usage.service';
import { Time } from '../../lib/time';
import { MoveFileDto } from './dto/move-file.dto';
import { MailerService } from '../../externals/mailer/mailer.service';
import { FeatureLimitService } from '../feature-limit/feature-limit.service';
import { PLAN_FREE_INDIVIDUAL_TIER_LABEL } from '../feature-limit/limits.enum';

export type SortParamsFile = Array<[SortableFileAttributes, 'ASC' | 'DESC']>;

@Injectable()
export class FileUseCases {
  constructor(
    private readonly fileRepository: SequelizeFileRepository,
    @Inject(forwardRef(() => FolderUseCases))
    private readonly folderUsecases: FolderUseCases,
    @Inject(forwardRef(() => SharingService))
    private readonly sharingUsecases: SharingService,
    private readonly network: BridgeService,
    private readonly cryptoService: CryptoService,
    private readonly thumbnailUsecases: ThumbnailUseCases,
    private readonly usageService: UsageService,
    private readonly mailerService: MailerService,
    private readonly featureLimitService: FeatureLimitService,
  ) {}

  getByUuid(uuid: FileAttributes['uuid']): Promise<File> {
    return this.fileRepository.findById(uuid);
  }

  getFilesAndUserByUuid(
    uuids: FileAttributes['uuid'][],
    order?: [keyof FileAttributes, 'ASC' | 'DESC'][],
  ): Promise<File[]> {
    return this.fileRepository.getFilesWithUserByUuuid(uuids, order);
  }

  getByUuidsAndUser(
    user: User,
    uuids: FileAttributes['uuid'][],
  ): Promise<File[]> {
    return this.fileRepository.findByUuids(uuids, { userId: user.id });
  }

  async getUserUsedStorage(user: User): Promise<number> {
    this.getUserUsedStorageIncrementally(user).catch((error) => {
      const errorObject = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
      new Logger('[USAGE/CALCULATE_USAGE').error(
        `There was an error calculating the user usage incrementally ${JSON.stringify({ errorObject })}`,
      );
    });
    return this.fileRepository.sumExistentFileSizes(user.id);
  }

  async getUserUsedStorageIncrementally(user: User) {
    const mostRecentUsage = await this.usageService.getUserMostRecentUsage(
      user.uuid,
    );
    const noRecordInUsageTable = !mostRecentUsage;

    if (noRecordInUsageTable) {
      this.handleUserFirstDeltaCreation(user);
      // TODO: uncomment this
      //return this.fileRepository.sumExistentFileSizes(user.id);
      return;
    }

    const nextPeriodStart = mostRecentUsage.getNextPeriodStartDate();
    const isUpToDate = Time.isToday(nextPeriodStart);

    if (!isUpToDate) {
      await this.fillDeltaGapUntilYesteday(user, nextPeriodStart);
    }

    // TODO: add calculation of the current day and sum of all the usages
  }

  async handleUserFirstDeltaCreation(user: User) {
    await this.usageService
      .createFirstUsageCalculation(user.uuid)
      .catch((error) =>
        new Logger('[USAGE/FIRST_CALCULATION]').error(
          `error while calculating first usage ${JSON.stringify({ message: error.message })}`,
        ),
      );
  }

  async fillDeltaGapUntilYesteday(user: User, calculateFrom: Date) {
    const yesterday = Time.dateWithDaysAdded(-1);
    const yesterdayEndOfDay = Time.endOfDay(yesterday);

    const gapDelta = await this.fileRepository.sumFileSizeDeltaBetweenDates(
      user.id,
      calculateFrom,
      yesterdayEndOfDay,
    );
    await this.usageService
      .createMonthlyUsage(user.uuid, yesterday, gapDelta)
      .catch((error) =>
        new Logger('[USAGE/FILL_GAP]').error(
          `error while filling gap in usage ${JSON.stringify({ message: error.message })}`,
        ),
      );
  }

  async deleteFilePermanently(
    user: User,
    where: Partial<File>,
  ): Promise<{ id: number; uuid: string }> {
    const file = await this.fileRepository.findOneBy({
      ...where,
      removed: false,
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    if (!file.isOwnedBy(user)) {
      throw new ForbiddenException('This file is not yours');
    }

    const { id, uuid } = file;

    await Promise.all([
      this.sharingUsecases.bulkRemoveSharings(
        user,
        [uuid],
        SharingItemType.File,
      ),
      this.thumbnailUsecases.deleteThumbnailByFileUuid(user, uuid),
    ]);

    await this.fileRepository.deleteFilesByUser(user, [file]);

    return { id, uuid };
  }

  async deleteFileByFileId(
    user: User,
    bucketId: string,
    fileId: string,
  ): Promise<{ fileExistedInDb: boolean; id?: number; uuid?: string }> {
    const file = await this.fileRepository.findOneBy({
      fileId,
    });

    if (file) {
      const { id, uuid } = await this.deleteFilePermanently(user, {
        uuid: file.uuid,
      });
      return { fileExistedInDb: true, id, uuid };
    }

    try {
      await this.network.deleteFile(user, bucketId, fileId);
    } catch (error) {
      Logger.error(
        `[FILE/ERROR] deleteFileByFileId Error deleting file with fileId ${fileId} from network: ${error.message}`,
      );
      throw new InternalServerErrorException(
        'Error deleting file from network',
      );
    }
    return { fileExistedInDb: false };
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
    const [hadFilesBeforeUpload, folder] = await Promise.all([
      this.hasUploadedFiles(user),
      this.folderUsecases.getByUuid(newFileDto.folderUuid),
    ]);

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

    if (!hadFilesBeforeUpload) {
      const userTier = await this.featureLimitService.getTier(user.tierId);
      const isUserFreeTier =
        userTier?.label === PLAN_FREE_INDIVIDUAL_TIER_LABEL;

      if (isUserFreeTier) {
        await this.mailerService
          .sendFirstUploadEmail(user.email)
          .catch((error) => {
            new Logger('[MAILER/FIRST_UPLOAD]').error(
              `Failed to send first upload email: ${error.message}`,
            );
          });
      }
    }
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

    if (file.status != FileStatus.EXISTS) {
      throw new BadRequestException(`${file.status} files can not be replaced`);
    }

    const { fileId: oldFileId, bucket } = file;
    const { fileId, size, modificationTime } = newFileData;

    await this.fileRepository.updateByUuidAndUserId(fileUuid, user.id, {
      fileId,
      size,
      ...(modificationTime ? { modificationTime } : null),
    });

    const newFile = File.build({ ...file, size, fileId });
    await this.usageService
      .addDailyUsageChangeOnFileSizeChange(user, file, newFile)
      .catch((error) => {
        const errorObject = {
          name: error.name,
          message: error.message,
          stack: error.stack,
        };
        new Logger('addDailyUsageChangeOnFileSizeChange').error(
          `There was an error calculating the user usage incrementally ${JSON.stringify({ errorObject })}`,
        );
      });

    try {
      await this.network.deleteFile(user, bucket, oldFileId);
    } catch (error) {
      new Logger('FILE/REPLACE').error(
        `Error while replacing old file ${JSON.stringify({
          user: { email: user.email, uuid: user.uuid },
          oldFileId,
        })}}, STACK: ${error.stack || 'No stack trace'}`,
      );
    }

    return {
      ...file.toJSON(),
      fileId,
      size,
    };
  }

  async deleteUserTrashedFilesBatch(
    user: User,
    limit: number,
  ): Promise<number> {
    return this.fileRepository.deleteUserTrashedFilesBatch(user.id, limit);
  }

  async moveFile(
    user: User,
    fileUuid: File['fileId'],
    destinationData: MoveFileDto,
  ): Promise<File> {
    const file = await this.fileRepository.findByUuid(fileUuid, user.id);
    if (!file || file.isDeleted()) {
      throw new UnprocessableEntityException(
        `File ${fileUuid} can not be moved`,
      );
    }

    const destinationFolder = await this.folderUsecases.getFolderByUuid(
      destinationData.destinationFolder,
      user,
    );

    if (!destinationFolder || destinationFolder.isRemoved()) {
      throw new UnprocessableEntityException(
        `File can not be moved to ${destinationData.destinationFolder}`,
      );
    }

    const plainName =
      destinationData.name ??
      file.plainName ??
      this.cryptoService.decryptName(file.name, file.folderId);
    const type = destinationData.type ?? file.type;

    file.setPlainName(plainName);
    file.setType(type);

    if (!file.isFilenameValid()) {
      throw new BadRequestException('Filename is not valid');
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
      plainName: file.plainName,
      type: file.type,
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
      return File.build(file);
    }

    return File.build({
      ...file,
      name: decryptedName,
      plainName: decryptedName,
    });
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
    });
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

  async getFile(where: Partial<File>): Promise<File> {
    return this.fileRepository.findOneBy(where);
  }

  async hasUploadedFiles(user: User) {
    const file = await this.fileRepository.findOneBy({ userId: user.id });
    return file !== null;
  }
}
