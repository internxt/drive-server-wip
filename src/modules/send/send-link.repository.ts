import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { FileAttributes } from '../file/file.domain';
import { toDomain as toDomainFile } from '../file/file.repository';
import { User, UserAttributes } from '../user/user.domain';
import { UserModel } from '../user/user.repository';
import { toDomain as toDomainFolder } from '../folder/folder.repository';
import { FolderAttributes } from '../folder/folder.domain';
import { SendLink, SendLinkAttributes } from './send-link.domain';
import { SendLinkItem } from './send-link-item.domain';
import { SendLinkModel } from './models/send-link.model';
import { SendLinkItemModel } from './models/send-link-item.model';

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
      receiver: model.receiver,
    });
    const items = model.items.map((item: SendLinkItemModel) => {
      return SendLinkItem.build({
        id: item.id,
        type: item.type,
        item:
          item.itemType === 'FILE'
            ? toDomainFile(item.file)
            : toDomainFolder(item.folder),
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
