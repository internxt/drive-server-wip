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
import {
  PLAN_FREE_INDIVIDUAL_TIER_LABEL,
  LimitLabels,
} from '../feature-limit/limits.enum';
import { FeatureLimitUsecases } from '../feature-limit/feature-limit.usecase';
import { SequelizeFileVersionRepository } from './file-version.repository';
import { FileVersion, FileVersionStatus } from './file-version.domain';
import { FileVersionDto } from './dto/responses/file-version.dto';
import { UserUseCases } from '../user/user.usecase';
import { RedisService } from '../../externals/redis/redis.service';
import { Usage } from '../usage/usage.domain';
import { TrashItemType } from '../trash/trash.attributes';
import { TrashUseCases } from '../trash/trash.usecase';
import { CacheManagerService } from '../cache-manager/cache-manager.service';
import { PaymentRequiredException } from '../feature-limit/exceptions/payment-required.exception';

export enum VersionableFileExtension {
  PDF = 'pdf',
  DOCX = 'docx',
  XLSX = 'xlsx',
  CSV = 'csv',
}

const VERSIONABLE_FILE_EXTENSIONS = Object.values(VersionableFileExtension);

export type SortParamsFile = Array<[SortableFileAttributes, 'ASC' | 'DESC']>;

@Injectable()
export class FileUseCases {
  constructor(
    private readonly fileRepository: SequelizeFileRepository,
    private readonly fileVersionRepository: SequelizeFileVersionRepository,
    @Inject(forwardRef(() => FolderUseCases))
    private readonly folderUsecases: FolderUseCases,
    @Inject(forwardRef(() => SharingService))
    private readonly sharingUsecases: SharingService,
    @Inject(forwardRef(() => TrashUseCases))
    private readonly trashUsecases: TrashUseCases,
    private readonly network: BridgeService,
    private readonly cryptoService: CryptoService,
    private readonly thumbnailUsecases: ThumbnailUseCases,
    private readonly usageService: UsageService,
    private readonly mailerService: MailerService,
    private readonly featureLimitService: FeatureLimitService,
    private readonly featureLimitUsecases: FeatureLimitUsecases,
    @Inject(forwardRef(() => UserUseCases))
    private readonly userUsecases: UserUseCases,
    private readonly redisService: RedisService,
    private readonly cacheManagerService: CacheManagerService,
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

  async getUserUsedStorage(user: User): Promise<number> {
    const [filesUsage, versionsUsage] = await Promise.all([
      this.getUserUsedStorageIncrementally(user),
      this.fileVersionRepository.sumExistingSizesByUser(user.uuid),
    ]);

    return (filesUsage || 0) + versionsUsage;
  }

  async getUserUsedStorageIncrementally(user: User): Promise<number> {
    const lastTemporalUsage =
      await this.usageService.getMostRecentTemporalUsage(user.uuid);
    const calculateFirstDelta = !lastTemporalUsage;

    if (calculateFirstDelta) {
      const firstUsage = await this.usageService.calculateFirstTemporalUsage(
        user.uuid,
      );
      const today = Time.dateWithTimeAdded(1, 'day', firstUsage.period);
      const deltaChangeToday =
        await this.fileRepository.sumFileSizeDeltaFromDate(user.id, today);

      return firstUsage.delta + deltaChangeToday;
    }

    const aggregatedUsage = await this.usageService.calculateAggregatedUsage(
      user.uuid,
    );
    const nextDeltaStartDate = lastTemporalUsage.getNextPeriodStartDate();
    const deltaChangeSinceLastUsage =
      await this.fileRepository.sumFileSizeDeltaFromDate(
        user.id,
        nextDeltaStartDate,
      );

    //  Backfill missing daily usages until yesterday.
    // TODO: This should be done in a background job (Triggered event) instead of during user usage calculation
    const hasYesterdaysUsage = Time.isToday(nextDeltaStartDate);
    if (!hasYesterdaysUsage) {
      await this.backfillUsageUntilYesterday(user, nextDeltaStartDate).catch(
        (error) => {
          new Logger('[USAGE/BACKFILL]').error(
            {
              user: { email: user.email, uuid: user.uuid, userId: user.id },
              nextDeltaStartDate,
              error,
            },
            'There was an error backfilling user usage',
          );
        },
      );
    }

    return aggregatedUsage + deltaChangeSinceLastUsage;
  }

  async backfillUsageUntilYesterday(user: User, startDate: Date) {
    const yesterday = Time.dateWithTimeAdded(-1, 'day');
    const yesterdayEndOfDay = Time.endOfDay(yesterday);

    const gapDelta = await this.fileRepository.sumFileSizeDeltaBetweenDates(
      user.id,
      startDate,
      yesterdayEndOfDay,
    );
    await this.usageService.createDailyUsage(user.uuid, yesterday, gapDelta);
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

    if (!file.plainName) {
      return this.decrypFileName(file);
    }

    return file;
  }

  async getFileVersions(
    user: User,
    fileUuid: string,
  ): Promise<FileVersionDto[]> {
    const file = await this.fileRepository.findByUuid(fileUuid, user.id, {});

    if (!file) {
      throw new NotFoundException('File not found');
    }

    const [versions, limits] = await Promise.all([
      this.fileVersionRepository.findAllByFileId(fileUuid),
      this.featureLimitService.getFileVersioningLimits(user.uuid),
    ]);

    const { retentionDays } = limits;

    return versions.map((version) => {
      const expiresAt = new Date(version.createdAt);
      expiresAt.setDate(expiresAt.getDate() + retentionDays);

      return {
        ...version.toJSON(),
        expiresAt,
      };
    });
  }

  async deleteFileVersion(
    user: User,
    fileUuid: string,
    versionId: string,
  ): Promise<void> {
    const file = await this.fileRepository.findByUuid(fileUuid, user.id, {});

    if (!file) {
      throw new NotFoundException('File not found');
    }

    if (!file.isOwnedBy(user)) {
      throw new ForbiddenException('You do not own this file');
    }

    const version = await this.fileVersionRepository.findById(versionId);

    if (!version) {
      throw new NotFoundException('Version not found');
    }

    if (version.fileId !== fileUuid) {
      throw new BadRequestException('Version does not belong to this file');
    }

    await this.fileVersionRepository.updateStatus(
      versionId,
      FileVersionStatus.DELETED,
    );
  }

  async restoreFileVersion(
    user: User,
    fileUuid: string,
    versionId: string,
  ): Promise<File> {
    const file = await this.fileRepository.findByUuid(fileUuid, user.id, {});

    if (!file) {
      throw new NotFoundException('File not found');
    }

    if (!file.isOwnedBy(user)) {
      throw new ForbiddenException('You do not own this file');
    }

    const versionToRestore =
      await this.fileVersionRepository.findById(versionId);

    if (!versionToRestore) {
      throw new NotFoundException('Version not found');
    }

    if (versionToRestore.fileId !== fileUuid) {
      throw new BadRequestException('Version does not belong to this file');
    }

    if (versionToRestore.status !== FileVersionStatus.EXISTS) {
      throw new BadRequestException('Cannot restore a deleted version');
    }

    const allVersions =
      await this.fileVersionRepository.findAllByFileId(fileUuid);

    const newerVersions = allVersions.filter(
      (v) =>
        v.createdAt > versionToRestore.createdAt &&
        v.status === FileVersionStatus.EXISTS,
    );

    const idsToDelete = [
      ...newerVersions.map((v) => v.id),
      versionToRestore.id,
    ];

    await Promise.all([
      this.fileVersionRepository.updateStatusBatch(
        idsToDelete,
        FileVersionStatus.DELETED,
      ),
      this.fileRepository.updateByUuidAndUserId(fileUuid, user.id, {
        fileId: versionToRestore.networkFileId,
        size: versionToRestore.size,
        updatedAt: new Date(),
      }),
    ]);

    file.fileId = versionToRestore.networkFileId;
    file.size = versionToRestore.size;

    return file;
  }

  getByUuids(uuids: File['uuid'][]): Promise<File[]> {
    return this.fileRepository.findByUuids(uuids);
  }

  async createFile(user: User, newFileDto: CreateFileDto, tier?) {
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

    const isFileEmpty = BigInt(newFileDto.size) === BigInt(0);

    if (isFileEmpty) {
      await this.checkEmptyFilesLimit(user);
    }

    const newFileId = isFileEmpty ? null : newFileDto.fileId;

    const newFile = await this.fileRepository.create({
      uuid: v4(),
      plainName: newFileDto.plainName,
      type: newFileDto.type,
      size: newFileDto.size,
      folderId: folder.id,
      fileId: newFileId,
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

    await this.cacheManagerService.expireUserUsage(user.uuid).catch((err) => {
      new Logger('[UPLOAD_FILE/USAGE_CACHE]').error(
        `Error while cleaning usage cache for user ${user.uuid}: ${err.message}`,
      );
    });

    if (!hadFilesBeforeUpload) {
      const isUserFreeTier = tier?.label === PLAN_FREE_INDIVIDUAL_TIER_LABEL;

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

  async checkEmptyFilesLimit(user: User) {
    const [limit, emptyFilesCount] = await Promise.all([
      this.featureLimitService.getUserLimitByLabel(
        LimitLabels.MaxZeroSizeFiles,
        user,
      ),
      this.fileRepository.getZeroSizeFilesCountByUser(user.id),
    ]);

    if (!limit || limit.value === '0') {
      throw new PaymentRequiredException(
        'You can not have empty files, upgrade your plan to get more features',
      );
    }

    if (limit.shouldLimitBeEnforced({ currentCount: emptyFilesCount })) {
      throw new BadRequestException('You can not have more empty files');
    }
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

    const type = newFileMetadata.type ?? file.type;

    const updatedFile = File.build({
      ...file,
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

  getFilesByIds(user: User, fileIds: File['id'][]): Promise<File[]> {
    return this.fileRepository.findByIds(user.id, fileIds);
  }

  getAllFilesUpdatedAfter(
    userId: UserAttributes['id'],
    updatedAfter: Date,
    pagination: {
      limit: number;
      offset: number;
      sort?: SortParamsFile;
      lastId?: string;
    },
    bucket?: File['bucket'],
  ): Promise<File[]> {
    const where: Partial<FileAttributes> = {};

    if (bucket) {
      where.bucket = bucket;
    }

    return this.getFilesUpdatedAfter(userId, where, updatedAfter, pagination);
  }

  getNotTrashedFilesUpdatedAfter(
    userId: UserAttributes['id'],
    updatedAfter: Date,
    pagination: { limit: number; offset: number; lastId?: string },
    bucket?: File['bucket'],
  ): Promise<File[]> {
    const where: Partial<FileAttributes> = { status: FileStatus.EXISTS };

    if (bucket) {
      where.bucket = bucket;
    }

    return this.getFilesUpdatedAfter(userId, where, updatedAfter, pagination);
  }

  getRemovedFilesUpdatedAfter(
    userId: UserAttributes['id'],
    updatedAfter: Date,
    pagination: { limit: number; offset: number; lastId?: string },
    bucket?: File['bucket'],
  ): Promise<File[]> {
    const where: Partial<FileAttributes> = { status: FileStatus.DELETED };

    if (bucket) {
      where.bucket = bucket;
    }

    return this.getFilesUpdatedAfter(userId, where, updatedAfter, pagination);
  }

  getTrashedFilesUpdatedAfter(
    userId: UserAttributes['id'],
    updatedAfter: Date,
    pagination: { limit: number; offset: number; lastId?: string },
    bucket?: File['bucket'],
  ): Promise<File[]> {
    const where: Partial<FileAttributes> = { status: FileStatus.TRASHED };

    if (bucket) {
      where.bucket = bucket;
    }

    return this.getFilesUpdatedAfter(userId, where, updatedAfter, pagination);
  }

  async getFilesUpdatedAfter(
    userId: UserAttributes['id'],
    where: Partial<FileAttributes>,
    updatedAfter: Date,
    pagination: {
      limit: number;
      offset: number;
      sort?: SortParamsFile;
      lastId?: string;
    },
  ): Promise<File[]> {
    const additionalOrders: SortParamsFile = pagination.sort ?? [
      ['updatedAt', 'ASC'],
    ];

    const files = await this.fileRepository.findAllCursorWhereUpdatedAfter(
      { ...where, userId },
      updatedAfter,
      pagination.limit,
      pagination.offset,
      additionalOrders,
      pagination.lastId,
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
    tierLabel?: string,
  ): Promise<void> {
    const files = await this.fileRepository.findByFileIds(user.id, fileIds);

    const allFileUuids = [...fileUuids, ...files.map((file) => file.uuid)];

    tierLabel = tierLabel || PLAN_FREE_INDIVIDUAL_TIER_LABEL;

    await Promise.all([
      this.fileRepository.updateFilesStatusToTrashed(user, fileIds),
      this.fileRepository.updateFilesStatusToTrashedByUuid(user, fileUuids),
      this.sharingUsecases.bulkRemoveSharings(
        user,
        allFileUuids,
        SharingItemType.File,
      ),
    ]);

    this.trashUsecases
      .addItemsToTrash(allFileUuids, TrashItemType.File, tierLabel, user.id)
      .catch((err) =>
        Logger.error(`[TRASH] Error adding files to trash: ${err.message}`),
      );
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

    const isFileEmpty = newFileData.size === BigInt(0);

    if (isFileEmpty) {
      await this.checkEmptyFilesLimit(user);
    }

    const newFileId = isFileEmpty ? null : newFileData.fileId;

    const { versionable: shouldVersion } = await this.isFileVersionable(
      user.uuid,
      file.type as VersionableFileExtension,
      file.size,
    );

    if (shouldVersion) {
      await this.applyRetentionPolicy(fileUuid, user.uuid);

      const { fileId, size, modificationTime } = newFileData;

      await Promise.all([
        this.fileVersionRepository.upsert({
          fileId: file.uuid,
          userId: user.uuid,
          networkFileId: file.fileId,
          size: file.size,
          status: FileVersionStatus.EXISTS,
        }),
        this.fileRepository.updateByUuidAndUserId(fileUuid, user.id, {
          fileId: newFileId,
          size,
          updatedAt: new Date(),
          ...(modificationTime ? { modificationTime } : null),
        }),
      ]);

      return {
        ...file.toJSON(),
        fileId: newFileId,
        size,
      };
    }

    const { fileId: oldFileId, bucket } = file;
    const { size, modificationTime } = newFileData;

    await this.fileRepository.updateByUuidAndUserId(fileUuid, user.id, {
      fileId: newFileId,
      size,
      ...(modificationTime ? { modificationTime } : null),
    });

    const newFile = File.build({ ...file, size, fileId: newFileId });

    await this.addFileReplacementDelta(user, file, newFile).catch((error) => {
      const errorObject = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        user: { email: user.email, uuid: user.uuid, userId: user.id },
        newFileData: { size: newFile.size, fileId: newFile.fileId },
        oldFileData: { size: file.size, fileId: file.fileId },
      };
      new Logger('USAGE/REPLACEMENT').error({
        error: errorObject,
        msg: 'There was an error calculating the user usage incrementally',
      });
    });

    if (oldFileId) {
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
    }

    return {
      ...file.toJSON(),
      fileId: newFileId,
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

    const updateData: Partial<File> = {
      folderId: destinationFolder.id,
      folderUuid: destinationFolder.uuid,
      status: FileStatus.EXISTS,
      plainName: file.plainName,
      type: file.type,
    };

    const wasTrashed = file.status === FileStatus.TRASHED;

    await this.fileRepository.updateByUuidAndUserId(
      fileUuid,
      user.id,
      updateData,
    );

    if (wasTrashed && this.trashUsecases) {
      await this.trashUsecases.removeItemsFromTrash(
        [fileUuid],
        TrashItemType.File,
      );
    }

    return Object.assign(file, updateData);
  }

  decrypFileName(file: File): any {
    const decryptedName =
      file.plainName ??
      this.cryptoService.decryptName(file.name, file.folderId);

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

  async addFileReplacementDelta(
    user: User,
    oldFileData: File,
    newFileData: File,
  ): Promise<Usage | null> {
    const lockFileId =
      newFileData.fileId || oldFileData.fileId || newFileData.uuid;
    const lockKey = `file-size-change:${lockFileId}`;
    const lockAcquired = await this.redisService
      .tryAcquireLock(lockKey, 3000)
      .catch((_) => {
        new Logger('USAGE/REPLACEMENT').warn(
          {
            lockKey,
            user: { email: user.email, uuid: user.uuid, userId: user.id },
            newFileData: { size: newFileData.size, fileId: newFileData.fileId },
            oldFileData: { size: oldFileData.size, fileId: oldFileData.fileId },
          },
          'Could not acquire lock for adding file replacement delta',
        );
        return true;
      });

    if (!lockAcquired) {
      return null;
    }

    return this.usageService.addFileReplacementDelta(
      user,
      oldFileData,
      newFileData,
    );
  }

  async isFileVersionable(
    userUuid: string,
    fileType: VersionableFileExtension,
    fileSize: bigint,
  ): Promise<{
    versionable: boolean;
    limits: {
      enabled: boolean;
      maxFileSize: number;
      retentionDays: number;
      maxVersions: number;
    } | null;
  }> {
    if (!VERSIONABLE_FILE_EXTENSIONS.includes(fileType)) {
      return { versionable: false, limits: null };
    }

    const limits =
      await this.featureLimitService.getFileVersioningLimits(userUuid);

    if (!limits.enabled) {
      return { versionable: false, limits };
    }

    if (fileSize > BigInt(limits.maxFileSize)) {
      return { versionable: false, limits };
    }

    return { versionable: true, limits };
  }

  private async applyRetentionPolicy(
    fileUuid: string,
    userUuid: string,
  ): Promise<void> {
    const limits =
      await this.featureLimitService.getFileVersioningLimits(userUuid);

    if (!limits.enabled) {
      return;
    }

    const { retentionDays, maxVersions } = limits;

    const cutoffDate = Time.daysAgo(retentionDays);

    const versions = await this.fileVersionRepository.findAllByFileId(fileUuid);

    const versionsToDeleteByAge = versions.filter(
      (version) => version.createdAt < cutoffDate,
    );

    const remainingVersions = versions
      .filter((version) => version.createdAt >= cutoffDate)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const versionsToDeleteByCount = remainingVersions.slice(maxVersions);

    const versionsToDelete = [
      ...versionsToDeleteByAge,
      ...versionsToDeleteByCount,
    ];

    const remainingCount = versions.length - versionsToDelete.length;
    if (remainingCount >= maxVersions) {
      const versionsNotDeleted = versions.filter(
        (v) => !versionsToDelete.some((vd) => vd.id === v.id),
      );
      const oldestVersion = versionsNotDeleted.sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      )[0];

      if (oldestVersion) {
        versionsToDelete.push(oldestVersion);
      }
    }

    if (versionsToDelete.length > 0) {
      const idsToDelete = versionsToDelete.map((v) => v.id);
      await this.fileVersionRepository.updateStatusBatch(
        idsToDelete,
        FileVersionStatus.DELETED,
      );
    }
  }

  async getVersioningLimits(userUuid: string): Promise<{
    enabled: boolean;
    maxFileSize: number;
    retentionDays: number;
    maxVersions: number;
  }> {
    return this.featureLimitService.getFileVersioningLimits(userUuid);
  }
}
