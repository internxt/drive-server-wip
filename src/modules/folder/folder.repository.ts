import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Folder, FolderAttributes } from './folder.domain';
import { Op } from 'sequelize';
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
} from 'sequelize-typescript';
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
  parent: Folder;

  @Index
  @Column
  name: string;

  @Column(DataType.STRING(24))
  bucket: string;

  // TODO: References user
  @Column
  userId: number;

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
  _toDomain(model: FolderModel): Folder;
  _toModel(domain: Folder): Partial<FolderAttributes>;
}

@Injectable()
export class SequelizeFolderRepository implements FolderRepository {
  constructor(
    @InjectModel(FolderModel)
    private folderModel: typeof FolderModel,
  ) {}

  async findAll(): Promise<Array<Folder> | []> {
    const folders = await this.folderModel.findAll();
    return folders.map((folder) => this._toDomain(folder));
  }
  async findAllByParentIdAndUserId(
    parentId: FolderAttributes['parentId'],
    userId: FolderAttributes['userId'],
    deleted: FolderAttributes['deleted'],
  ): Promise<Array<Folder> | []> {
    const folders = await this.folderModel.findAll({
      where: { parentId, userId, deleted: deleted ? 1 : 0 },
    });
    return folders.map((folder) => this._toDomain(folder));
  }
  async findById(folderId: FolderAttributes['id']): Promise<Folder> {
    const folder = await this.folderModel.findOne({
      where: {
        id: folderId,
      },
    });
    return this._toDomain(folder);
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
    return this._toDomain(folder);
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

  _toDomain(model: FolderModel): Folder {
    return Folder.build({
      ...model.toJSON(),
      parent: model.parent ? Folder.build(model.parent) : null,
    });
  }

  _toModel(domain: Folder): Partial<FolderAttributes> {
    return domain.toJSON();
  }
}
