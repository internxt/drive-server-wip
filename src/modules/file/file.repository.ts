import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { File, FileAttributes, FileOptions, FileStatus } from './file.domain';
import { FindOptions, Op } from 'sequelize';

import { User } from '../user/user.domain';
import { Folder, FolderAttributes } from '../folder/folder.domain';
import { Pagination } from '../../lib/pagination';
import { ShareModel } from '../share/share.repository';
import { ThumbnailModel } from '../thumbnail/thumbnail.model';
import { FileModel } from './file.model';

export interface FileRepository {
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
  findByUuid(
    fileUuid: FileAttributes['uuid'],
    userId: FileAttributes['userId'],
    where: FindOptions<FileAttributes>,
  ): Promise<File | null>;
  updateByFieldIdAndUserId(
    fileId: FileAttributes['fileId'],
    userId: FileAttributes['userId'],
    update: Partial<File>,
  ): Promise<File>;
  updateManyByFieldIdAndUserId(
    fileIds: FileAttributes['fileId'][],
    userId: FileAttributes['userId'],
    update: Partial<File>,
  ): Promise<void>;
  getFilesWhoseFolderIdDoesNotExist(userId: File['userId']): Promise<number>;
  getFilesCountWhere(where: Partial<File>): Promise<number>;
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

  async findByUuid(
    fileUuid: string,
    userId: number,
    where: FindOptions<FileAttributes> = {},
  ): Promise<File> {
    const file = await this.fileModel.findOne({
      where: {
        uuid: fileUuid,
        userId,
        ...where,
      },
    });

    return this.toDomain(file);
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

  async findAllCursor(
    where: Partial<Record<keyof FileAttributes, any>>,
    limit: number,
    offset: number,
    order: Array<[keyof FileModel, string]> = [],
  ): Promise<Array<File> | []> {
    const files = await this.fileModel.findAll({
      limit,
      offset,
      where,
      order,
    });

    return files.map(this.toDomain.bind(this));
  }

  async findAllCursorWithThumbnails(
    where: Partial<Record<keyof FileAttributes, any>>,
    limit: number,
    offset: number,
    order: Array<[keyof FileModel, string]> = [],
  ): Promise<Array<File> | []> {
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
          model: this.thumbnailModel,
          required: false,
        },
      ],
      order,
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
