import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Folder, FolderAttributes } from './folder.domain';
import { FindOptions, Op } from 'sequelize';
import {
  Column,
  Model,
  Table,
  PrimaryKey,
  DataType,
  Default,
  AutoIncrement,
  AllowNull,
  BelongsTo,
  ForeignKey,
  Index,
  HasMany,
} from 'sequelize-typescript';
import { UserModel } from '../user/user.repository';
import { User } from '../user/user.domain';
import { Pagination } from '../../lib/pagination';
import { SendLinkItemModel } from '../send/models/send-link-item.model';
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
  encryptVersion: string;

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

  @HasMany(() => SendLinkItemModel, {
    foreignKey: 'send_link_item_id_fk',
    constraints: false,
    scope: { itemType: 'folder' },
  })
  sendLinkItems: SendLinkItemModel[];
}

export interface FolderRepository {
  findAll(): Promise<Array<Folder> | []>;
  findAllByParentIdAndUserId(
    parentId: FolderAttributes['parentId'],
    userId: FolderAttributes['userId'],
    deleted: FolderAttributes['deleted'],
  ): Promise<Array<Folder> | []>;
  findById(folderId: FolderAttributes['id']): Promise<Folder | null>;
  updateByFolderId(
    folderId: FolderAttributes['id'],
    update: Partial<Folder>,
  ): Promise<Folder>;
  updateManyByFolderId(
    folderIds: FolderAttributes['id'][],
    update: Partial<Folder>,
  ): Promise<void>;
}
export const toDomain = (model: FolderModel): Folder => {
  return Folder.build({
    ...model.toJSON(),
    parent: model.parent ? Folder.build(model.parent) : null,
    user: model.user ? User.build(model.user) : null,
  });
};

export const toModel = (domain: Folder): Partial<FolderAttributes> => {
  return domain.toJSON();
};
@Injectable()
export class SequelizeFolderRepository implements FolderRepository {
  constructor(
    @InjectModel(FolderModel)
    private folderModel: typeof FolderModel,
  ) {}

  async findAll(): Promise<Array<Folder> | []> {
    const folders = await this.folderModel.findAll();
    return folders.map((folder) => toDomain(folder));
  }
  async findAllByParentIdAndUserId(
    parentId: FolderAttributes['parentId'],
    userId: FolderAttributes['userId'],
    deleted: FolderAttributes['deleted'],
  ): Promise<Array<Folder> | []> {
    const folders = await this.folderModel.findAll({
      where: { parentId, userId, deleted: deleted ? 1 : 0 },
    });
    return folders.map((folder) => toDomain(folder));
  }

  async findAllByParentId(
    parentId: FolderAttributes['parentId'],
    deleted: FolderAttributes['deleted'],
    page: number = null,
    perPage: number = null,
  ): Promise<Array<Folder> | []> {
    const query: FindOptions = {
      where: { parentId, deleted: deleted ? 1 : 0 },
      order: [['id', 'ASC']],
    };
    const { offset, limit } = Pagination.calculatePagination(page, perPage);
    if (page && perPage) {
      query.offset = offset;
      query.limit = limit;
    }
    const folders = await this.folderModel.findAll(query);
    return folders.map((folder) => toDomain(folder));
  }
  async findById(folderId: FolderAttributes['id']): Promise<Folder | null> {
    const folder = await this.folderModel.findOne({
      where: {
        id: folderId,
      },
    });
    return folder ? toDomain(folder) : null;
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
    return toDomain(folder);
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
}
