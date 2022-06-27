import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { FileAttributes } from '../file/file.domain';
import { User, UserAttributes } from '../user/user.domain';
import { UserModel } from '../user/user.repository';
import { FolderAttributes } from '../folder/folder.domain';
import { SendLink, SendLinkAttributes } from './send-link.domain';
import { SendLinkItem } from './send-link-item.domain';

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
  Sequelize,
} from 'sequelize-typescript';

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
  sender: string;

  @Column
  receiver: string;

  @Column
  code: string;

  @HasMany(() => SendLinkItemModel)
  items: SendLinkItemModel[];
}

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'send_links_items',
})
export class SendLinkItemModel extends Model {
  @PrimaryKey
  @Column
  id: string;

  @Column
  name: string;

  @Column
  type: string;

  @ForeignKey(() => SendLinkModel)
  @Column
  linkId: number;

  @BelongsTo(() => SendLinkModel)
  link: any;

  @AllowNull
  @Column
  networkId: string;

  @Column(DataType.STRING(64))
  encryptionKey: string;

  @Column
  size: bigint;
}

export interface SendRepository {
  findById(id: SendLinkAttributes['id']): Promise<SendLink | null>;
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
    private sequelize: Sequelize,
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
    const transaction = await this.sequelize.transaction();
    try {
      await this.sendLinkModel.create(sendLinkModel, { transaction });
      await this.sendLinkItemModel.bulkCreate(sendLinkModel.items, {
        transaction,
      });
      transaction.commit();
    } catch {
      transaction.rollback();
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
      sender: model.sender,
      receiver: model.receiver,
      code: model.code,
    });
    const items = model.items.map((item) => this.toDomainItem(item));
    sendLink.setItems(items);
    return sendLink;
  }

  private toModel({
    id,
    views,
    user,
    items,
    sender,
    receiver,
    code,
    createdAt,
    updatedAt,
  }) {
    return {
      id,
      views,
      userId: user.id,
      items: items.map((item) => this.toModelItem(item)),
      sender,
      receiver,
      code,
      createdAt,
      updatedAt,
    };
  }
  private toDomainItem(model): SendLinkItem {
    return SendLinkItem.build({
      id: model.id,
      type: model.type,
      name: model.name,
      linkId: model.linkId,
      networkId: model.networkId,
      encryptionKey: model.encryptionKey,
      size: model.size,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    });
  }

  private toModelItem(domain) {
    return {
      id: domain.id,
      name: domain.name,
      type: domain.type,
      linkId: domain.linkId,
      networkId: domain.networkId,
      encryptionKey: domain.encryptionKey,
      size: domain.size,
      createdAt: domain.createdAt,
      updatedAt: domain.updatedAt,
    };
  }
}
