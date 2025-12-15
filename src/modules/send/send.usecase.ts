import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { User } from '../user/user.domain';
import { SequelizeSendRepository } from './send-link.repository';
import { SendLink, SendLinkAttributes } from './send-link.domain';
import { SendLinkItem } from './send-link-item.domain';
import { v4 as uuidv4, validate } from 'uuid';
import { NotificationService } from '../../externals/notifications/notification.service';
import { SendLinkCreatedEvent } from '../../externals/notifications/events/send-link-created.event';
import { CryptoService } from '../../externals/crypto/crypto.service';
import getEnv from '../../config/configuration';
import { SendLinkItemDto } from './dto/create-send-link.dto';

@Injectable()
export class SendUseCases {
  constructor(
    private readonly sendRepository: SequelizeSendRepository,
    private readonly notificationService: NotificationService,
    private readonly cryptoService: CryptoService,
  ) {}

  async getById(id: SendLinkAttributes['id']) {
    if (!validate(id)) {
      throw new BadRequestException('id is not in uuid format');
    }
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
    return this.sendRepository.findById(id);
  }

  async createSendLinks(
    user: User | null,
    items: SendLinkItemDto[],
    code: string,
    receivers: string[],
    sender: string,
    title: string,
    subject: string,
    plainCode: string,
    plainPassword?: string,
  ) {
    const expirationAt = new Date();
    expirationAt.setDate(expirationAt.getDate() + 15);

    const hashedPassword = plainPassword
      ? this.cryptoService.deterministicEncryption(plainPassword)
      : null;

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
      hashedPassword,
    });
    let totalSize = 0;
    let totalFiles = 0;
    for (const item of items) {
      const sendLinkItem = SendLinkItem.build({
        id: item.id,
        name: item.name,
        type: item.type,
        linkId: sendLink.id,
        networkId: item.networkId,
        encryptionKey: item.encryptionKey,
        size: item.size,
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 2,
        parent_folder: item.parent_folder,
      });
      sendLink.addItem(sendLinkItem);
      if (
        !item.parent_folder ||
        String(item.parent_folder).trim().length === 0
      ) {
        totalSize += item.size;
      }

      if (item.type === 'file') {
        totalFiles++;
      }
    }

    await this.sendRepository.createSendLinkWithItems(sendLink);
    const count = await this.sendRepository.countBySendersToday();
    const DAILY_LIMIT = 1000;

    if (count < DAILY_LIMIT) {
      const sendLinkCreatedEvent = new SendLinkCreatedEvent({
        sendLink: {
          ...sendLink,
          plainCode,
          size: totalSize,
          totalFiles: totalFiles,
        },
      });

      this.notificationService.add(sendLinkCreatedEvent);
    }

    return sendLink;
  }

  public unlockLink(sendLink: SendLink, password: string): void {
    if (!sendLink.isProtected()) return;

    if (!password) {
      throw new ForbiddenException('Send link protected by password');
    }

    const hashedPassword = this.cryptoService.deterministicEncryption(password);

    if (sendLink.hashedPassword !== hashedPassword) {
      throw new ForbiddenException('Invalid password');
    }
  }
}
