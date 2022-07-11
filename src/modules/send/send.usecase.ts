import { Injectable, NotFoundException } from '@nestjs/common';
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
    if (!sendLink) {
      throw new NotFoundException(`SendLink with id ${id} not found`);
    }
    const now = new Date();
    if (now > sendLink.expirationAt) {
      throw new NotFoundException(`SendLink with id ${id} expired`);
    }
    sendLink.addView();
    sendLink.updatedAt = now;
    await this.sendRepository.update(sendLink);
    return await this.sendRepository.findById(id);
  }
  async createSendLinks(
    user: User | null,
    items: any,
    code: string,
    receivers: string[],
    sender: string,
    title: string,
    subject: string,
  ) {
    const expirationAt = new Date();
    expirationAt.setDate(expirationAt.getDate() + 15);
    const sendLink = SendLink.build({
      id: uuidv4(),
      views: 0,
      user,
      items: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      sender,
      receivers,
      code,
      title,
      subject,
      expirationAt,
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
      sendLink: await this.sendRepository.findById(sendLink.id),
    });

    this.notificationService.add(sendLinkCreatedEvent);

    return sendLink;
  }
}
