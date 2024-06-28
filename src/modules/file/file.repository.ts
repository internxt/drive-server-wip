import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { File, FileAttributes, FileOptions, FileStatus } from './file.domain';
import { FindOptions, Op, Sequelize } from 'sequelize';
import { Literal } from 'sequelize/types/utils';

import { User } from '../user/user.domain';
import { Folder } from '../folder/folder.domain';
import { Pagination } from '../../lib/pagination';
import { ShareModel } from '../share/share.repository';
import { ThumbnailModel } from '../thumbnail/thumbnail.model';
import { FileModel } from './file.model';
import { SharingModel } from '../sharing/models';
import { WorkspaceItemUserAttributes } from '../workspaces/attributes/workspace-items-users.attributes';
import { WorkspaceItemUserModel } from '../workspaces/models/workspace-items-users.model';
import { WorkspaceAttributes } from '../workspaces/attributes/workspace.attributes';

export interface FileRepository {
  create(file: Omit<FileAttributes, 'id'>): Promise<File | null>;
  deleteByFileId(fileId: any): Promise<any>;
  findByIdNotDeleted(
    id: FileAttributes['id'],
    where: Partial<FileAttributes>,
  ): Promise<File | null>;
  findAll(): Promise<Array<File> | []>;
  findAllByFolderIdAndUserId(
    folderId: FileAttributes['folderId'],
    userId: FileAttributes['userId'],
    options: FileOptions,
  ): Promise<Array<File> | []>;
  findOne(
    fileId: FileAttributes['id'],
    userId: FileAttributes['userId'],
    options: FileOptions,
  ): Promise<File | null>;
  findOneBy(where: Partial<FileAttributes>): Promise<File | null>;
  findByUuid(
    fileUuid: FileAttributes['uuid'],
    userId: FileAttributes['userId'],
    where: FindOptions<FileAttributes>,
  ): Promise<File | null>;
  findFileByName(
    where: Partial<Omit<FileAttributes, 'name' | 'plainName'>>,
    nameFilter: Pick<FileAttributes, 'name' | 'plainName'>,
  ): Promise<File | null>;
  findByNameAndFolderUuid(
    name: FileAttributes['name'],
    type: FileAttributes['type'],
    folderUuid: FileAttributes['folderUuid'],
    status: FileAttributes['status'],
  ): Promise<File | null>;
  getSumSizeOfFilesByStatuses(
    createdBy: WorkspaceItemUserAttributes['createdBy'],
    workspaceId: WorkspaceAttributes['id'],
    statuses: FileStatus[],
    options?: {
      createdFrom?: Date;
      removedFrom?: Date;
      limit: number;
      offset: number;
      order?: Array<[keyof File, string]>;
    },
  ): Promise<{ size: string }[]>;
  updateByFieldIdAndUserId(
    fileId: FileAttributes['fileId'],
    userId: FileAttributes['userId'],
    update: Partial<File>,
  ): Promise<File>;
  updateByUuidAndUserId(
    uuid: FileAttributes['uuid'],
    userId: FileAttributes['userId'],
    update: Partial<File>,
  ): Promise<void>;
  updateManyByFieldIdAndUserId(
    fileIds: FileAttributes['fileId'][],
    userId: FileAttributes['userId'],
    update: Partial<File>,
  ): Promise<void>;
  getFilesWhoseFolderIdDoesNotExist(userId: File['userId']): Promise<number>;
  getFilesCountWhere(where: Partial<File>): Promise<number>;
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
}

