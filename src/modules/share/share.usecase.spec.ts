import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';
import { FileModel, SequelizeFileRepository } from '../file/file.repository';
import { FileUseCases } from '../file/file.usecase';
import { Folder } from '../folder/folder.domain';
import {
  FolderModel,
  SequelizeFolderRepository,
} from '../folder/folder.repository';
import { FolderUseCases } from '../folder/folder.usecase';
import { User } from '../user/user.domain';
import { SequelizeUserRepository, UserModel } from '../user/user.repository';
import { UserUseCases } from '../user/user.usecase';
import { Share } from './share.domain';
import {
  SequelizeShareRepository,
  ShareModel,
  ShareRepository,
} from './share.repository';
import { ShareUseCases } from './share.usecase';

describe('Share Use Cases', () => {
  let service: ShareUseCases;
  let shareRepository: ShareRepository;
  const token = 'token';
  const userOwnerMock = User.build({
    id: 1,
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
  const mockFolder = Folder.build({
    id: 1,
    parentId: null,
    name: 'name',
    bucket: 'bucket',
    userId: 1,
    encryptVersion: '2',
    deleted: true,
    deletedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const shareFolder = Share.build({
    id: 1,
    token: 'token',
    mnemonic: 'test',
    user: userOwnerMock,
    item: mockFolder,
    encryptionKey: 'test',
    bucket: 'test',
    itemToken: 'token',
    isFolder: true,
    views: 0,
    timesValid: 10,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShareUseCases,
        FolderUseCases,
        UserUseCases,
        FileUseCases,
        SequelizeShareRepository,
        SequelizeFileRepository,
        SequelizeFolderRepository,
        SequelizeUserRepository,
        ConfigService,
        {
          provide: getModelToken(ShareModel),
          useValue: jest.fn(),
        },
        {
          provide: getModelToken(FileModel),
          useValue: jest.fn(),
        },
        {
          provide: getModelToken(FolderModel),
          useValue: jest.fn(),
        },
        {
          provide: getModelToken(UserModel),
          useValue: jest.fn(),
        },
      ],
    }).compile();

    service = module.get<ShareUseCases>(ShareUseCases);
    shareRepository = module.get<ShareRepository>(SequelizeShareRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('list shares by user', () => {
    const sharesMock = [shareFolder];

    it('should return shares valids with page 1', async () => {
      const page = 1;
      const perPage = 50;
      jest.spyOn(shareRepository, 'findAllByUserPaginated').mockResolvedValue({
        count: 1,
        items: sharesMock,
      });
      const result = await service.listByUserPaginated(userMock, page, perPage);
      expect(result).toMatchObject({
        pagination: {
          page,
          perPage,
          countAll: 1,
        },
        items: [
          {
            id: 1,
            token: 'token',
            item: mockFolder,
            isFolder: true,
            views: 0,
            timesValid: 10,
            active: true,
          },
        ],
      });
    });
  });

  describe('get share by token', () => {
    it('as owner share should return share', async () => {
      shareFolder.views = 0;
      shareFolder.active = true;
      jest.spyOn(shareRepository, 'findByToken').mockResolvedValue(shareFolder);
      const result = await service.getShareByToken(token, userOwnerMock);
      expect(result).toMatchObject({
        id: 1,
        token: 'token',
        views: 0,
        isFolder: true,
        timesValid: 10,
        active: true,
      });
    });
    it('as user not owner share should return share and increment view', async () => {
      shareFolder.views = 0;
      shareFolder.active = true;
      jest.spyOn(shareRepository, 'findByToken').mockResolvedValue(shareFolder);
      jest.spyOn(shareRepository, 'update').mockResolvedValue(true);
      const result = await service.getShareByToken(token, userMock);
      expect(result).toMatchObject({
        id: 1,
        token: 'token',
        views: 1,
        isFolder: true,
        timesValid: 10,
        active: true,
      });
    });

    it('as user anonymus share should return share and increment view', async () => {
      shareFolder.views = 0;
      shareFolder.active = true;
      jest.spyOn(shareRepository, 'findByToken').mockResolvedValue(shareFolder);
      jest.spyOn(shareRepository, 'update').mockResolvedValue(true);
      const result = await service.getShareByToken(token, null);
      expect(result).toMatchObject({
        id: 1,
        token: 'token',
        views: 1,
        isFolder: true,
        timesValid: 10,
        active: true,
      });
    });

    it('as user share should return cannot view when share is unactive', async () => {
      shareFolder.active = false;
      jest.spyOn(shareRepository, 'findByToken').mockResolvedValue(shareFolder);
      await expect(service.getShareByToken(token, null)).rejects.toThrow(
        'cannot view this share',
      );
    });
    it('as user share should return share with same views and timesValid', async () => {
      shareFolder.views = 9;
      shareFolder.active = true;
      jest.spyOn(shareRepository, 'findByToken').mockResolvedValue(shareFolder);
      jest.spyOn(shareRepository, 'update').mockResolvedValue(true);
      const result = await service.getShareByToken(token, null);
      expect(result).toMatchObject({
        id: 1,
        token: 'token',
        views: 10,
        isFolder: true,
        timesValid: 10,
        active: false,
      });
    });
  });
});
