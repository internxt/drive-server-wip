import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { File, FileAttributes, FileOptions, FileStatus } from './file.domain';
import {
  FindOptions,
  Op,
  QueryTypes,
  Sequelize,
  WhereOptions,
} from 'sequelize';
import { Literal } from 'sequelize/types/utils';

import { User } from '../user/user.domain';
import { UserModel } from './../user/user.model';
import { Folder } from '../folder/folder.domain';
import { Pagination } from '../../lib/pagination';
import { ThumbnailModel } from '../thumbnail/thumbnail.model';
import { FileModel } from './file.model';
import { SharingModel } from '../sharing/models';
import {
  WorkspaceItemType,
  WorkspaceItemUserAttributes,
} from '../workspaces/attributes/workspace-items-users.attributes';
import { WorkspaceItemUserModel } from '../workspaces/models/workspace-items-users.model';
import { WorkspaceAttributes } from '../workspaces/attributes/workspace.attributes';

export interface FileRepository {
  create(file: Omit<FileAttributes, 'id'>): Promise<File | null>;
  deleteByFileId(fileId: any): Promise<any>;
  deleteFilesByUser(user: User, files: File[]): Promise<void>;
  destroyFile(where: Partial<FileModel>): Promise<void>;
  findAll(): Promise<Array<File> | []>;
  findAllByFolderIdAndUserId(
    folderId: FileAttributes['folderId'],
    userId: FileAttributes['userId'],
    options: FileOptions,
  ): Promise<Array<File> | []>;
  findAllCursor(
    where: Partial<Record<keyof FileAttributes, any>>,
    limit: number,
    offset: number,
    order: Array<[keyof FileModel, string]>,
  ): Promise<Array<File> | []>;
  findAllCursorInWorkspace(
    createdBy: WorkspaceItemUserAttributes['createdBy'],
    workspaceId: WorkspaceAttributes['id'],
    where: Partial<Record<keyof FileAttributes, any>>,
    limit: number,
    offset: number,
    order: Array<[keyof FileModel, string]>,
  ): Promise<Array<File> | []>;
  findAllCursorWhereUpdatedAfter(
    where: Partial<Record<keyof FileAttributes, any>>,
    updatedAtAfter: Date,
    limit: number,
    offset: number,
    additionalOrders: Array<[keyof FileModel, string]>,
    lastId?: FileAttributes['uuid'],
  ): Promise<Array<File> | []>;
  findAllCursorWhereUpdatedAfterInWorkspace(
    createdBy: WorkspaceItemUserAttributes['createdBy'],
    workspaceId: WorkspaceAttributes['id'],
    where: Partial<FileAttributes>,
    updatedAtAfter: Date,
    limit: number,
    offset: number,
    additionalOrders?: Array<[keyof FileModel, string]>,
  ): Promise<File[]>;
  findAllCursorWithThumbnailsInWorkspace(
    createdBy: WorkspaceItemUserAttributes['createdBy'],
    workspaceId: WorkspaceAttributes['id'],
    where: Partial<Record<keyof FileAttributes, any>>,
    limit: number,
    offset: number,
    order: Array<[keyof FileModel, string]>,
  ): Promise<Array<File> | []>;
  findOneBy(where: Partial<FileAttributes>): Promise<File | null>;
  findByUuid(
    fileUuid: FileAttributes['uuid'],
    userId: FileAttributes['userId'],
    where: FindOptions<FileAttributes>,
  ): Promise<File | null>;
  findFilesInFolderByName(
    folderId: Folder['uuid'],
    searchBy: { plainName: File['plainName']; type?: File['type'] }[],
  ): Promise<File[]>;
  findByPlainNameAndFolderId(
    userId: File['userId'],
    plainName: FileAttributes['plainName'],
    type: FileAttributes['type'],
    folderId: FileAttributes['folderId'],
    status: FileAttributes['status'],
  ): Promise<File | null>;
  getSumSizeOfFilesInWorkspaceByStatuses(
    createdBy: WorkspaceItemUserAttributes['createdBy'],
    workspaceId: WorkspaceAttributes['id'],
    statuses: FileStatus[],
  ): Promise<number>;
  updateByUuidAndUserId(
    uuid: FileAttributes['uuid'],
    userId: FileAttributes['userId'],
    update: Partial<File>,
  ): Promise<void>;
  getFilesWhoseFolderIdDoesNotExist(userId: File['userId']): Promise<number>;
  getFilesCountWhere(where: Partial<File>): Promise<number>;
  getZeroSizeFilesCountByUser(userId: User['id']): Promise<number>;
  updateFilesStatusToTrashed(
    user: User,
    fileIds: File['fileId'][],
  ): Promise<void>;
  updateFilesStatusToTrashedByUuid(
    user: User,
    fileUuids: File['uuid'][],
  ): Promise<void>;
  findByFileIds(
    userId: User['id'],
    fileIds: FileAttributes['fileId'][],
  ): Promise<File[]>;
  getFilesByFolderUuid(
    folderUuid: Folder['uuid'],
    status: FileStatus,
  ): Promise<File[]>;
  getFilesWithUserByUuuid(
    fileUuids: string[],
    order?: [keyof FileModel, 'ASC' | 'DESC'][],
  ): Promise<File[]>;
  getFilesWithWorkspaceUser(
    fileUuids: string[],
    order?: [keyof FileModel, 'ASC' | 'DESC'][],
  ): Promise<File[]>;
  deleteUserTrashedFilesBatch(userId: number, limit: number): Promise<number>;
  sumFileSizeDeltaBetweenDates(
    userId: FileAttributes['userId'],
    userUuid: User['uuid'],
    sinceDate: Date,
    untilDate: Date,
  ): Promise<number>;
  sumFileSizeDeltaFromDate(
    userId: FileAttributes['userId'],
    userUuid: User['uuid'],
    sinceDate: Date,
  ): Promise<number>;
}

