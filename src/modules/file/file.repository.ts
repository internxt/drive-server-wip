import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { File, FileAttributes } from './file.domain';
import { FindOptions, Op } from 'sequelize';
import { FolderModel } from '../folder/folder.repository';

import {
  Column,
  Model,
  Table,
  PrimaryKey,
  DataType,
  Index,
  BelongsTo,
  ForeignKey,
  HasMany,
} from 'sequelize-typescript';
import { UserModel } from '../user/user.repository';
import { User } from '../user/user.domain';
import { Folder, FolderAttributes } from '../folder/folder.domain';
import { Pagination } from '../../lib/pagination';
import sequelize from 'sequelize';
import { SendLinkItemModel } from '../send/models/send-link-item.model';
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

  @Column
  deleted: boolean;

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

  @HasMany(() => SendLinkItemModel, {
    foreignKey: 'send_link_item_id_fk',
    constraints: false,
    scope: { itemType: 'file' },
  })
  sendLinkItems: SendLinkItemModel[];
}

export interface FileRepository {
  findAll(): Promise<Array<File> | []>;
  findAllByFolderIdAndUserId(
    folderId: FileAttributes['folderId'],
    userId: FileAttributes['userId'],
    deleted: FileAttributes['deleted'],
    page: number,
    perPage: number,
  ): Promise<Array<File> | []>;
  findOne(
    fileId: FileAttributes['fileId'],
    userId: FileAttributes['userId'],
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
}

export const toDomain = (model: FileModel): File => {
  const file = File.build({
    ...model.toJSON(),
    folder: model.folder ? Folder.build(model.folder) : null,
    user: model.user ? User.build(model.user) : null,
  });
  return file;
};

export const toModel = (domain: File): Partial<FileAttributes> => {
  return domain.toJSON();
};
@Injectable()
export class SequelizeFileRepository implements FileRepository {
  constructor(
    @InjectModel(FileModel)
    private fileModel: typeof FileModel,
  ) {}

  async findAll(): Promise<Array<File> | []> {
    const files = await this.fileModel.findAll();
    return files.map((file) => {
      return toDomain(file);
    });
  }
  async findAllByFolderIdAndUserId(
    folderId: FileAttributes['folderId'],
    userId: FileAttributes['userId'],
    deleted: FileAttributes['deleted'],
    page: number,
    perPage: number,
  ): Promise<Array<File> | []> {
    const { offset, limit } = Pagination.calculatePagination(page, perPage);
    const query: FindOptions = {
      where: { folderId, userId, deleted: deleted ? 1 : 0 },
      order: [['id', 'ASC']],
    };
    if (page && perPage) {
      query.offset = offset;
      query.limit = limit;
    }
    const files = await this.fileModel.findAll(query);
    return files.map((file) => {
      return toDomain(file);
    });
  }

  async findOne(
    fileId: FileAttributes['fileId'],
    userId: FileAttributes['userId'],
  ): Promise<File | null> {
    const file = await this.fileModel.findOne({
      where: {
        fileId,
        userId,
      },
    });
    return file ? toDomain(file) : null;
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
    return toDomain(file);
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
}
