import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { FileUseCases } from '../file/file.usecase';
import { User } from '../user/user.domain';
import { CreateShareDto } from './dto/create-share.dto';
import { Share } from './share.domain';
import { SequelizeShareRepository } from './share.repository';
import crypto from 'crypto';
import { FolderUseCases } from '../folder/folder.usecase';
import { UpdateShareDto } from './dto/update-share.dto';
import { SequelizeSendRepository } from './send-link.repository';
import { SendLink, SendLinkAttributes } from './send-link.domain';
import { CreateSendLinkDto, SendLinkItemDto } from './dto/create-send-link.dto';
import { SendLinkItem, SendLinkItemTypes } from './send-link-item.domain';

@Injectable()
export class SendUseCases {
  constructor(
    private sendRepository: SequelizeSendRepository,
    private fileUseCases: FileUseCases,
    private folderUseCases: FolderUseCases,
  ) {}

  async getById(id: SendLinkAttributes['id']) {
    const sendLink = await this.sendRepository.findById(id);
    //return items with pagination
    return sendLink;
  }

  // instance sendlink
  // each item
  // check exists
  // instance domain sendItem
  // after bucle:
  // save sendLink with items
  async createSendLinks(
    user: User,
    items: any,
    networkId: string,
    encryptionKey: string,
    code: string,
    receiver: string,
  ) {
    const sendLink = SendLink.build({
      id: 1,
      views: 0,
      user,
      items: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      receiver,
    });

    for (const item of items) {
      let sendItem = { item: null, type: null };
      if (item.type === SendLinkItemTypes.FILE) {
        const file = await this.fileUseCases.getByFileIdAndUser(
          item.id,
          user.id,
        );
        if (!file) {
          throw new NotFoundException(`file with id ${item.id} not found`);
        }
        sendItem = {
          item: file,
          type: SendLinkItemTypes.FILE,
        };
      }
      if (item.type === SendLinkItemTypes.FOLDER) {
        const folder = await this.folderUseCases.getFolder(item.id);
        if (!folder) {
          throw new NotFoundException(`folder with id ${item.id} not found`);
        }
        sendItem = {
          item: folder,
          type: SendLinkItemTypes.FOLDER,
        };
      }
      const sendLinkItem = SendLinkItem.build({
        id: '1', // TODO: Replace with UUID
        item: sendItem.item,
        type: sendItem.type,
        link: sendLink,
        networkId,
        encryptionKey,
        size: sendItem.item.size,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      sendLink.addItem(sendLinkItem);
    }

    // const sendLink = await this.sendRepository.findByFileIdAndUser(
    //   file.id,
    //   user.id,
    // );
    // if (sendLink) {
    //   return { item: sendLink.toJSON(), created: false };
    // }
    // create sendlink here
    // const token = crypto.randomBytes(10).toString('hex');
    // const shareCreated = Share.build({
    //   id: 1,
    //   token,
    //   mnemonic: '',
    //   user: user,
    //   item: file,
    //   encryptionKey,
    //   bucket,
    //   itemToken,
    //   isFolder: false,
    //   views: 0,
    //   timesValid,
    //   active: true,
    //   createdAt: new Date(),
    //   updatedAt: new Date(),
    // });
    // await this.shareRepository.create(shareCreated);
    // apply userReferral to share-file
    return { item: shareCreated.toJSON(), created: true };
  }
}