@Injectable()
export class SequelizeFileRepository implements FileRepository {
  constructor(
    @InjectModel(FileModel)
    private readonly fileModel: typeof FileModel,
    @InjectModel(ThumbnailModel)
    private readonly thumbnailModel: typeof ThumbnailModel,
  ) {}

  async deleteByFileId(fileId: any): Promise<unknown> {
    throw new Error('Method not implemented.');
  }

  async findAll(): Promise<Array<File> | []> {
    const files = await this.fileModel.findAll();
    return files.map((file) => {
      return this.toDomain(file);
    });
  }

  async create(file: Omit<FileAttributes, 'id'>): Promise<File | null> {
    const raw = await this.fileModel.create(file);

    return raw ? this.toDomain(raw) : null;
  }

  async findByFileIds(
    userId: User['id'],
    fileIds: FileAttributes['fileId'][],
  ): Promise<File[]> {
    const files = await this.fileModel.findAll({
      where: {
        userId: userId,
        fileId: {
          [Op.in]: fileIds,
        },
      },
    });

    return files.map(this.toDomain.bind(this));
  }

  async findById(
    fileUuid: string,
    where: FindOptions<FileAttributes> = {},
  ): Promise<File> {
    const file = await this.fileModel.findOne({
      where: {
        uuid: fileUuid,
        ...where,
      },
    });

    return this.toDomain(file);
  }

  async getFilesWithUserByUuuid(
    fileUuids: string[],
    order?: [keyof FileModel, 'ASC' | 'DESC'][],
  ): Promise<File[]> {
    const appliedOrder = order ? this.applyCollateToPlainNameSort(order) : null;

    const files = await this.fileModel.findAll({
      where: {
        uuid: { [Op.in]: fileUuids },
      },
      include: [
        {
          model: UserModel,
          as: 'user',
          attributes: [
            'uuid',
            'email',
            'name',
            'lastname',
            'avatar',
            'userId',
            'bridgeUser',
          ],
        },
      ],
      order: appliedOrder,
    });

    return files.map(this.toDomain.bind(this));
  }

