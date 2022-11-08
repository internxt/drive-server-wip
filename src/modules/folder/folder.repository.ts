import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Folder, FolderAttributes } from './folder.domain';
import { FindOptions, Op } from 'sequelize';
import {
  AllowNull,
  AutoIncrement,
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
import { User, UserAttributes } from '../user/user.domain';
import { Pagination } from '../../lib/pagination';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'folders',
})
export class FolderModel extends Model implements FolderAttributes {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => FolderModel)
  @Column
  parentId: number;

  @BelongsTo(() => FolderModel)
  parent: FolderModel;

  @Index
  @Column
  name: string;

  @Column(DataType.STRING(24))
  bucket: string;

  @ForeignKey(() => UserModel)
  @Column
  userId: number;

  @BelongsTo(() => UserModel)
  user: UserModel;

  @Column
  encryptVersion: '03-aes';

  @Default(false)
  @Column
  deleted: boolean;

  @AllowNull
  @Column
  deletedAt: Date;

  @Column
  createdAt: Date;

  @Column
  updatedAt: Date;
}

export interface FolderRepository {
  findAll(): Promise<Array<Folder> | []>;
  findAllByParentIdAndUserId(
    parentId: FolderAttributes['parentId'],
    userId: FolderAttributes['userId'],
    deleted: FolderAttributes['deleted'],
  ): Promise<Array<Folder> | []>;
  findById(
    folderId: FolderAttributes['id'],
    deleted: FolderAttributes['deleted'],
  ): Promise<Folder | null>;
  updateByFolderId(
    folderId: FolderAttributes['id'],
    update: Partial<Folder>,
  ): Promise<Folder>;
  updateManyByFolderId(
    folderIds: FolderAttributes['id'][],
    update: Partial<Folder>,
  ): Promise<void>;
  deleteById(folderId: FolderAttributes['id']): Promise<void>;
  clearOrphansFolders(userId: FolderAttributes['userId']): Promise<number>;
}

@Injectable()
export class SequelizeFolderRepository implements FolderRepository {
  constructor(
    @InjectModel(FolderModel)
    private folderModel: typeof FolderModel,
    @InjectModel(UserModel)
    private userModel: typeof UserModel,
  ) {}

  async findAll(where = {}): Promise<Array<Folder> | []> {
    const folders = await this.folderModel.findAll({ where });
    return folders.map((folder) => this.toDomain(folder));
  }

  async findOne(where: Partial<FolderAttributes>): Promise<Folder | null> {
    const folder = await this.folderModel.findOne({ where });

    return folder ? this.toDomain(folder) : null;
  }

  async findAllByParentIdAndUserId(
    parentId: FolderAttributes['parentId'],
    userId: FolderAttributes['userId'],
    deleted: FolderAttributes['deleted'],
  ): Promise<Array<Folder> | []> {
    const folders = await this.folderModel.findAll({
      where: { parentId, userId, deleted },
    });
    return folders.map((folder) => this.toDomain(folder));
  }

  async findAllByParentId(
    parentId: FolderAttributes['parentId'],
    deleted: FolderAttributes['deleted'],
    page: number = null,
    perPage: number = null,
  ): Promise<Array<Folder> | []> {
    const query: FindOptions = {
      where: { parentId, deleted },
      order: [['id', 'ASC']],
    };
    const { offset, limit } = Pagination.calculatePagination(page, perPage);
    if (page && perPage) {
      query.offset = offset;
      query.limit = limit;
    }
    const folders = await this.folderModel.findAll(query);
    return folders.map((folder) => this.toDomain(folder));
  }

  async findById(
    folderId: FolderAttributes['id'],
    deleted: FolderAttributes['deleted'] = false,
  ): Promise<Folder | null> {
    const folder = await this.folderModel.findOne({
      where: {
        id: folderId,
        deleted,
      },
    });
    return folder ? this.toDomain(folder) : null;
  }

  async updateByFolderId(
    folderId: FolderAttributes['id'],
    update: Partial<Folder>,
  ): Promise<Folder> {
    const folder = await this.folderModel.findOne({
      where: {
        id: folderId,
      },
    });

    if (!folder) {
      throw new NotFoundException(`Folder with ID ${folderId} not found`);
    }
    folder.set(update);
    await folder.save();
    return this.toDomain(folder);
  }

  async updateManyByFolderId(
    folderIds: FolderAttributes['id'][],
    update: Partial<Folder>,
  ): Promise<void> {
    await this.folderModel.update(update, {
      where: {
        id: {
          [Op.in]: folderIds,
        },
      },
    });
  }

  async create(
    userId: UserAttributes['id'],
    name: FolderAttributes['name'],
    bucket: FolderAttributes['bucket'],
    parentId: FolderAttributes['id'],
    encryptVersion: FolderAttributes['encryptVersion'],
  ): Promise<Folder> {
    const folder = await this.folderModel.create({
      userId,
      name,
      bucket,
      parentId,
      encryptVersion,
    });

    return this.toDomain(folder);
  }

  async deleteById(folderId: number): Promise<void> {
    await this.folderModel.destroy({
      where: {
        id: { [Op.eq]: folderId },
      },
    });
  }

  async clearOrphansFolders(
    userId: FolderAttributes['userId'],
  ): Promise<number> {
    const clear = await this.folderModel.sequelize.query(
      'CALL clear_orphan_folders_by_user (:userId, :output)',
      {
        replacements: { userId, output: null },
      },
    );

    return (clear[0] as any).total_left;
  }

  private toDomain(model: FolderModel): Folder {
    return Folder.build({
      ...model.toJSON(),
      parent: model.parent ? Folder.build(model.parent) : null,
      user: model.user ? User.build(model.user) : null,
    });
  }

  private toModel(domain: Folder): Partial<FolderAttributes> {
    return domain.toJSON();
  }
}
