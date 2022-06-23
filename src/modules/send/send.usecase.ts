import { Injectable } from '@nestjs/common';
import { FileUseCases } from '../file/file.usecase';
import { User } from '../user/user.domain';
import { FolderUseCases } from '../folder/folder.usecase';
import { SequelizeSendRepository } from './send-link.repository';
import { SendLink, SendLinkAttributes } from './send-link.domain';
import { CreateSendLinkDto, SendLinkItemDto } from './dto/create-send-link.dto';
import { SendLinkItem } from './send-link-item.domain';
import { v4 as uuidv4 } from 'uuid';

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
    code: string,
    receiver: string,
  ) {
    const sendLink = SendLink.build({
      id: uuidv4(),
      views: 0,
      user,
      items: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      receiver,
      code,
    });
    for (const item of items) {
      const sendLinkItem = SendLinkItem.build({
        id: uuidv4(),
        name: item.name,
        type: item.type,
        linkId: sendLink.id,
        networkId: item.networkId,
        encryptionKey: item.encryptionKey,
        size: item.size,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      sendLink.addItem(sendLinkItem);
    }

    await this.sendRepository.createSendLinkWithItems(sendLink);

    return sendLink;
  }
}
