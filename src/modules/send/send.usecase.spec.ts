import { EventEmitter2 } from '@nestjs/event-emitter';
import { getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';
import { Sequelize } from 'sequelize-typescript';
import { NotificationService } from '../../externals/notifications/notification.service';
import { FileModel, SequelizeFileRepository } from '../file/file.repository';
import { FileUseCases } from '../file/file.usecase';
import {
  FolderModel,
  SequelizeFolderRepository,
} from '../folder/folder.repository';
import { FolderUseCases } from '../folder/folder.usecase';
import { User } from '../user/user.domain';
import { UserModel } from '../user/user.repository';
import {
  SendLinkItemModel,
  SendLinkModel,
  SendRepository,
  SequelizeSendRepository,
} from './send-link.repository';
import { SendUseCases } from './send.usecase';

describe('Send Use Cases', () => {
  let service, fileService, folderService, notificationService, sendRepository;
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
    tempKey: '',
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SendUseCases,
        NotificationService,
        FolderUseCases,
        FileUseCases,
        SequelizeSendRepository,
        SequelizeFileRepository,
        SequelizeFolderRepository,
        EventEmitter2,
        {
          provide: Sequelize,
          useValue: jest.fn(),
        },
        {
          provide: getModelToken(SendLinkModel),
          useValue: jest.fn(),
        },
        {
          provide: getModelToken(SendLinkItemModel),
          useValue: jest.fn(),
        },
        {
          provide: getModelToken(FolderModel),
          useValue: jest.fn(),
        },
        {
          provide: getModelToken(FileModel),
          useValue: jest.fn(),
        },
        {
          provide: getModelToken(UserModel),
          useValue: jest.fn(),
        },
      ],
    }).compile();

    service = module.get<SendUseCases>(SendUseCases);
    fileService = module.get<FileUseCases>(FileUseCases);
    folderService = module.get<FolderUseCases>(FolderUseCases);
    notificationService = module.get<NotificationService>(NotificationService);
    sendRepository = module.get<SendRepository>(SequelizeSendRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('get by id', async () => {
    jest.spyOn(sendRepository, 'findById').mockResolvedValue(null);

    const result = await service.getById('id');
    expect(result).toBe(null);
  });

  it('create send links without user', async () => {
    jest.spyOn(notificationService, 'add').mockResolvedValue(true);
    jest
      .spyOn(sendRepository, 'createSendLinkWithItems')
      .mockResolvedValue(undefined);
    const sendLink = await service.createSendLinks(
      null,
      [],
      'code',
      'receiver@gmail.com',
      'sender@gmail.com',
    );
    expect(sendRepository.createSendLinkWithItems).toHaveBeenCalledTimes(1);
    expect(notificationService.add).toHaveBeenCalledTimes(1);
    expect(sendLink).toMatchObject({
      user: null,
      code: 'code',
      sender: 'sender@gmail.com',
      receiver: 'receiver@gmail.com',
      items: [],
    });
  });

  it('create send links with user', async () => {
    jest.spyOn(notificationService, 'add').mockResolvedValue(true);
    jest
      .spyOn(sendRepository, 'createSendLinkWithItems')
      .mockResolvedValue(undefined);
    const sendLink = await service.createSendLinks(
      userMock,
      [],
      'code',
      'receiver@gmail.com',
      'sender@gmail.com',
    );
    expect(sendRepository.createSendLinkWithItems).toHaveBeenCalledTimes(1);
    expect(notificationService.add).toHaveBeenCalledTimes(1);
    expect(sendLink).toMatchObject({
      user: userMock,
      code: 'code',
      sender: 'sender@gmail.com',
      receiver: 'receiver@gmail.com',
      items: [],
    });
  });
});