  async getFilesWithWorkspaceUser(
    fileUuids: string[],
    order?: [keyof FileModel, 'ASC' | 'DESC'][],
  ): Promise<File[]> {
    const appliedOrder = order ? this.applyCollateToPlainNameSort(order) : null;

    const files = await this.fileModel.findAll({
      where: {
        uuid: { [Op.in]: fileUuids },
        status: FileStatus.EXISTS,
      },
      include: [
        {
          model: WorkspaceItemUserModel,
          as: 'workspaceUser',
          include: [
            {
              model: UserModel,
              as: 'creator',
              attributes: ['uuid', 'email', 'name', 'lastname', 'avatar'],
            },
          ],
        },
      ],
      order: appliedOrder,
    });

    return files.map(this.toDomain.bind(this));
  }

  async findByUuids(
    uuids: FileAttributes['uuid'][],
    where: Partial<Omit<FileAttributes, 'uuid'>> = {},
  ): Promise<Array<File> | []> {
    const files = await this.fileModel.findAll({
      where: {
        uuid: {
          [Op.in]: uuids,
          ...where,
        },
      },
    });

    return files.map(this.toDomain.bind(this));
  }

  async findByUuid(
    fileUuid: string,
    userId: number,
    where: FindOptions<FileAttributes> = {},
  ): Promise<File | null> {
    const file = await this.fileModel.findOne({
      where: {
        uuid: fileUuid,
        userId,
        ...where,
      },
    });

    return file ? this.toDomain(file) : null;
  }

  async findByPlainNameAndFolderId(
    userId: FileAttributes['userId'],
    plainName: FileAttributes['plainName'],
    type: FileAttributes['type'],
    folderId: FileAttributes['folderId'],
    status: FileAttributes['status'],
  ): Promise<File | null> {
    const typeCondition =
      type == null || type.trim() === ''
        ? { [Op.or]: [{ [Op.is]: null }, { [Op.eq]: '' }] }
        : { [Op.eq]: type };

    const file = await this.fileModel.findOne({
      where: {
        userId: { [Op.eq]: userId },
        plainName: { [Op.eq]: plainName },
        type: typeCondition,
        folderId: { [Op.eq]: folderId },
        status: { [Op.eq]: status },
      },
    });
    return file ? this.toDomain(file) : null;
  }

  async findAllCursorWhereUpdatedAfter(
    where: Partial<FileAttributes>,
    updatedAtAfter: Date,
    limit: number,
    offset: number,
    additionalOrders: Array<[keyof FileModel, string]> = [],
    lastId?: FileAttributes['uuid'],
  ): Promise<Array<File> | []> {
    let whereCondition: Partial<Record<keyof FileAttributes, any>> = {
      ...where,
      updatedAt: { [Op.gt]: updatedAtAfter },
    };
    if (lastId) {
      whereCondition = {
        ...whereCondition,
        uuid: { [Op.gt]: lastId },
      };
    }
    const files = await this.findAllCursor(
      whereCondition,
      limit,
      lastId ? 0 : offset,
      additionalOrders,
    );

    return files.map(this.toDomain.bind(this));
  }

  async findAllNotDeleted(
    where: Partial<Record<keyof FileAttributes, any>>,
    limit: number,
    offset: number,
    order: Array<[keyof FileModel, string]> = [],
  ): Promise<File[]> {
    const files = await this.fileModel.findAll({
      limit,
      offset,
      where: {
        ...where,
        status: {
          [Op.not]: FileStatus.DELETED,
        },
      },
      order,
    });

    return files.map(this.toDomain.bind(this));
  }

  private applyCollateToPlainNameSort(
    order: Array<[keyof FileModel, string]>,
  ): Array<[keyof FileModel, string] | Literal> {
    const plainNameIndex = order.findIndex(
      ([field, _]) => field === 'plainName',
    );
    const isPlainNameSort = plainNameIndex !== -1;

    if (!isPlainNameSort) {
      return order;
    }

    const newOrder: Array<[keyof FileModel, string] | Literal> =
      structuredClone(order);
    const [, orderDirection] = order[plainNameIndex];
    newOrder[plainNameIndex] = Sequelize.literal(
      `plain_name COLLATE "custom_numeric" ${
        orderDirection === 'ASC' ? 'ASC' : 'DESC'
      }`,
    );

    return newOrder;
  }

