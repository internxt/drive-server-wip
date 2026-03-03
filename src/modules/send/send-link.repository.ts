import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { User } from '../user/user.domain';
import { UserModel } from '../user/user.model';
import { SendLink, type SendLinkAttributes } from './send-link.domain';
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
import { Op } from 'sequelize';

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
  receivers: string;

  @Column
  code: string;

  @Column
  title: string;

  @Column
  subject: string;

  @Column
  expirationAt: Date;

  @Column
  createdAt: Date;

  @Column
  updatedAt: Date;

  @AllowNull
  @Column(DataType.TEXT)
  hashedPassword: string;

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
  linkId: string;

  @BelongsTo(() => SendLinkModel)
  link: any;

  @AllowNull
  @Column
  networkId: string;

  @Column(DataType.STRING(64))
  encryptionKey: string;

  @Column(DataType.INTEGER.UNSIGNED)
  size: number;

  @Column
  createdAt: Date;

  @Column
  updatedAt: Date;

  @Column(DataType.INTEGER)
  version: number;

  @Column
  parent_folder: string;
}

export interface SendRepository {
  findById(id: SendLinkAttributes['id']): Promise<SendLink | null>;
  update(sendLink: SendLink): void;
}

@Injectable()
export class SequelizeSendRepository implements SendRepository {
  constructor(
    @InjectModel(SendLinkModel)
    private readonly sendLinkModel: typeof SendLinkModel,
    @InjectModel(SendLinkItemModel)
    private readonly sendLinkItemModel: typeof SendLinkItemModel,
    @InjectModel(UserModel)
    private readonly userModel: typeof UserModel,
    private readonly sequelize: Sequelize,
  ) {}

  async findById(id: SendLinkAttributes['id']) {
    const sendLink = await this.sendLinkModel.findByPk(id, {
      include: [this.userModel, this.sendLinkItemModel],
    });
    return sendLink ? this.toDomain(sendLink) : null;
  }

  async createSendLinkWithItems(sendLink: SendLink): Promise<void> {
    const sendLinkModel = this.toModel(sendLink);
    await this.sendLinkModel.create(sendLinkModel);
    await this.sendLinkItemModel.bulkCreate(sendLinkModel.items);
  }

  async update(sendLink: SendLink): Promise<void> {
    const sendLinkModel = await this.sendLinkModel.findByPk(sendLink.id);
    if (!sendLinkModel) {
      throw new NotFoundException(`sendLink with ID ${sendLink.id} not found`);
    }
    sendLinkModel.set(this.toModel(sendLink));
    await sendLinkModel.save();
  }

  countBySendersToday(): Promise<number> {
    return this.sendLinkModel.count({
      where: {
        sender: {
          [Op.not]: null,
        },
        created_at: {
          [Op.gt]: new Date(new Date().getTime() - 24 * 60 * 60 * 1000), // Subtracting 1 day from the current date
        },
      },
    });
  }

  private toDomain(model: SendLinkModel): SendLink {
    const sendLink = SendLink.build({
      id: model.id,
      views: model.views,
      user: model.user ? User.build(model.user) : null,
      items: [],
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
      sender: model.sender,
      receivers: model.receivers ? model.receivers.split(',') || [] : null,
      code: model.code,
      title: model.title,
      subject: model.subject,
      expirationAt: model.expirationAt,
      hashedPassword: model.hashedPassword,
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
    receivers,
    code,
    title,
    subject,
    expirationAt,
    createdAt,
    updatedAt,
    hashedPassword,
  }) {
    return {
      id,
      views,
      userId: user ? user.id : null,
      items: items.map((item) => this.toModelItem(item)),
      sender,
      receivers: receivers ? receivers.join(',') : null,
      code,
      title,
      subject,
      expirationAt,
      createdAt,
      updatedAt,
      hashedPassword,
    };
  }
  private toDomainItem(model: SendLinkItemModel): SendLinkItem {
    return SendLinkItem.build({
      id: model.id,
      type: model.type,
      name: model.name,
      linkId: model.linkId,
      networkId: model.networkId,
      encryptionKey: model.encryptionKey,
      size: parseInt(model.size as unknown as string),
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
      version: model.version,
      parent_folder: model.parent_folder,
    });
  }

  private toModelItem(domain: SendLinkItem) {
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
      version: domain.version,
      parent_folder: domain.parent_folder,
    };
  }
}
