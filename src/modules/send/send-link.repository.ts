import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { User } from '../user/user.domain';
import { UserModel } from '../user/user.model';
import { SendLink, SendLinkAttributes } from './send-link.domain';
import { SendLinkItem } from './send-link-item.domain';
import { Sequelize } from 'sequelize-typescript';
import {
  getStringFromBinary,
  convertStringToBinary,
} from '../../lib/binary-converter';
import { SendLinkModel } from './send-link.model';
import { SendLinkItemModel } from './send-link-item.model';

const ENCRYPTION_DATE_RELEASE = new Date('2022-07-05 13:55:00');

export interface SendRepository {
  findById(id: SendLinkAttributes['id']): Promise<SendLink | null>;
  update(sendLink: SendLink): void;
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

  async createSendLinkWithItems(sendLink: SendLink): Promise<void> {
    const sendLinkModel = this.toModel(sendLink);
    const transaction = await this.sequelize.transaction();
    try {
      await this.sendLinkModel.create(sendLinkModel, { transaction });
      await this.sendLinkItemModel.bulkCreate(sendLinkModel.items, {
        transaction,
      });
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  async update(sendLink: SendLink): Promise<void> {
    const sendLinkModel = await this.sendLinkModel.findByPk(sendLink.id);
    if (!sendLinkModel) {
      throw new NotFoundException(`sendLink with ID ${sendLink.id} not found`);
    }
    sendLinkModel.set(this.toModel(sendLink));
    await sendLinkModel.save();
  }

  private toDomain(model: SendLinkModel): SendLink {
    if (
      model.title &&
      model.subject &&
      model.createdAt > ENCRYPTION_DATE_RELEASE
    ) {
      model.title = getStringFromBinary(atob(model.title));
      model.subject = getStringFromBinary(atob(model.subject));
    }

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
    if (title && subject && createdAt > ENCRYPTION_DATE_RELEASE) {
      title = btoa(convertStringToBinary(title));
      subject = btoa(convertStringToBinary(subject));
    }
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
    if (model.createdAt > ENCRYPTION_DATE_RELEASE) {
      model.name = getStringFromBinary(atob(model.name));
    }
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
    if (domain.createdAt > ENCRYPTION_DATE_RELEASE) {
      domain.name = btoa(convertStringToBinary(domain.name));
    }
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