  async findAllCursor(
    where: Partial<Record<keyof FileAttributes, any>>,
    limit: number,
    offset: number,
    order: Array<[keyof FileModel, string]> = [],
  ): Promise<Array<File> | []> {
    const appliedOrder = this.applyCollateToPlainNameSort(order);

    const files = await this.fileModel.findAll({
      limit,
      offset,
      where,
      subQuery: false,
      order: appliedOrder,
    });

    return files.map(this.toDomain.bind(this));
  }

  async findAllCursorWhereUpdatedAfterInWorkspace(
    createdBy: WorkspaceItemUserAttributes['createdBy'],
    workspaceId: WorkspaceAttributes['id'],
    where: Partial<FileAttributes>,
    updatedAtAfter: Date,
    limit: number,
    offset: number,
    additionalOrders: Array<[keyof FileModel, string]> = [],
  ): Promise<File[]> {
    const files = await this.findAllCursorInWorkspace(
      createdBy,
      workspaceId,
      {
        ...where,
        updatedAt: { [Op.gt]: updatedAtAfter },
      },
      limit,
      offset,
      additionalOrders,
    );

    return files;
  }

  async findAllCursorInWorkspace(
    createdBy: WorkspaceItemUserAttributes['createdBy'],
    workspaceId: WorkspaceAttributes['id'],
    where: Partial<Record<keyof FileAttributes, any>>,
    limit: number,
    offset: number,
    order: Array<[keyof FileModel, string]> = [],
  ): Promise<Array<File> | []> {
    const appliedOrder = this.applyCollateToPlainNameSort(order);

    const files = await this.fileModel.findAll({
      limit,
      offset,
      where,
      include: [
        {
          model: WorkspaceItemUserModel,
          where: {
            createdBy,
            workspaceId,
            itemType: WorkspaceItemType.File,
          },
          as: 'workspaceUser',
          include: [
            {
              model: UserModel,
              as: 'creator',
              attributes: ['uuid', 'email', 'name', 'lastname', 'userId'],
              required: true,
            },
          ],
        },
      ],
      subQuery: false,
      order: appliedOrder,
    });

    return files.map(this.toDomain.bind(this));
  }

  async getSumSizeOfFilesInWorkspaceByStatuses(
    createdBy: WorkspaceItemUserAttributes['createdBy'],
    workspaceId: WorkspaceAttributes['id'],
    statuses: FileStatus[],
  ): Promise<number> {
    const statusesFilter = statuses.map((value) => ({ status: value }));

    const sizes = await this.fileModel.findAll({
      attributes: [[Sequelize.fn('sum', Sequelize.col('size')), 'total']],
      raw: true,
      where: {
        [Op.or]: statusesFilter,
      },
      include: {
        model: WorkspaceItemUserModel,
        attributes: [],
        where: { createdBy, workspaceId },
      },
    });

    return sizes[0]['total'] as unknown as number;
  }

  async findAllCursorWithThumbnails(
    where: Partial<Record<keyof FileAttributes, any>>,
    limit: number,
    offset: number,
    order: Array<[keyof FileModel, string]> = [],
  ): Promise<Array<File> | []> {
    const appliedOrder = this.applyCollateToPlainNameSort(order);

    const files = await this.fileModel.findAll({
      limit,
      offset,
      where,
      include: [
        {
          separate: true,
          model: this.thumbnailModel,
          required: false,
        },
        {
          separate: true,
          model: SharingModel,
          attributes: ['type', 'id'],
          required: false,
        },
      ],
      subQuery: false,
      order: appliedOrder,
    });

    return files.map(this.toDomain.bind(this));
  }