@Injectable()
export class SequelizeFileRepository implements FileRepository {
  constructor(
    @InjectModel(FileModel)
    private fileModel: typeof FileModel,
    @InjectModel(ShareModel)
    private shareModel: typeof ShareModel,
    @InjectModel(ThumbnailModel)
    private thumbnailModel: typeof ThumbnailModel,
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

  async findByUuids(uuids: File['uuid'][]): Promise<Array<File> | []> {
    const files = await this.fileModel.findAll({
      where: {
        uuid: {
          [Op.in]: uuids,
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

  async findByNameAndFolderUuid(
    name: FileAttributes['name'],
    type: FileAttributes['type'],
    folderUuid: FileAttributes['folderUuid'],
    status: FileAttributes['status'],
  ): Promise<File | null> {
    const file = await this.fileModel.findOne({
      where: {
        name: { [Op.eq]: name },
        type: { [Op.eq]: type },
        folderUuid: { [Op.eq]: folderUuid },
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
  ): Promise<Array<File> | []> {
    const files = await this.findAllCursor(
      {
        ...where,
        updatedAt: { [Op.gt]: updatedAtAfter },
      },
      limit,
      offset,
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
      include: {
        model: WorkspaceItemUserModel,
        where: { createdBy, workspaceId },
      },
      subQuery: false,
      order: appliedOrder,
    });

    return files.map(this.toDomain.bind(this));
  }

  async getSumSizeOfFilesByStatuses(
    createdBy: WorkspaceItemUserAttributes['createdBy'],
    workspaceId: WorkspaceAttributes['id'],
    statuses: FileStatus[],
    options?: {
      createdFrom?: Date;
      removedFrom?: Date;
      limit: number;
      offset: number;
      order?: Array<[keyof File, string]>;
    },
  ): Promise<{ size: string }[]> {
    const statusesFilter = statuses.map((value) => ({ status: value }));

    const fileDateFilters: any = {};
    if (options?.removedFrom) {
      fileDateFilters.removed_at = {
        [Op.gte]: options?.removedFrom,
      };
    }

    const workspaceItemDateFilters: any = {};
    if (options?.createdFrom) {
      workspaceItemDateFilters.created_at = {
        [Op.gte]: options.createdFrom,
      };
    }

    const sizes = await this.fileModel.findAll({
      attributes: ['size'],
      limit: options?.limit,
      offset: options?.offset,
      where: {
        [Op.or]: statusesFilter,
        ...fileDateFilters,
      },
      include: {
        model: WorkspaceItemUserModel,
        attributes: [],
        where: { createdBy, workspaceId, ...workspaceItemDateFilters },
      },
      order: options?.order,
    });

    return sizes as unknown as { size: string }[];
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
          model: this.shareModel,
          attributes: [
            'id',
            'active',
            'hashed_password',
            'code',
            'token',
            'is_folder',
          ],
          required: false,
        },
        {
          separate: true,
          model: this.thumbnailModel,
          required: false,
        },
        {
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
          model: SharingModel,
          attributes: ['type', 'id'],
          required: false,
        },
        {
          model: WorkspaceItemUserModel,
          where: {
            createdBy,
            workspaceId,
          },
        },
      ],
      subQuery: false,
      order: appliedOrder,
    });

    return files.map(this.toDomain.bind(this));
  }

  async findByIdNotDeleted(id: number): Promise<File> {
    const file = await this.fileModel.findOne({
      where: { id, deleted: false },
    });

    return file ? this.toDomain(file) : null;
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

  async findOne(
    fileId: FileAttributes['id'],
    userId: FileAttributes['userId'],
    { deleted }: FileOptions,
  ): Promise<File | null> {
    const file = await this.fileModel.findOne({
      where: {
        id: fileId,
        userId,
        deleted,
      },
    });
    return file ? this.toDomain(file) : null;
  }

  async findOneBy(where: Partial<FileAttributes>): Promise<File | null> {
    const file = await this.fileModel.findOne({
      where,
    });
    return file ? this.toDomain(file) : null;
  }

  async findFileByName(
    where: Partial<Omit<FileAttributes, 'name' | 'plainName'>>,
    nameFilter: Pick<FileAttributes, 'name' | 'plainName'>,
  ): Promise<File | null> {
    const file = await this.fileModel.findOne({
      where: {
        ...where,
        [Op.or]: [
          { name: nameFilter.name },
          { plainName: nameFilter.plainName },
        ],
      },
    });
    return file ? this.toDomain(file) : null;
  }

  async updateByFieldIdAndUserId(
    fileId: FileAttributes['fileId'],
    userId: FileAttributes['userId'],
    update: Partial<File>,
  ): Promise<File> {
    const file = await this.fileModel.findOne({
      where: {
        fileId,
        userId,
      },
    });

    if (!file) {
      throw new NotFoundException(`File with ID ${fileId} not found`);
    }
    file.set(update);
    await file.save();
    return this.toDomain(file);
  }

  async updateManyByFieldIdAndUserId(
    fileIds: FileAttributes['fileId'][],
    userId: FileAttributes['userId'],
    update: Partial<File>,
  ): Promise<void> {
    await this.fileModel.update(update, {
      where: {
        userId,
        fileId: {
          [Op.in]: fileIds,
        },
      },
    });
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
          id: {
            [Op.in]: files.map(({ id }) => id),
          },
        },
      },
    );
  }

  private toDomain(model: FileModel): File {
    const file = File.build({
      ...model.toJSON(),
      folder: model.folder ? Folder.build(model.folder) : null,
      user: model.user ? User.build(model.user) : null,
    });
    return file;
  }

  private toModel(domain: File): Partial<FileAttributes> {
    return domain.toJSON();
  }
}
