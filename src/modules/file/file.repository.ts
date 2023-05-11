import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { File, FileAttributes, FileOptions, FileStatus } from './file.domain';
import { FindOptions, Op } from 'sequelize';
import {
  AllowNull,
  BelongsTo,
  Column,
  DataType,
  Default,
  ForeignKey,
  Index,
  Model,
  PrimaryKey,
  Table,
  Unique,
} from 'sequelize-typescript';
import { UserModel } from '../user/user.model';
import { User } from '../user/user.domain';
import { Folder } from '../folder/folder.domain';
import { Pagination } from '../../lib/pagination';
import { FolderModel } from '../folder/folder.model';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'files',
})
export class FileModel extends Model implements FileAttributes {
  @PrimaryKey
  @Column
  id: number;

  @Unique
  @Column(DataType.UUIDV4)
  uuid: string;

  @Column(DataType.STRING(24))
  fileId: string;

  @Index
  @Column
  name: string;

  @Index
  @Column
  plainName: string;

  @Column
  type: string;

  @Column(DataType.BIGINT.UNSIGNED)
  size: bigint;

  @Column(DataType.STRING(24))
  bucket: string;

  @ForeignKey(() => FolderModel)
  @Column(DataType.INTEGER)
  folderId: number;

  @BelongsTo(() => FolderModel)
  folder: FolderModel;

  @ForeignKey(() => FolderModel)
  @Column(DataType.UUIDV4)
  folderUuid: string;

  @Column
  encryptVersion: string;

  @ForeignKey(() => UserModel)
  @Column
  userId: number;

  @BelongsTo(() => UserModel)
  user: UserModel;

  @Column
  modificationTime: Date;

  @Column
  createdAt: Date;

  @Column
  updatedAt: Date;

  @Default(false)
  @Column
  removed: boolean;

  @AllowNull
  @Column
  removedAt: Date;

  @Default(false)
  @Column
  deleted: boolean;

  @AllowNull
  @Column
  deletedAt: Date;

  @Column({
    type: DataType.ENUM,
    values: Object.values(FileStatus),
    defaultValue: FileStatus.EXISTS,
    allowNull: false,
  })
  status: FileStatus;
}

export interface FileRepository {
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
  ) {}

  async findAll(): Promise<Array<File> | []> {
    const files = await this.fileModel.findAll();
    return files.map((file) => {
      return this.toDomain(file);
    });
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

  async findAllCursor(
    where: Partial<Record<keyof FileAttributes, any>>,
    limit: number,
    offset: number,
    additionalOrders: Array<[keyof FileModel, string]> = [],
  ): Promise<Array<File> | []> {
    const files = await this.fileModel.findAll({
      limit,
      offset,
      where,
      order: [['id', 'ASC'], ...additionalOrders],
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
