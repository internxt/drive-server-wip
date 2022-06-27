import { Injectable } from '@nestjs/common';
import { User } from '../user/user.domain';
import { SequelizeSendRepository } from './send-link.repository';
import { SendLink, SendLinkAttributes } from './send-link.domain';
import { SendLinkItem } from './send-link-item.domain';
import { v4 as uuidv4 } from 'uuid';
import { NotificationService } from '../../externals/notifications/notification.service';
import { SendLinkCreatedEvent } from '../../externals/notifications/events/send-link-created.event';

@Injectable()
export class SendUseCases {
  constructor(
    private sendRepository: SequelizeSendRepository,
    private notificationService: NotificationService,
  ) {}

  async getById(id: SendLinkAttributes['id']) {
    const sendLink = await this.sendRepository.findById(id);
    //return items with pagination
    return sendLink;
  }

  async createSendLinks(
    user: User | null,
    items: any,
    code: string,
    receiver: string,
    sender: string,
  ) {
    const sendLink = SendLink.build({
      id: uuidv4(),
      views: 0,
      user,
      items: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      sender,
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

    const sendLinkCreatedEvent = new SendLinkCreatedEvent({
      sendLink,
      receiver,
    });

    this.notificationService.add(sendLinkCreatedEvent);

    return sendLink;
  }
}
