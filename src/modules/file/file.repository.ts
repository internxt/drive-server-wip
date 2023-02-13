import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { File, FileAttributes, FileOptions } from './file.domain';
import sequelize, { FindOptions, Op } from 'sequelize';
import { FolderModel } from '../folder/folder.model';

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
} from 'sequelize-typescript';
import { UserModel } from '../user/user.repository';
import { User } from '../user/user.domain';
import { Folder, FolderAttributes } from '../folder/folder.domain';
import { Pagination } from '../../lib/pagination';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'files',
})
export class FileModel extends Model implements FileAttributes {
  @PrimaryKey
  @Column
  id: number;

  @Column(DataType.STRING(24))
  fileId: string;

  @Index
  @Column
  name: string;

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

  @Column
  encryptVersion: string;

  @Default(false)
  @Column
  deleted: boolean;

  @AllowNull
  @Column
  deletedAt: Date;

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
  deleteByFileId(fileId: FileAttributes['fileId']): Promise<void>;
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

  async findByIdNotDeleted(id: number): Promise<File> {
    const file = await this.fileModel.findOne({
      where: { id, deleted: false },
    });

    return file ? this.toDomain(file) : null;
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

  async getTotalSizeByFolderId(folderId: FolderAttributes['id']) {
    const result = (await this.fileModel.findAll({
      attributes: [[sequelize.fn('sum', sequelize.col('size')), 'total']],
      where: {
        folderId,
      },
    })) as unknown as Promise<{ total: number }[]>;

    return result[0].total;
  }

  async deleteByFileId(fileId: FileAttributes['fileId']): Promise<void> {
    await this.fileModel.destroy({
      where: {
        fileId,
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
