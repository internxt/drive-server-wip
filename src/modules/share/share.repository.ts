import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Share, ShareAttributes } from './share.domain';
import { File, FileAttributes } from '../file/file.domain';
import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  DataType,
  Default,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
  Unique,
} from 'sequelize-typescript';
import { FileModel } from '../file/file.repository';
import { User } from '../user/user.domain';
import { UserAttributes } from '../user/user.attributes';
import { UserModel } from '../user/user.model';
import { FolderModel } from '../folder/folder.model';
import { Folder } from '../folder/folder.domain';
import { FolderAttributes } from '../folder/folder.attributes';
import { Pagination } from '../../lib/pagination';
import { Op } from 'sequelize';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'shares',
})
export class ShareModel extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Unique
  @Column
  token: string;

  @Column(DataType.BLOB)
  mnemonic: string;

  @ForeignKey(() => UserModel)
  @Column
  userId: number;

  @BelongsTo(() => UserModel)
  user: UserModel;

  @ForeignKey(() => FileModel)
  @Column
  fileId: number;

  @ForeignKey(() => FileModel)
  @Column
  fileUuid: string;

  @BelongsTo(() => FileModel, 'fileId')
  file: FileModel;

  @ForeignKey(() => FolderModel)
  @Column
  folderId: number;

  @BelongsTo(() => FolderModel, 'folderId')
  folder: FolderModel;

  @Column(DataType.STRING(64))
  encryptionKey: string;

  @Column(DataType.STRING(24))
  bucket: string;

  @Column(DataType.STRING(64))
  fileToken: string;

  @Default(false)
  @Column
  isFolder: boolean;

  @Default(1)
  @Column
  views: number;

  @AllowNull
  @Column
  timesValid: number;

  @Default(true)
  @Column
  active: boolean;

  @AllowNull
  @Column
  code: string;

  @AllowNull
  @Column(DataType.TEXT)
  hashedPassword: string;

  @AllowNull
  @ForeignKey(() => FolderModel)
  @Column(DataType.UUIDV4)
  folderUuid: string;
}

export interface ShareRepository {
  findById(id: number): Promise<Share | null>;
  findByToken(token: string): Promise<Share | null>;
  findAllByUsersPaginated(
    user: any,
    page: number,
    perPage: number,
  ): Promise<Share[]>;
  update(share: Share): Promise<void>;
  deleteById(shareId: Share['id']): Promise<void>;
  create(share: Share): Promise<Share>;
  findByFileIdAndUser(
    fileId: FileAttributes['id'],
    userId: UserAttributes['id'],
  ): Promise<Share | null>;
  findByFolderIdAndUser(
    folderId: FolderAttributes['id'],
    userId: UserAttributes['id'],
  ): Promise<Share | null>;
}

@Injectable()
export class SequelizeShareRepository implements ShareRepository {
  constructor(
    @InjectModel(ShareModel)
    private shareModel: typeof ShareModel,
    @InjectModel(FileModel)
    private fileModel: typeof FileModel,
    @InjectModel(FolderModel)
    private folderModel: typeof FolderModel,
    @InjectModel(UserModel)
    private userModel: typeof UserModel,
  ) {}

  async findById(id: ShareAttributes['id']) {
    const share = await this.shareModel.findByPk(id, {
      include: [
        this.userModel,
        {
          model: this.fileModel,
          where: {
            deleted: false,
          },
          required: false,
        },
        {
          model: this.folderModel,
          where: {
            deleted: false,
          },
          required: false,
        },
      ],
    });
    return share ? this.toDomain(share) : null;
  }

  async findByFileIdAndUser(
    fileId: FileAttributes['id'],
    userId: UserAttributes['id'],
  ): Promise<Share | null> {
    const share = await this.shareModel.findOne({
      where: { fileId, userId },
      include: [
        this.userModel,
        {
          model: this.fileModel,
          where: {
            deleted: false,
          },
        },
      ],
    });
    return share ? this.toDomain(share) : null;
  }

  async findByFolderIdAndUser(
    folderId: FolderAttributes['id'],
    userId: UserAttributes['id'],
  ): Promise<Share | null> {
    const share = await this.shareModel.findOne({
      where: { folderId, userId },
      include: [
        this.userModel,
        {
          model: this.folderModel,
          where: {
            deleted: false,
          },
        },
      ],
    });
    return share ? this.toDomain(share) : null;
  }

  async findByToken(token: string): Promise<Share | null> {
    const share = await this.shareModel.findOne({
      where: { token },
    });
    if (!share) {
      return null;
    }
    return this.toDomain(share);
  }

  async create(share: Share): Promise<Share> {
    const shareModel = this.toModel(share);
    delete shareModel.id;
    const { id } = await this.shareModel.create(shareModel);
    return this.findById(id);
  }

  async update(share: Share): Promise<void> {
    const shareModel = await this.shareModel.findByPk(share.id);
    if (!shareModel) {
      throw new NotFoundException(`Share with ID ${share.id} not found`);
    }
    shareModel.set(this.toModel(share));
    await shareModel.save();
  }

  async deleteById(shareId: Share['id']): Promise<void> {
    await this.shareModel.destroy({ where: { id: shareId } });
  }

  async findAllByUsersPaginated(
    users: User[],
    page: number,
    perPage: number,
    orderBy?: 'views:ASC' | 'views:DESC' | 'createdAt:ASC' | 'createdAt:DESC',
  ): Promise<Share[]> {
    const { offset, limit } = Pagination.calculatePagination(page, perPage);

    const order = orderBy
      ? [orderBy.split(':') as [string, string]]
      : undefined;

    const shares = await this.shareModel.findAll({
      where: {
        user_id: {
          [Op.or]: users.map((u) => u.id),
        },
      },
      include: [
        this.userModel,
        {
          model: this.fileModel,
          where: {
            deleted: false,
          },
          required: false,
        },
        {
          model: this.folderModel,
          where: {
            deleted: false,
          },
          required: false,
        },
      ],
      offset,
      limit,
      order,
    });
    return shares.map(this.toDomain.bind(this));
  }

  private toDomain(model: ShareModel): Share {
    let item: File | Folder = null;
    if (model.isFolder) {
      item = model.folder ? Folder.build(model.folder) : null;
    } else {
      item = model.file ? File.build(model.file) : null;
    }
    const share = Share.build({
      id: model.id,
      token: model.token,
      mnemonic: model.mnemonic.toString(),
      bucket: model.bucket,
      fileToken: model.fileToken,
      isFolder: model.isFolder,
      views: model.views,
      timesValid: model.timesValid,
      active: model.active,
      userId: model.userId ? model.userId : null,
      code: model.code,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
      fileId: model.fileId,
      fileUuid: model.fileUuid,
      fileSize: model.isFolder ? null : (item as File)?.size,
      folderId: model.folderId,
      folderUuid: model.folderUuid,
      hashedPassword: model.hashedPassword,
    });

    share.item = item;

    return share;
  }

  private toModel({
    id,
    token,
    mnemonic,
    fileId,
    fileUuid,
    fileSize,
    folderId,
    bucket,
    fileToken,
    isFolder,
    views,
    timesValid,
    active,
    code,
    createdAt,
    updatedAt,
    userId,
    hashedPassword,
  }) {
    return {
      id,
      token,
      mnemonic,
      userId,
      fileId,
      fileUuid,
      fileSize,
      folderId,
      encryptionKey: '',
      bucket,
      fileToken,
      isFolder,
      views,
      timesValid,
      active,
      code,
      createdAt,
      updatedAt,
      hashedPassword,
    };
  }
}