  async findAllCursorWithThumbnailsInWorkspace(
    createdBy: WorkspaceItemUserAttributes['createdBy'],
    workspaceId: WorkspaceAttributes['id'],
    where: Partial<Record<keyof FileAttributes, any>>,
    limit: number,
    offset: number,
    order: Array<[keyof FileModel, string]> = [],
  ): Promise<Array<File> | []> {
    const appliedOrder = this.applyCollateToPlainNameSort(order);

    const files = await this.fileModel.findAll({
      limit,
      offset,
      where,
      include: [
        {
          model: this.thumbnailModel,
          required: false,
        },
        {
          separate: true,
          model: SharingModel,
          attributes: ['type', 'id'],
          required: false,
        },
        {
          model: WorkspaceItemUserModel,
          where: {
            createdBy,
            workspaceId,
            itemType: WorkspaceItemType.File,
          },
          as: 'workspaceUser',
          include: [
            {
              model: UserModel,
              as: 'creator',
              attributes: ['uuid', 'email', 'name', 'lastname', 'userId'],
              required: true,
            },
          ],
        },
      ],
      subQuery: false,
      order: appliedOrder,
    });

    return files.map(this.toDomain.bind(this));
  }

  async findByUuidNotDeleted(uuid: FileAttributes['uuid']): Promise<File> {
    const file = await this.fileModel.findOne({
      where: { uuid, deleted: false },
    });

    return file ? this.toDomain(file) : null;
  }

  async findByIds(
    userId: FileAttributes['userId'],
    ids: FileAttributes['id'][],
  ): Promise<File[]> {
    const files = await this.fileModel.findAll({
      where: { id: { [Op.in]: ids }, userId },
    });

    return files.map(this.toDomain.bind(this));
  }

  async findAllByFolderIdAndUserId(
    folderId: FileAttributes['folderId'],
    userId: FileAttributes['userId'],
    { deleted, page, perPage }: FileOptions,
  ): Promise<Array<File> | []> {
    const { offset, limit } = Pagination.calculatePagination(page, perPage);
    const query: FindOptions = {
      where: { folderId, userId, deleted },
      order: [['id', 'ASC']],
    };
    if (page && perPage) {
      query.offset = offset;
      query.limit = limit;
    }
    const files = await this.fileModel.findAll(query);
    return files.map((file) => {
      return this.toDomain(file);
    });
  }

  async getFilesByFolderUuid(
    folderUuid: Folder['uuid'],
    status: FileStatus,
  ): Promise<File[]> {
    const files = await this.fileModel.findAll({
      where: {
        folderUuid,
        status,
      },
      include: [
        {
          model: this.thumbnailModel,
          as: 'thumbnails',
          required: false,
        },
      ],
    });

    return files.map(this.toDomain.bind(this));
  }

  async findAllByUserIdExceptFolderIds(
    userId: FileAttributes['userId'],
    exceptFolderIds: FileAttributes['folderId'][],
    { deleted, page, perPage }: FileOptions,
  ): Promise<Array<File> | []> {
    const { offset, limit } = Pagination.calculatePagination(page, perPage);
    const query: FindOptions = {
      where: { userId, deleted, folderId: { [Op.notIn]: exceptFolderIds } },
      order: [['id', 'ASC']],
    };
    if (page && perPage) {
      query.offset = offset;
      query.limit = limit;
    }
    const files = await this.fileModel.findAll(query);
    return files.map((file) => {
      return this.toDomain(file);
    });
  }

  async findOneBy(where: Partial<FileAttributes>): Promise<File | null> {
    const file = await this.fileModel.findOne({
      where,
    });
    return file ? this.toDomain(file) : null;
  }

