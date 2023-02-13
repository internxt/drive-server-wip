import { Test, TestingModule } from '@nestjs/testing';
import { FileUseCases } from './file.usecase';
import { SequelizeFileRepository, FileRepository } from './file.repository';
import {
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { File, FileAttributes } from './file.domain';
import { FileModel } from './file.repository';
import { User } from '../user/user.domain';
import { ShareUseCases } from '../share/share.usecase';
import { FolderUseCases } from '../folder/folder.usecase';
import {
  SequelizeShareRepository,
  ShareModel,
} from '../share/share.repository';
import { SequelizeFolderRepository } from '../folder/folder.repository';
import { FolderModel } from '../folder/folder.model';
import { SequelizeUserRepository } from '../user/user.repository';
import { UserModel } from '../user/user.model';
import { BridgeModule } from '../../externals/bridge/bridge.module';
import { BridgeService } from '../../externals/bridge/bridge.service';
import { CryptoService } from '../../externals/crypto/crypto.service';
import { CryptoModule } from '../../externals/crypto/crypto.module';
const fileId = '6295c99a241bb000083f1c6a';
const userId = 1;
const folderId = 4;
describe('FileUseCases', () => {
  let service: FileUseCases;
  let fileRepository: FileRepository;
  let shareUseCases: ShareUseCases;
  let bridgeService: BridgeService;
  let cryptoService: CryptoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [BridgeModule, CryptoModule],
      providers: [
        FileUseCases,
        SequelizeFileRepository,
        {
          provide: getModelToken(FileModel),
          useValue: jest.fn(),
        },
        ShareUseCases,
        SequelizeShareRepository,
        {
          provide: getModelToken(ShareModel),
          useValue: jest.fn(),
        },
        FolderUseCases,
        SequelizeFolderRepository,
        {
          provide: getModelToken(FolderModel),
          useValue: jest.fn(),
        },
        SequelizeUserRepository,
        {
          provide: getModelToken(UserModel),
          useValue: jest.fn(),
        },
        CryptoService,
      ],
    }).compile();

    service = module.get<FileUseCases>(FileUseCases);
    fileRepository = module.get<FileRepository>(SequelizeFileRepository);
    shareUseCases = module.get<ShareUseCases>(ShareUseCases);
    bridgeService = module.get<BridgeService>(BridgeService);
    cryptoService = module.get<CryptoService>(CryptoService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('move file to trash', () => {
    it('calls moveFileToTrash and return file', async () => {
      const mockFile = File.build({
        id: 1,
        fileId: '',
        name: '',
        type: '',
        size: null,
        bucket: '',
        folderId: 4,
        encryptVersion: '',
        deleted: false,
        deletedAt: new Date(),
        userId: 1,
        modificationTime: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      jest
        .spyOn(fileRepository, 'updateByFieldIdAndUserId')
        .mockResolvedValue(mockFile);
      const result = await service.moveFileToTrash(fileId, userId);
      expect(result).toEqual(mockFile);
    });

    it('throws an error if the file is not found', async () => {
      jest
        .spyOn(fileRepository, 'updateByFieldIdAndUserId')
        .mockRejectedValue(new NotFoundException());
      expect(service.moveFileToTrash(fileId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('move multiple files to trash', () => {
    it('calls moveFilesToTrash', async () => {
      const fileIds = [fileId];
      jest
        .spyOn(fileRepository, 'updateManyByFieldIdAndUserId')
        .mockImplementation(() => {
          return new Promise((resolve) => {
            resolve();
          });
        });
      const result = await service.moveFilesToTrash(fileIds, userId);
      expect(result).toEqual(undefined);
      expect(fileRepository.updateManyByFieldIdAndUserId).toHaveBeenCalledTimes(
        1,
      );
    });
  });

  describe('get folder by folderId and User Id', () => {
    it('calls getByFolderAndUser and return empty files', async () => {
      const mockFile = [];
      jest
        .spyOn(fileRepository, 'findAllByFolderIdAndUserId')
        .mockResolvedValue([]);
      const result = await service.getByFolderAndUser(folderId, userId, false);
      expect(result).toEqual(mockFile);
      expect(fileRepository.findAllByFolderIdAndUserId).toHaveBeenNthCalledWith(
        1,
        folderId,
        userId,
        false,
        undefined,
        undefined,
      );
    });

    it('calls getByFolderAndUser and return files', async () => {
      const mockFile = File.build({
        id: 1,
        fileId: '',
        name: '',
        type: '',
        size: null,
        bucket: '',
        folderId: 4,
        encryptVersion: '',
        deleted: false,
        deletedAt: new Date(),
        userId: 1,
        modificationTime: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      jest
        .spyOn(fileRepository, 'findAllByFolderIdAndUserId')
        .mockResolvedValue([mockFile]);
      const result = await service.getByFolderAndUser(folderId, userId, false);
      expect(result).toEqual([mockFile]);
      expect(fileRepository.findAllByFolderIdAndUserId).toHaveBeenNthCalledWith(
        1,
        folderId,
        userId,
        false,
        undefined,
        undefined,
      );
    });
  });

  describe('delete file use case', () => {
    const incrementalUserId = 15494;
    const userMock = User.build({
      id: incrementalUserId,
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

    it('should be able to delete a trashed file', async () => {
      const fileId = '6f10f732-59b1-525c-a2d0-ff538f687903';
      const file = {
        id: 1,
        fileId,
        deleted: true,
        userId: incrementalUserId,
      } as File;

      jest
        .spyOn(fileRepository, 'deleteByFileId')
        .mockImplementationOnce(() => Promise.resolve());

      jest
        .spyOn(shareUseCases, 'deleteFileShare')
        .mockImplementationOnce(() => Promise.resolve());

      jest
        .spyOn(bridgeService, 'deleteFile')
        .mockImplementationOnce(() => Promise.resolve());

      await service.deleteFilePermanently(file, userMock);

      expect(fileRepository.deleteByFileId).toHaveBeenCalledWith(fileId);
      expect(shareUseCases.deleteFileShare).toHaveBeenCalledTimes(1);
    });

    it('should fail when the folder trying to delete has not been trashed', async () => {
      const fileId = 2618494108;
      const file = File.build({
        id: fileId,
        fileId: '6f10f732-59b1-525c-a2d0-ff538f687903',
        name: '',
        type: '',
        size: null,
        bucket: '',
        folderId: 4,
        encryptVersion: '',
        deleted: false,
        deletedAt: new Date(),
        userId: incrementalUserId,
        modificationTime: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      jest.spyOn(fileRepository, 'deleteByFileId');

      expect(service.deleteFilePermanently(file, userMock)).rejects.toThrow(
        new UnprocessableEntityException(
          `file with id ${fileId} cannot be permanently deleted`,
        ),
      );
      expect(fileRepository.deleteByFileId).not.toHaveBeenCalled();
    });

    it('should fail when the folder trying to delete is not owned by the user', async () => {
      const file = {
        userId: incrementalUserId + 1,
        deleted: true,
      } as File;

      jest.spyOn(shareUseCases, 'deleteFileShare');
      jest.spyOn(bridgeService, 'deleteFile');
      jest.spyOn(fileRepository, 'deleteByFileId');

      expect(service.deleteFilePermanently(file, userMock)).rejects.toThrow(
        new ForbiddenException(`You are not owner of this share`),
      );
      expect(shareUseCases.deleteFileShare).not.toHaveBeenCalled();
      expect(bridgeService.deleteFile).not.toHaveBeenCalled();
      expect(fileRepository.deleteByFileId).not.toHaveBeenCalled();
    });

    it('should not delete a file from storage if delete shares fails', async () => {
      const fileId = 2618494108;
      const file = File.build({
        id: fileId,
        fileId: '6f10f732-59b1-525c-a2d0-ff538f687903',
        name: '',
        type: '',
        size: null,
        bucket: '',
        folderId: 4,
        encryptVersion: '',
        deleted: true,
        deletedAt: new Date(),
        userId: incrementalUserId,
        modificationTime: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const errorReason = new Error('reason');

      jest
        .spyOn(shareUseCases, 'deleteFileShare')
        .mockImplementationOnce(() => Promise.reject(errorReason));
      jest
        .spyOn(fileRepository, 'deleteByFileId')
        .mockImplementationOnce(() => Promise.resolve());
      jest.spyOn(bridgeService, 'deleteFile');

      await service.deleteFilePermanently(file, userMock).catch((err) => {
        expect(err).toBe(errorReason);
      });

      expect(bridgeService.deleteFile).not.toHaveBeenCalled();
      expect(fileRepository.deleteByFileId).not.toHaveBeenCalled();
    });

    it('should not delete a file from databse if could not be deleted from storage', async () => {
      const fileId = 2618494108;
      const file = File.build({
        id: fileId,
        fileId: '6f10f732-59b1-525c-a2d0-ff538f687903',
        name: '',
        type: '',
        size: null,
        bucket: '',
        folderId: 4,
        encryptVersion: '',
        deleted: true,
        deletedAt: new Date(),
        userId: incrementalUserId,
        modificationTime: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        user: userMock,
      });

      const errorReason = new Error('reason');

      jest
        .spyOn(fileRepository, 'deleteByFileId')
        .mockImplementationOnce(() => Promise.resolve());
      jest
        .spyOn(shareUseCases, 'deleteFileShare')
        .mockImplementationOnce(() => Promise.resolve());
      jest
        .spyOn(bridgeService, 'deleteFile')
        .mockImplementationOnce(() => Promise.reject(errorReason));

      await service.deleteFilePermanently(file, userMock).catch((err) => {
        expect(err).toBe(errorReason);
      });

      expect(fileRepository.deleteByFileId).not.toHaveBeenCalled();
    });
  });

  describe('decrypt file name', () => {
    const fileAttributes: FileAttributes = {
      id: 0,
      fileId: '4fda5d98-e5b4-56da-a4f2-000084ac0678',
      name: 'Verna Pope',
      type: 'type',
      size: BigInt(60),
      bucket: 'bucket',
      folderId,
      folder: null,
      encryptVersion: 'aes-2',
      deleted: false,
      deletedAt: new Date('2022-09-21T11:11:30.742Z'),
      userId: 3431709237,
      user: null,
      modificationTime: new Date('2022-09-21T11:11:30.742Z'),
      createdAt: new Date('2022-09-21T11:11:30.742Z'),
      updatedAt: new Date('2022-09-21T11:11:30.742Z'),
    };

    it('returns a file with the name decrypted', () => {
      const decyptedName = 'Myanmar';
      const folderId = 523;

      const encryptedName = cryptoService.encryptName(decyptedName, folderId);

      const file = File.build({
        ...fileAttributes,
        name: encryptedName,
        folderId,
      });

      const { user: _, ...expectedFiles } = fileAttributes;

      const result = service.decrypFileName(file);

      expect(result).toStrictEqual({
        ...expectedFiles,
        name: decyptedName,
        folderId,
      });
    });

    it('fails when name is not encrypted', () => {
      const decyptedName = 'not encrypted name';

      const file = File.build({
        ...fileAttributes,
        name: decyptedName,
      });

      try {
        service.decrypFileName(file);
      } catch (err: any) {
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe('Unable to decrypt file name');
      }
    });
  });
});
