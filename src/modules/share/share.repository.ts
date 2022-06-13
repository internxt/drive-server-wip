import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Share, ShareAttributes } from './share.domain';
import { File, FileAttributes } from '../file/file.domain';
import {
  Column,
  Model,
  Table,
  PrimaryKey,
  ForeignKey,
  BelongsTo,
  DataType,
  Default,
  Unique,
  AllowNull,
} from 'sequelize-typescript';
import { FileModel } from '../file/file.repository';
import { User, UserAttributes } from '../user/user.domain';
import { UserModel } from '../user/user.repository';
import { FolderModel } from '../folder/folder.repository';
import { Folder, FolderAttributes } from '../folder/folder.domain';
import { Pagination } from 'src/lib/pagination';
@Table({
  underscored: true,
  timestamps: true,
  tableName: 'shares',
})
export class ShareModel extends Model {
  @PrimaryKey
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
}

export interface ShareRepository {
  findById(id: number): Promise<Share | null>;
  findByToken(token: string): Promise<Share | null>;
  findAllByUserPaginated(
    user: any,
    page: number,
    perPage: number,
  ): Promise<{ count: number; items: Array<Share> | [] }>;
  update(share: Share): Promise<true>;
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
    const share = await this.shareModel.findByPk(id);
    return share ? this.toDomain(share) : null;
  }

  async findByFileIdAndUser(
    fileId: FileAttributes['id'],
    userId: UserAttributes['id'],
  ) {
    const share = await this.shareModel.findOne({
      where: { fileId, userId },
      include: [this.fileModel, this.userModel],
    });
    return share ? this.toDomain(share) : null;
  }

  async findByFolderIdAndUser(
    folderId: FolderAttributes['id'],
    userId: UserAttributes['id'],
  ) {
    const share = await this.shareModel.findOne({
      where: { folderId, userId },
      include: [this.folderModel, this.userModel],
    });
    return share ? this.toDomain(share) : null;
  }

  async findByToken(token: string): Promise<Share | null> {
    const share = await this.shareModel.findOne({
      where: { token },
      include: [this.fileModel, this.folderModel, this.userModel],
    });
    if (!share) {
      throw new NotFoundException('share not found');
    }
    return this.toDomain(share);
  }
  async create(share: Share): Promise<void> {
    const shareModel = this.toModel(share);
    delete shareModel.id;
    await this.shareModel.create(shareModel);
  }

  async update(share: Share): Promise<true> {
    const shareModel = await this.shareModel.findByPk(share.id);
    if (!shareModel) {
      throw new NotFoundException(`Share with ID ${share.id} not found`);
    }
    shareModel.set(this.toModel(share));
    shareModel.save();
    return true;
  }

  async findAllByUserPaginated(
    user: User,
    page: number,
    perPage: number,
  ): Promise<{ count: number; items: Array<Share> | [] }> {
    const { offset, limit } = Pagination.calculatePagination(page, perPage);
    const shares = await this.shareModel.findAndCountAll({
      where: {
        user: user.email,
        mnemonic: '',
      },
      include: [
        {
          model: this.fileModel,
          where: { userId: user.id },
        },
        this.userModel,
        this.folderModel,
      ],
      offset,
      limit,
    });
    return {
      count: shares.count,
      items: shares.rows.map((share) => {
        return this.toDomain(share);
      }),
    };
  }

  private toDomain(model): Share {
    let item: File | Folder = null;
    if (model.isFolder) {
      item = Folder.build(model.folder);
    } else {
      item = File.build(model.file);
    }
    return Share.build({
      id: model.id,
      token: model.token,
      mnemonic: model.mnemonic,
      item,
      encryptionKey: model.encryptionKey,
      bucket: model.bucket,
      itemToken: model.fileToken,
      isFolder: model.isFolder,
      views: model.views,
      timesValid: model.timesValid,
      active: model.active,
      user: model.user ? User.build(model.user) : null,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    });
  }

  private toModel({
    id,
    token,
    mnemonic,
    user,
    item,
    encryptionKey,
    bucket,
    itemToken,
    isFolder,
    views,
    timesValid,
    active,
    createdAt,
    updatedAt,
  }) {
    return {
      id,
      token,
      mnemonic,
      userId: user.id,
      fileId: !isFolder ? item.id : null,
      folderId: isFolder ? item.id : null,
      encryptionKey,
      bucket,
      fileToken: itemToken,
      isFolder,
      views,
      timesValid,
      active,
      createdAt,
      updatedAt,
    };
  }
}