  async findFilesInFolderByName(
    folderId: Folder['uuid'],
    searchFilter: { plainName: File['plainName']; type?: File['type'] }[],
  ): Promise<File[]> {
    const where: WhereOptions<File> = {
      folderUuid: folderId,
      status: FileStatus.EXISTS,
    };

    if (searchFilter.length) {
      where[Op.or] = searchFilter.map((criteria) => ({
        plainName: criteria.plainName,
        ...(criteria.type ? { type: criteria.type } : {}),
      }));
    }

    const files = await this.fileModel.findAll({
      where,
    });

    return files.map(this.toDomain.bind(this));
  }

  async updateByUuidAndUserId(
    uuid: FileAttributes['uuid'],
    userId: FileAttributes['userId'],
    update: Partial<File>,
  ): Promise<void> {
    await this.fileModel.update(update, {
      where: {
        userId,
        uuid,
      },
    });
  }

  async getFilesWhoseFolderIdDoesNotExist(
    userId: File['userId'],
  ): Promise<number> {
    const { count } = await this.fileModel.findAndCountAll({
      where: {
        folderId: {
          [Op.not]: null,
          [Op.notIn]: this.fileModel.findAll({
            where: { userId },
          }),
        },
        userId,
      },
    });

    return count;
  }

  async getFilesCountWhere(where: Partial<File>): Promise<number> {
    const { count } = await this.fileModel.findAndCountAll({ where });

    return count;
  }

  async getZeroSizeFilesCountByUser(userId: User['id']): Promise<number> {
    const { count } = await this.fileModel.findAndCountAll({
      where: {
        userId,
        size: 0,
        status: {
          [Op.not]: FileStatus.DELETED,
        },
      },
    });

    return count;
  }

  async updateFilesStatusToTrashed(
    user: User,
    fileIds: File['fileId'][],
  ): Promise<void> {
    await this.fileModel.update(
      {
        // Remove this after status is the main field
        deleted: true,
        deletedAt: new Date(),
        //
        status: FileStatus.TRASHED,
        updatedAt: new Date(),
      },
      {
        where: {
          userId: user.id,
          fileId: {
            [Op.in]: fileIds,
          },
          status: {
            [Op.eq]: FileStatus.EXISTS,
          },
        },
      },
    );
  }

  async updateFilesStatusToTrashedByUuid(
    user: User,
    fileUuids: File['uuid'][],
  ): Promise<void> {
    await this.fileModel.update(
      {
        deleted: true,
        deletedAt: new Date(),
        status: FileStatus.TRASHED,
        updatedAt: new Date(),
      },
      {
        where: {
          userId: user.id,
          uuid: {
            [Op.in]: fileUuids,
          },
          status: {
            [Op.eq]: FileStatus.EXISTS,
          },
        },
      },
    );
  }

  async deleteFilesByUser(user: User, files: File[]): Promise<void> {
    await this.fileModel.update(
      {
        removed: true,
        removedAt: new Date(),
        status: FileStatus.DELETED,
        updatedAt: new Date(),
      },
      {
        where: {
          userId: user.id,
          uuid: {
            [Op.in]: files.map(({ uuid }) => uuid),
          },
        },
      },
    );
  }

  async deleteUserTrashedFilesBatch(
    userId: number,
    limit: number,
  ): Promise<number> {
    const result = await this.fileModel.sequelize.query(
      `
      UPDATE files 
      SET status = :deletedStatus, updated_at = NOW()
      WHERE uuid IN (
        SELECT uuid 
        FROM files 
        WHERE user_id = :userId 
          AND status = :trashedStatus 
        LIMIT :limit
      )
    `,
      {
        replacements: {
          userId: userId,
          limit,
          deletedStatus: FileStatus.DELETED,
          trashedStatus: FileStatus.TRASHED,
        },
        type: QueryTypes.UPDATE,
      },
    );
    return result[1];
  }

  async markFilesInFolderAsRemoved(
    parentUuids: string[],
  ): Promise<{ updatedCount: number }> {
    const deletedDate = new Date();
    const [updatedCount] = await this.fileModel.update(
      {
        removed: true,
        removedAt: deletedDate,
        status: FileStatus.DELETED,
        updatedAt: deletedDate,
        fileId: Sequelize.literal(
          'CASE WHEN size = 0 THEN NULL ELSE file_id END',
        ),
      },
      {
        where: {
          folderUuid: { [Op.in]: parentUuids },
          status: { [Op.not]: FileStatus.DELETED },
        },
      },
    );

    return { updatedCount };
  }

