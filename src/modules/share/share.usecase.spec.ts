import {
  ForbiddenException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';
import { CryptoModule } from '../../externals/crypto/crypto.module';
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
import { FolderUseCases } from '../folder/folder.usecase';
import { User } from '../user/user.domain';
import { SequelizeUserRepository, UserModel } from '../user/user.repository';
import { UserUseCases } from '../user/user.usecase';
import { Share, ShareAttributes } from './share.domain';
import { SequelizeShareRepository, ShareModel } from './share.repository';
import { ShareUseCases } from './share.usecase';
import { CryptoService } from '../../externals/crypto/crypto.service';
import {
  FriendInvitationModel,
  SequelizeSharedWorkspaceRepository,
} from '../../shared-workspace/shared-workspace.repository';
import {
  ReferralModel,
  SequelizeReferralRepository,
} from '../user/referrals.repository';
import {
  SequelizeUserReferralsRepository,
  UserReferralModel,
} from '../user/user-referrals.repository';
import { PaymentsService } from '../../externals/payments/payments.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationService } from '../../externals/notifications/notification.service';

describe('Share Use Cases', () => {
  let service: ShareUseCases;
  let cryptoService: CryptoService;
  let fileRepository: FileRepository;
  let folderRepository: FolderRepository;
  let shareRepository: SequelizeShareRepository;

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
    userId: 1,
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
    fileId: 2096680966,
    fileSize: BigInt(1158803678),
    folderId: null,
    code: 'gTM8fN6nLGOZcGlXbEZG',
    fileToken: 'uQMfvAIMzmgvs4fmCCk6HUVoQWpInJ',
    hashedPassword: null,
  });

  shareFolder.item = mockFolder;

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
    userId: 0,
    fileId: null,
    fileSize: null,
    folderId: 3817750339,
    code: '9TmWSAAn1X5l7pXB2JTC',
    fileToken: '',
    hashedPassword: null,
  });

  shareFile.item = mockFile;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [BridgeModule, CryptoModule],
      providers: [
        ShareUseCases,
        FolderUseCases,
        UserUseCases,
        FileUseCases,
        SequelizeShareRepository,
        SequelizeFileRepository,
        SequelizeFolderRepository,
        SequelizeUserRepository,
        SequelizeSharedWorkspaceRepository,
        SequelizeReferralRepository,
        SequelizeUserReferralsRepository,
        PaymentsService,
        EventEmitter2,
        NotificationService,
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
        {
          provide: getModelToken(ReferralModel),
          useValue: jest.fn(),
        },
        {
          provide: getModelToken(UserReferralModel),
          useValue: jest.fn(),
        },
        {
          provide: getModelToken(FriendInvitationModel),
          useValue: jest.fn(),
        },
      ],
    }).compile();

    service = module.get<ShareUseCases>(ShareUseCases);
    shareRepository = module.get<SequelizeShareRepository>(
      SequelizeShareRepository,
    );
    fileRepository = module.get<FileRepository>(SequelizeFileRepository);
    folderRepository = module.get<FolderRepository>(SequelizeFolderRepository);
    cryptoService = module.get<CryptoService>(CryptoService);
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
            // item: mockFolder,
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
      const code = 'code';
      shareFolder.views = 0;
      shareFolder.active = true;
      jest.spyOn(shareRepository, 'findByToken').mockResolvedValue(shareFolder);
      jest.spyOn(folderRepository, 'findById').mockResolvedValue(mockFolder);

      const result = await service.getShareByToken(token, code);

      expect(result).toMatchObject({
        id: 1,
        token: 'token',
        views: 0,
        isFolder: true,
        timesValid: 10,
        active: true,
      });
    });
    it('as user not owner share should return share and NOT increment view', async () => {
      shareFolder.views = 0;
      shareFolder.active = true;
      jest.spyOn(shareRepository, 'findByToken').mockResolvedValue(shareFolder);
      jest.spyOn(shareRepository, 'update').mockResolvedValue(undefined);
      jest.spyOn(folderRepository, 'findById').mockResolvedValue(mockFolder);

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

    it('as user anonymus share should return share and NOT increment view', async () => {
      shareFolder.views = 0;
      shareFolder.active = true;
      jest.spyOn(shareRepository, 'findByToken').mockResolvedValue(shareFolder);
      jest.spyOn(shareRepository, 'update').mockResolvedValue(undefined);
      jest.spyOn(folderRepository, 'findById').mockResolvedValue(mockFolder);

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
    it('returns the share with the same views', async () => {
      shareFolder.views = 9;
      shareFolder.active = true;
      jest.spyOn(shareRepository, 'findByToken').mockResolvedValue(shareFolder);
      jest.spyOn(shareRepository, 'update').mockResolvedValue(undefined);
      jest
        .spyOn(folderRepository, 'findById')
        .mockResolvedValue(shareFolder.item as Folder);

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

      const userOwnerOfShare = {
        id: shareFolder.userId,
      } as User;

      const result = await service.updateShareById(1, userOwnerOfShare, {
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
      const result = await service.deleteShareById(
        shareFolder.id,
        userOwnerMock,
      );
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
      const fileId = 1831192863;
      jest.spyOn(fileRepository, 'findOne').mockResolvedValue(mockFile);
      jest
        .spyOn(shareRepository, 'findByFileIdAndUser')
        .mockResolvedValue(shareFile);
      jest.spyOn(shareRepository, 'create').mockResolvedValue(undefined);
      const result = await service.createShareFile(fileId, userOwnerMock, {
        timesValid: 20,
        encryptionKey: 'key',
        itemToken: 'token',
        bucket: 'bucket',
        encryptedPassword: null,
        encryptedMnemonic: 'encryptedMnemonic',
        encryptedCode: 'encryptedCode',
      });
      expect(fileRepository.findOne).toHaveBeenNthCalledWith(
        1,
        fileId,
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

    it('should return new file share', async () => {
      const fileId = 4087455352;
      jest.spyOn(fileRepository, 'findOne').mockResolvedValue(mockFile);
      jest
        .spyOn(shareRepository, 'findByFileIdAndUser')
        .mockResolvedValue(null);
      jest.spyOn(shareRepository, 'create').mockResolvedValue(undefined);

      const result = await service.createShareFile(fileId, userOwnerMock, {
        timesValid: 20,
        encryptionKey: 'key',
        itemToken: 'token',
        bucket: 'bucket',
        encryptedPassword: null,
        encryptedMnemonic: 'encryptedMnemonic',
        encryptedCode: 'encryptedCode',
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
        itemToken: 'token',
        bucket: 'bucket',
        encryptedPassword: null,
        encryptedMnemonic: 'encryptedMnemonic',
        encryptedCode: 'encryptedCode',
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

    it('should return new folder share', async () => {
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
        bucket: 'bucket',
        encryptedPassword: null,
        encryptedMnemonic: 'encryptedMnemonic',
        encryptedCode: 'encryptedCode',
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
      jest.spyOn(shareRepository, 'findByFileIdAndUser').mockResolvedValueOnce({
        userId: userMock.id,
      } as unknown as Share);

      await service.deleteFileShare(885045478, userMock);

      expect(shareRepository.findByFileIdAndUser).toBeCalled();
      expect(shareRepository.deleteById).toBeCalled();
    });

    it('should not fail if there is no share its not from the user', async () => {
      jest.spyOn(shareRepository, 'deleteById');
      jest.spyOn(shareRepository, 'findByFileIdAndUser').mockResolvedValueOnce({
        userId: userMock.id + 1,
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

  describe('unlock share', () => {
    const shareAttributes: ShareAttributes = {
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
      hashedPassword: null,
      userId: 2855169322,
      fileId: 1069089837,
      fileSize: BigInt(2319741820),
      folderId: 0,
      code: 'code',
      fileToken: 'fileToken',
    };
    const falsyPasswords = ['', null, undefined];

    it('unlocks the share with the correct password', () => {
      const hashedPassword = 'GM6rCHmvIuzetZWnDf50gPLPQmBXZl';
      const encryptedPassword = cryptoService.encryptText(hashedPassword);

      const share = Share.build({
        ...shareAttributes,
        hashedPassword,
      });

      service.unlockShare(share, encryptedPassword);
    });

    it.each(falsyPasswords)('unlocks if its not protected', (password) => {
      const share = Share.build(shareAttributes);

      service.unlockShare(share, password);
    });

    it.each(falsyPasswords)(
      'throws an exception when its protected and no password is provided',
      (password) => {
        const share = Share.build({
          ...shareAttributes,
          hashedPassword: 'password',
        });

        try {
          service.unlockShare(share, password);
        } catch (err: any) {
          expect(err).toBeInstanceOf(UnauthorizedException);
          expect(err.message).toBe('Share protected by password');
        }
      },
    );

    it('throws an error if the password is does not match', () => {
      const share = Share.build({
        ...shareAttributes,
        hashedPassword: 'FCxuprT4KhLMN4GkawEE',
      });

      try {
        service.unlockShare(share, 'random password');
      } catch (err: any) {
        expect(err).toBeInstanceOf(UnauthorizedException);
        expect(err.message).toBe('Invalid password for share');
      }
    });
  });
});
