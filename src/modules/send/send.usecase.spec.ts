import { ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getModelToken } from '@nestjs/sequelize';
import { Test, type TestingModule } from '@nestjs/testing';
import { Sequelize } from 'sequelize-typescript';
import { CryptoModule } from '../../externals/crypto/crypto.module';
import { NotificationService } from '../../externals/notifications/notification.service';
import { NewsletterService } from '../../externals/newsletter';
import { FolderModel } from '../folder/folder.model';
import { User } from '../user/user.domain';
import { UserModel } from '../user/user.repository';
import { SendLink } from './send-link.domain';
import {
  SendLinkItemModel,
  SendLinkModel,
  type SendRepository,
  SequelizeSendRepository,
} from './send-link.repository';
import { SendUseCases } from './send.usecase';
import { createMock } from '@golevelup/ts-jest';

describe('Send Use Cases', () => {
  let service: SendUseCases,
    notificationService,
    sendRepository,
    newsletterService;
  const userMock = User.build({
    id: 2,
    userId: 'userId',
    name: 'User Owner',
    lastname: 'Lastname',
    email: 'fake@internxt.com',
    username: 'fake',
    bridgeUser: null,
    rootFolderId: 1,
    errorLoginCount: 0,
    isEmailActivitySended: 1,
    referralCode: null,
    referrer: null,
    syncDate: new Date(),
    uuid: 'uuid',
    lastResend: new Date(),
    credit: null,
    welcomePack: true,
    registerCompleted: true,
    backupsBucket: 'bucket',
    sharedWorkspace: true,
    avatar: 'avatar',
    password: '',
    mnemonic: '',
    hKey: undefined,
    secret_2FA: '',
    lastPasswordChangedAt: new Date(),
    emailVerified: false,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [CryptoModule],
      providers: [
        SendUseCases,
        NotificationService,
        SequelizeSendRepository,
        EventEmitter2,
        {
          provide: Sequelize,
          useValue: jest.fn(),
        },
        {
          provide: getModelToken(SendLinkModel),
          useValue: {
            count: jest.fn(),
          },
        },
        {
          provide: getModelToken(SendLinkItemModel),
          useValue: jest.fn(),
        },
        {
          provide: getModelToken(UserModel),
          useValue: jest.fn(),
        },
        {
          provide: getModelToken(FolderModel),
          useValue: jest.fn(),
        },
      ],
    })
      .useMocker(() => createMock())
      .compile();

    service = module.get<SendUseCases>(SendUseCases);
    notificationService = module.get<NotificationService>(NotificationService);
    sendRepository = module.get<SendRepository>(SequelizeSendRepository);
    newsletterService = module.get<NewsletterService>(NewsletterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
  describe('get By Id use case', () => {
    const sendLinkMockId = '53cf59ce-599d-4bc3-8497-09b72301d2a4';

    it('throw not found when id invalid', async () => {
      jest.spyOn(sendRepository, 'findById').mockResolvedValue(null);

      await expect(service.getById(sendLinkMockId)).rejects.toThrow(
        `SendLink with id ${sendLinkMockId} not found`,
      );
    });

    it('throw not found when expiration', async () => {
      const expirationAt = new Date();
      expirationAt.setDate(expirationAt.getDate() - 1);
      const sendLinkMock = SendLink.build({
        id: sendLinkMockId,
        views: 0,
        user: userMock,
        items: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        sender: 'sender@gmail.com',
        receivers: ['receiver@gmail.com'],
        code: 'code',
        title: 'title',
        subject: 'subject',
        expirationAt,
        hashedPassword: null,
      });
      jest.spyOn(sendRepository, 'findById').mockResolvedValue(sendLinkMock);

      await expect(service.getById(sendLinkMockId)).rejects.toThrow(
        `SendLink with id ${sendLinkMockId} expired`,
      );
    });

    it('should return sendLink valid', async () => {
      const expirationAt = new Date();
      expirationAt.setDate(expirationAt.getDate() + 1);
      const sendLinkMock = SendLink.build({
        id: sendLinkMockId,
        views: 0,
        user: userMock,
        items: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        sender: 'sender@gmail.com',
        receivers: ['receiver@gmail.com'],
        code: 'code',
        title: 'title',
        subject: 'subject',
        expirationAt,
        hashedPassword: null,
      });
      jest.spyOn(sendRepository, 'findById').mockResolvedValue(sendLinkMock);
      jest.spyOn(sendRepository, 'update').mockResolvedValue(undefined);

      const result = await service.getById(sendLinkMockId);
      expect(result).toMatchObject({
        id: sendLinkMockId,
        views: 1,
        items: [],
        code: 'code',
        title: 'title',
        subject: 'subject',
      });
      expect(sendRepository.findById).toHaveBeenCalledTimes(2);
      expect(sendRepository.update).toHaveBeenCalledTimes(1);
    });
  });

  it('create send links without user', async () => {
    jest.spyOn(notificationService, 'add').mockResolvedValue(true);
    jest
      .spyOn(sendRepository, 'createSendLinkWithItems')
      .mockResolvedValue(undefined);
    jest.spyOn(sendRepository, 'findById').mockResolvedValue(undefined);
    jest.spyOn(sendRepository, 'countBySendersToday').mockResolvedValue(2);

    const sendLink = await service.createSendLinks(
      null,
      [],
      'code',
      ['receiver@gmail.com'],
      'sender@gmail.com',
      'title',
      'subject',
      'plainCode',
      null,
    );
    expect(sendRepository.createSendLinkWithItems).toHaveBeenCalledTimes(1);
    expect(notificationService.add).toHaveBeenCalledTimes(1);
    expect(sendLink).toMatchObject({
      user: null,
      code: 'code',
      sender: 'sender@gmail.com',
      receivers: ['receiver@gmail.com'],
      items: [],
    });
  });

  it('create send links with user', async () => {
    jest.spyOn(notificationService, 'add').mockResolvedValue(true);
    jest
      .spyOn(sendRepository, 'createSendLinkWithItems')
      .mockResolvedValue(undefined);
    jest.spyOn(sendRepository, 'findById').mockResolvedValue(undefined);
    jest.spyOn(sendRepository, 'countBySendersToday').mockResolvedValue(2);

    const sendLink = await service.createSendLinks(
      userMock,
      [],
      'code',
      ['receiver@gmail.com'],
      'sender@gmail.com',
      'title',
      'subject',
      'plainCode',
      null,
    );
    expect(sendRepository.createSendLinkWithItems).toHaveBeenCalledTimes(1);
    expect(notificationService.add).toHaveBeenCalledTimes(1);
    expect(sendLink).toMatchObject({
      user: userMock,
      code: 'code',
      sender: 'sender@gmail.com',
      receivers: ['receiver@gmail.com'],
      items: [],
    });
  });

  it('should create a sendLink protected by password', async () => {
    jest.spyOn(notificationService, 'add').mockResolvedValue(true);
    jest
      .spyOn(sendRepository, 'createSendLinkWithItems')
      .mockResolvedValue(undefined);
    jest.spyOn(sendRepository, 'findById').mockResolvedValue(undefined);

    const sendLink = await service.createSendLinks(
      userMock,
      [],
      'code',
      ['receiver@gmail.com'],
      'sender@gmail.com',
      'title',
      'subject',
      'plainCode',
      'password',
    );

    expect(sendLink.isProtected()).toBe(true);
  });

  describe('Unlock Link', () => {
    it('unlock unprotected send link', () => {
      const unprotectedSendLink = SendLink.build({
        id: '46716608-c5e4-5404-a2b9-2a38d737d87d',
        views: 0,
        user: userMock,
        items: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        sender: 'sender@gmail.com',
        receivers: ['receiver@gmail.com'],
        code: 'code',
        title: 'title',
        subject: 'subject',
        expirationAt: new Date(),
        hashedPassword: null,
      });

      service.unlockLink(unprotectedSendLink, '');
    });

    it('unlock protected send link without password throws unauthorized exception', () => {
      const unprotectedSendLink = SendLink.build({
        id: '46716608-c5e4-5404-a2b9-2a38d737d87d',
        views: 0,
        user: userMock,
        items: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        sender: 'sender@gmail.com',
        receivers: ['receiver@gmail.com'],
        code: 'code',
        title: 'title',
        subject: 'subject',
        expirationAt: new Date(),
        hashedPassword: 'password',
      });

      try {
        service.unlockLink(unprotectedSendLink, null);
      } catch (err: any) {
        expect(err).toBeInstanceOf(ForbiddenException);
      }
    });

    it('unlock protected send link with invalid password throws unauthorized exception', () => {
      const unprotectedSendLink = SendLink.build({
        id: '46716608-c5e4-5404-a2b9-2a38d737d87d',
        views: 0,
        user: userMock,
        items: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        sender: 'sender@gmail.com',
        receivers: ['receiver@gmail.com'],
        code: 'code',
        title: 'title',
        subject: 'subject',
        expirationAt: new Date(),
        hashedPassword: 'password',
      });

      try {
        service.unlockLink(unprotectedSendLink, 'password');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ForbiddenException);
      }
    });
  });
});
