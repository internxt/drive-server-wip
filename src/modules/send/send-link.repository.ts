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
  AllowNull,
  HasMany,
} from 'sequelize-typescript';
import { FileModel } from '../file/file.repository';
import { User, UserAttributes } from '../user/user.domain';
import { UserModel } from '../user/user.repository';
import { FolderModel } from '../folder/folder.repository';
import { Folder, FolderAttributes } from '../folder/folder.domain';
import { Pagination } from '../../lib/pagination';
import { SendLinkItem } from './send-link-item.domain';
import { SendLink, SendLinkAttributes } from './send-link.domain';
import { items } from '@internxt/lib';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'send_links',
})
export class SendLinkModel extends Model {
  @PrimaryKey
  @Column
  id: string;

  @Column
  views: number;

  @ForeignKey(() => UserModel)
  @Column
  userId: number;

  @BelongsTo(() => UserModel)
  user: UserModel;

  @Column
  receiver: string;

  @HasMany(() => SendLinkItemModel)
  items: SendLinkItemModel[];
}

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'send_items',
})
export class SendLinkItemModel extends Model {
  @PrimaryKey
  @Column
  id: string;

  @Column
  type: string;

  @ForeignKey(() => FileModel)
  @Column
  fileId: number;

  @BelongsTo(() => FileModel)
  file: FileModel;

  @ForeignKey(() => FolderModel)
  @Column
  folderId: number;

  @BelongsTo(() => FolderModel)
  folder: FolderModel;

  @ForeignKey(() => SendLinkModel)
  @Column
  linkId: number;

  @BelongsTo(() => SendLinkModel)
  link: SendLinkModel;

  @AllowNull
  @Column
  networkId: string;

  @Column(DataType.STRING(64))
  encryptionKey: string;

  @Column
  size: bigint;
}

export interface SendRepository {
  findById(id: SendLinkAttributes['id']): Promise<Share | null>;
  findByFileIdAndUser(
    fileId: FileAttributes['id'],
    userId: UserAttributes['id'],
  ): Promise<SendLink | null>;
  findByFolderIdAndUser(
    folderId: FolderAttributes['id'],
    userId: UserAttributes['id'],
  ): Promise<SendLink | null>;
}

@Injectable()
export class SequelizeSendRepository implements SendRepository {
  constructor(
    @InjectModel(SendLinkModel)
    private sendLinkModel: typeof SendLinkModel,
    @InjectModel(SendLinkItemModel)
    private sendLinkItemModel: typeof SendLinkItemModel,
    @InjectModel(UserModel)
    private userModel: typeof UserModel,
  ) {}

  async findById(id: SendLinkAttributes['id']) {
    const sendLink = await this.sendLinkModel.findByPk(id, {
      include: [this.userModel, this.sendLinkItemModel],
    });
    return sendLink ? this.toDomain(sendLink) : null;
  }

  async findByFileIdAndUser(
    fileId: FileAttributes['id'],
    userId: UserAttributes['id'],
  ): Promise<SendLink | null> {
    const sendLink = await this.sendLinkModel.findOne({
      where: { userId },
      include: [
        this.userModel,
        {
          model: this.sendLinkItemModel,
          where: { fileId },
        },
      ],
    });
    return sendLink ? this.toDomain(sendLink) : null;
  }

  async findByFolderIdAndUser(
    folderId: FolderAttributes['id'],
    userId: UserAttributes['id'],
  ): Promise<SendLink | null> {
    const sendLink = await this.sendLinkModel.findOne({
      where: { userId },
      include: [
        this.userModel,
        {
          model: this.sendLinkItemModel,
          where: { folderId },
        },
      ],
    });
    return sendLink ? this.toDomain(sendLink) : null;
  }

  async createSendLinkWithItems(sendLink: SendLink): Promise<void> {
    const sendLinkModel = this.toModel(sendLink);
    const send = await this.sendLinkModel.create({
      id: sendLink.id,
      views: sendLink.views,
      user: sendLink.user,
      receiver: sendLink.receiver,
      createdAt: sendLink.createdAt,
      updatedAt: sendLink.updatedAt,
    });
    for (const item of sendLinkModel.items) {
      await this.sendLinkItemModel.create({
        id: item.id,
        fileId: item.type === 'FILE' ? item.item.id : null,
      });
    }
  }

  async update(sendLink: SendLink): Promise<void> {
    const sendLinkModel = await this.sendLinkModel.findByPk(sendLink.id);
    if (!sendLinkModel) {
      throw new NotFoundException(`sendLink with ID ${sendLink.id} not found`);
    }
    sendLinkModel.set(this.toModel(sendLink));
    sendLinkModel.save();
  }

  private toDomain(model): SendLink {
    const sendLink = SendLink.build({
      id: model.id,
      views: model.views,
      user: model.user ? User.build(model.user) : null,
      items: [],
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    });
    const items = model.items.map((item: SendLinkItemModel) => {
      return SendLinkItem.build({
        id: item.id,
        type: item.type,
        link: sendLink,
        networkId: item.networkId,
        encryptionKey: item.encryptionKey,
        size: item.size,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      });
    });
    sendLink.setItems(items);
    return sendLink;
  }

  private toModel({ id, views, user, items, receiver, createdAt, updatedAt }) {
    return {
      id,
      views,
      user,
      items,
      receiver,
      createdAt,
      updatedAt,
    };
  }
}