  async destroyFile(where: Partial<FileModel>): Promise<void> {
    await this.fileModel.destroy({ where });
  }

  private toDomain(model: FileModel): File {
    const buildUser = (userData: UserModel | null) =>
      userData ? User.build(userData) : null;

    const file = File.build({
      ...model.toJSON(),
      folder: model.folder ? Folder.build(model.folder) : null,
      user: buildUser(model.user || model.workspaceUser?.creator),
    });
    return file;
  }

  async sumFileSizeDeltaBetweenDates(
    userId: FileAttributes['userId'],
    userUuid: User['uuid'],
    sinceDate: Date,
    untilDate: Date,
  ): Promise<number> {
    const query = `
      SELECT COALESCE(SUM(delta), 0) as total FROM (
        -- Files
        SELECT
          CASE
            WHEN status != 'DELETED' THEN size
            WHEN status = 'DELETED' AND created_at < :sinceDate THEN -size
            WHEN status = 'DELETED' AND updated_at > :untilDate THEN size
            ELSE 0
          END as delta
        FROM files
        WHERE user_id = :userId
          AND (
            (created_at >= :sinceDate AND created_at <= :untilDate)
            OR (status = 'DELETED' AND created_at < :sinceDate AND updated_at >= :sinceDate AND updated_at <= :untilDate)
          )

        UNION ALL

        -- File Versions
        SELECT
          CASE
            WHEN status != 'DELETED' THEN size
            WHEN status = 'DELETED' AND created_at < :sinceDate THEN -size
            WHEN status = 'DELETED' AND updated_at > :untilDate THEN size
            ELSE 0
          END as delta
        FROM file_versions
        WHERE user_id = :userUuid
          AND (
            (created_at >= :sinceDate AND created_at <= :untilDate)
            OR (status = 'DELETED' AND created_at < :sinceDate AND updated_at >= :sinceDate AND updated_at <= :untilDate)
          )
      ) combined;
    `;

    const result = (await this.fileModel.sequelize.query(query, {
      replacements: {
        userId,
        userUuid,
        sinceDate: sinceDate.toISOString(),
        untilDate: untilDate.toISOString(),
      },
      type: QueryTypes.SELECT,
    })) as [{ total: string }];

    return Number(result[0]?.total) || 0;
  }

  async sumFileSizeDeltaFromDate(
    userId: FileAttributes['userId'],
    userUuid: User['uuid'],
    sinceDate: Date,
  ): Promise<number> {
    const query = `
      SELECT COALESCE(SUM(delta), 0) as total FROM (
        -- Files
        SELECT
          CASE
            WHEN status != 'DELETED' THEN size
            WHEN status = 'DELETED' AND created_at < :sinceDate THEN -size
            ELSE 0
          END as delta
        FROM files
        WHERE user_id = :userId
          AND (
            (status != 'DELETED' AND created_at >= :sinceDate)
            OR (status = 'DELETED' AND updated_at >= :sinceDate)
          )

        UNION ALL

        -- File Versions
        SELECT
          CASE
            WHEN status != 'DELETED' THEN size
            WHEN status = 'DELETED' AND created_at < :sinceDate THEN -size
            ELSE 0
          END as delta
        FROM file_versions
        WHERE user_id = :userUuid
          AND (
            (status != 'DELETED' AND created_at >= :sinceDate)
            OR (status = 'DELETED' AND updated_at >= :sinceDate)
          )
      ) combined;
    `;

    const result = (await this.fileModel.sequelize.query(query, {
      replacements: {
        userId,
        userUuid,
        sinceDate: sinceDate.toISOString(),
      },
      type: QueryTypes.SELECT,
    })) as [{ total: string }];

    return Number(result[0]?.total) || 0;
  }
}
