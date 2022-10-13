import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';
import { CryptoService } from '../../externals/crypto/crypto';
import { BridgeModule } from '../../externals/bridge/bridge.module';
import { File } from '../file/file.domain';
import {
  FileModel,
  FileRepository,
  SequelizeFileRepository,
} from '../file/file.repository';
import { FileUseCases } from '../file/file.usecase';
import { Folder } from '../folder/folder.domain';
import {
  FolderModel,
  FolderRepository,
  SequelizeFolderRepository,
} from '../folder/folder.repository';
import { User } from '../user/user.domain';
import { SequelizeUserRepository, UserModel } from '../user/user.repository';
import { Share } from './share.domain';
import {
  SequelizeShareRepository,
  ShareModel,
  ShareRepository,
} from './share.repository';
import { ShareUseCases } from './share.usecase';

describe('Share Use Cases', () => {
  let service: ShareUseCases;
  let fileRepository: FileRepository;
  let folderRepository: FolderRepository;
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
    userId: userOwnerMock.id,
    encryptVersion: '03-aes',
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
    encryptVersion: '03-aes',
    deleted: false,
    deletedAt: undefined,
    userId: userOwnerMock.id,
    modificationTime: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const shareFolder = Share.build({
    id: 1,
    token: 'token',
    mnemonic: 'test',
    bucket: 'test',
    isFolder: true,
    views: 0,
    timesValid: 10,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    userId: userOwnerMock.id,
    fileId: null,
    fileSize: BigInt(0),
    folderId: 1324182714,
    code: '',
    fileToken: null,
  });
  const shareFile = Share.build({
    id: 1,
    token: 'token',
    mnemonic: 'test',
    bucket: 'test',
    isFolder: false,
    views: 0,
    timesValid: 10,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    userId: userOwnerMock.id,
    fileId: 1385039091,
    fileSize: BigInt(59150675),
    folderId: null,
    code: '',
    fileToken: 'myhXXVtZgroitppajozT',
  });
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [BridgeModule],
      providers: [
        ShareUseCases,
        FileUseCases,
        SequelizeShareRepository,
        SequelizeFileRepository,
        SequelizeFolderRepository,
        SequelizeUserRepository,
        ConfigService,
        CryptoService,
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
    fileRepository = module.get<FileRepository>(SequelizeFileRepository);
    folderRepository = module.get<FolderRepository>(SequelizeFolderRepository);
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
            item: mockFolder, // TODO: should be undefined?
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
      jest
        .spyOn(folderRepository, 'findById')
        .mockResolvedValueOnce(mockFolder);
      jest.spyOn(shareRepository, 'findByToken').mockResolvedValue(shareFolder);

      const result = await service.getShareByToken(token);

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
      jest
        .spyOn(folderRepository, 'findById')
        .mockResolvedValueOnce(mockFolder);
      jest.spyOn(shareRepository, 'findByToken').mockResolvedValue(shareFolder);
      jest.spyOn(shareRepository, 'update').mockResolvedValue(undefined);

      const result = await service.getShareByToken(token);

      expect(result).toMatchObject({
        id: 1,
        token: 'token',
        views: 0,
        isFolder: true,
        timesValid: 10,
        active: true,
      });
    });

    it('as user anonymus share should return share and increment view', async () => {
      shareFolder.views = 0;
      shareFolder.active = true;
      jest
        .spyOn(folderRepository, 'findById')
        .mockResolvedValueOnce(mockFolder);
      jest.spyOn(shareRepository, 'findByToken').mockResolvedValue(shareFolder);
      jest.spyOn(shareRepository, 'update').mockResolvedValue(undefined);

      const result = await service.getShareByToken(token, null);

      expect(result).toMatchObject({
        id: 1,
        token: 'token',
        views: 0,
        isFolder: true,
        timesValid: 10,
        active: true,
      });
    });

    it('as user share should return cannot view when share is unactive', async () => {
      shareFolder.active = false;
      jest.spyOn(shareRepository, 'findByToken').mockResolvedValue(shareFolder);

      await expect(service.getShareByToken(token, null)).rejects.toThrow(
        new NotFoundException('Share expired'),
      );
    });

    it('as user share should return share with same views and timesValid', async () => {
      shareFolder.views = 9;
      shareFolder.active = true;
      jest
        .spyOn(folderRepository, 'findById')
        .mockResolvedValueOnce(mockFolder);
      jest.spyOn(shareRepository, 'findByToken').mockResolvedValue(shareFolder);
      jest.spyOn(shareRepository, 'update').mockResolvedValue(undefined);

      const result = await service.getShareByToken(token, null);

      expect(result).toMatchObject({
        id: 1,
        token: 'token',
        views: 9,
        isFolder: true,
        timesValid: 10,
        active: true,
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
      jest.spyOn(shareRepository, 'update').mockResolvedValue(undefined);
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
      jest.spyOn(shareRepository, 'update').mockResolvedValue(undefined);
      await expect(
        service.updateShareById(1, userMock, {
          timesValid: 20,
          active: true,
        }),
      ).rejects.toThrow('You are not owner of this share');
    });
  });

  describe('delete share by id', () => {
    it('should return share deleted', async () => {
      jest.spyOn(shareRepository, 'findById').mockResolvedValue(shareFolder);
      jest.spyOn(shareRepository, 'deleteById').mockResolvedValue(undefined);
      const result = await service.deleteShareById(1, userOwnerMock);
      expect(result).toBe(true);
    });

    it('should return not owner', async () => {
      jest.spyOn(shareRepository, 'findById').mockResolvedValue(shareFolder);
      await expect(service.deleteShareById(1, userMock)).rejects.toThrow(
        'You are not owner of this share',
      );
    });
  });

  describe('create share file', () => {
    it('should return share pre exist', async () => {
      const fildeId = 184578462;
      jest.spyOn(fileRepository, 'findOne').mockResolvedValue(mockFile);
      jest
        .spyOn(shareRepository, 'findByFileIdAndUser')
        .mockResolvedValue(shareFile);
      jest.spyOn(shareRepository, 'create').mockResolvedValue(undefined);

      const result = await service.createShareFile(fildeId, userOwnerMock, {
        timesValid: 20,
        encryptionKey: 'key',
        encryptedCode: 'code',
        itemToken: 'token',
        bucket: 'bucket',
        encryptedMnemonic: '',
      });

      expect(fileRepository.findOne).toHaveBeenNthCalledWith(
        1,
        fildeId,
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
      const fileId = 3898604647;
      jest.spyOn(fileRepository, 'findOne').mockResolvedValue(mockFile);
      jest
        .spyOn(shareRepository, 'findByFileIdAndUser')
        .mockResolvedValue(null);
      jest.spyOn(shareRepository, 'create').mockResolvedValue(undefined);

      const result = await service.createShareFile(fileId, userOwnerMock, {
        timesValid: 20,
        encryptionKey: 'key',
        encryptedCode: 'code',
        itemToken: 'token',
        bucket: 'bucket',
        encryptedMnemonic: '',
      });

      expect(fileRepository.findOne).toHaveBeenNthCalledWith(
        1,
        fileId,
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
      jest.spyOn(folderRepository, 'findById').mockResolvedValue(mockFolder);
      jest
        .spyOn(shareRepository, 'findByFolderIdAndUser')
        .mockResolvedValue(shareFolder);
      jest.spyOn(shareRepository, 'create').mockResolvedValue(undefined);
      const result = await service.createShareFolder(1, userOwnerMock, {
        timesValid: 20,
        encryptionKey: 'key',
        encryptedCode: 'code',
        itemToken: 'token',
        bucket: 'bucket',
        encryptedMnemonic: '',
      });
      expect(folderRepository.findById).toHaveBeenNthCalledWith(1, 1);
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
      jest.spyOn(folderRepository, 'findById').mockResolvedValue(mockFolder);
      jest
        .spyOn(shareRepository, 'findByFolderIdAndUser')
        .mockResolvedValue(null);
      jest.spyOn(shareRepository, 'create').mockResolvedValue(undefined);
      const result = await service.createShareFolder(1, userOwnerMock, {
        timesValid: 20,
        encryptionKey: 'key',
        itemToken: 'token',
        encryptedCode: 'code',
        bucket: 'bucket',
        encryptedMnemonic: '',
      });
      expect(folderRepository.findById).toHaveBeenNthCalledWith(1, 1);
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

  describe('delete share by fileId', () => {
    it('should delete the share if its from the user', async () => {
      jest.spyOn(shareRepository, 'deleteById').mockResolvedValueOnce();
      jest
        .spyOn(shareRepository, 'findByFileIdAndUser')
        .mockResolvedValueOnce(shareFile);

      await service.deleteFileShare(885045478, userOwnerMock);

      expect(shareRepository.findByFileIdAndUser).toBeCalled();
      expect(shareRepository.deleteById).toBeCalled();
    });

    it('should not fail if there is no share its not from the user', async () => {
      jest.spyOn(shareRepository, 'deleteById');
      jest.spyOn(shareRepository, 'findByFileIdAndUser').mockResolvedValueOnce({
        user: { id: userMock.id + 1 },
      } as unknown as Share);

      await service.deleteFileShare(885045478, userMock).catch((error) => {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.message).toBe(`You are not owner of this share`);
      });

      expect(shareRepository.findByFileIdAndUser).toBeCalled();
      expect(shareRepository.deleteById).toBeCalledTimes(0);
    });

    it('should not fail if there is no share for the file', async () => {
      jest.spyOn(shareRepository, 'deleteById');
      jest
        .spyOn(shareRepository, 'findByFileIdAndUser')
        .mockResolvedValueOnce(null);

      await service.deleteFileShare(885045478, userMock);

      expect(shareRepository.findByFileIdAndUser).toBeCalled();
      expect(shareRepository.deleteById).toBeCalledTimes(0);
    });
  });
});
