import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';
import { File } from '../file/file.domain';
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
  let fileService: FileUseCases;
  let folderService: FolderUseCases;
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
  const mockFile = File.build({
    id: 1,
    fileId: 'fileId',
    name: 'File 1',
    type: 'png',
    size: null,
    bucket: 'bucket',
    folderId: 1,
    encryptVersion: '',
    deleted: false,
    deletedAt: undefined,
    userId: 1,
    modificationTime: new Date(),
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
  const shareFile = Share.build({
    id: 1,
    token: 'token',
    mnemonic: 'test',
    user: userOwnerMock,
    item: mockFile,
    encryptionKey: 'test',
    bucket: 'test',
    itemToken: 'token',
    isFolder: false,
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
    fileService = module.get<FileUseCases>(FileUseCases);
    folderService = module.get<FolderUseCases>(FolderUseCases);
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

  describe('get share by id', () => {
    it('should return share valid', async () => {
      shareFolder.views = 0;
      shareFolder.active = true;
      jest.spyOn(shareRepository, 'findById').mockResolvedValue(shareFolder);
      const result = await service.getShareById(1);
      expect(result).toMatchObject({
        id: 1,
        token: 'token',
        views: 0,
        isFolder: true,
        timesValid: 10,
        active: true,
      });
    });
    it('should return share invalid', async () => {
      jest.spyOn(shareRepository, 'findById').mockResolvedValue(null);
      const result = await service.getShareById(4);
      expect(result).toEqual(null);
    });
  });

  describe('update share by id', () => {
    it('should return share updated', async () => {
      jest.spyOn(shareRepository, 'findById').mockResolvedValue(shareFolder);
      jest.spyOn(shareRepository, 'update').mockResolvedValue(true);
      const result = await service.updateShareById(1, userOwnerMock, {
        timesValid: 20,
        active: true,
      });
      expect(result).toMatchObject({
        id: 1,
        token: 'token',
        views: 0,
        isFolder: true,
        timesValid: 20,
        active: true,
      });
    });

    it('should return not owner', async () => {
      jest.spyOn(shareRepository, 'findById').mockResolvedValue(shareFolder);
      jest.spyOn(shareRepository, 'update').mockResolvedValue(true);
      await expect(
        service.updateShareById(1, userMock, {
          timesValid: 20,
          active: true,
        }),
      ).rejects.toThrow('You are not owner of this share');
    });
  });

  describe('create share file', () => {
    it('should return share pre exist', async () => {
      jest.spyOn(fileService, 'getByFileIdAndUser').mockResolvedValue(mockFile);
      jest
        .spyOn(shareRepository, 'findByFileIdAndUser')
        .mockResolvedValue(shareFile);
      jest.spyOn(shareRepository, 'create').mockResolvedValue(undefined);
      const result = await service.createShareFile('fileId', userOwnerMock, {
        timesValid: 20,
        encryptionKey: 'key',
        itemToken: 'token',
        bucket: 'bucket',
        mnemonic: '',
      });
      expect(fileService.getByFileIdAndUser).toHaveBeenNthCalledWith(
        1,
        'fileId',
        userOwnerMock.id,
      );
      expect(shareRepository.create).toHaveBeenCalledTimes(0);
      expect(result).toMatchObject({
        item: {
          id: 1,
          token: 'token',
          views: 0,
          isFolder: false,
          timesValid: 10,
          active: true,
        },
        created: false,
      });
    });

    it('should return new share', async () => {
      jest.spyOn(fileService, 'getByFileIdAndUser').mockResolvedValue(mockFile);
      jest
        .spyOn(shareRepository, 'findByFileIdAndUser')
        .mockResolvedValue(null);
      jest.spyOn(shareRepository, 'create').mockResolvedValue(undefined);
      const result = await service.createShareFile('fileId', userOwnerMock, {
        timesValid: 20,
        encryptionKey: 'key',
        itemToken: 'token',
        bucket: 'bucket',
        mnemonic: '',
      });
      expect(fileService.getByFileIdAndUser).toHaveBeenNthCalledWith(
        1,
        'fileId',
        userOwnerMock.id,
      );
      expect(shareRepository.create).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        item: {
          id: 1,
          views: 0,
          isFolder: false,
          timesValid: 20,
          active: true,
        },
        created: true,
      });
    });
  });

  describe('create share folder', () => {
    it('should return share pre exist', async () => {
      shareFolder.timesValid = 10;
      shareFolder.active = true;
      jest.spyOn(folderService, 'getFolder').mockResolvedValue(mockFolder);
      jest
        .spyOn(shareRepository, 'findByFolderIdAndUser')
        .mockResolvedValue(shareFolder);
      jest.spyOn(shareRepository, 'create').mockResolvedValue(undefined);
      const result = await service.createShareFolder(1, userOwnerMock, {
        timesValid: 20,
        encryptionKey: 'key',
        itemToken: 'token',
        bucket: 'bucket',
        mnemonic: '',
      });
      expect(folderService.getFolder).toHaveBeenNthCalledWith(1, 1);
      expect(shareRepository.create).toHaveBeenCalledTimes(0);
      expect(result).toMatchObject({
        item: {
          id: 1,
          token: 'token',
          views: 0,
          isFolder: true,
          timesValid: 10,
          active: true,
        },
        created: false,
      });
    });

    it('should return new share', async () => {
      shareFolder.timesValid = 10;
      shareFolder.active = true;
      jest.spyOn(folderService, 'getFolder').mockResolvedValue(mockFolder);
      jest
        .spyOn(shareRepository, 'findByFolderIdAndUser')
        .mockResolvedValue(null);
      jest.spyOn(shareRepository, 'create').mockResolvedValue(undefined);
      const result = await service.createShareFolder(1, userOwnerMock, {
        timesValid: 20,
        encryptionKey: 'key',
        itemToken: 'token',
        bucket: 'bucket',
        mnemonic: '',
      });
      expect(folderService.getFolder).toHaveBeenNthCalledWith(1, 1);
      expect(shareRepository.create).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        item: {
          id: 1,
          views: 0,
          isFolder: true,
          timesValid: 20,
          active: true,
        },
        created: true,
      });
    });
  });
});
