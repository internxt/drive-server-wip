import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { FolderUseCases } from './folder.usecase';
import {
  SequelizeFolderRepository,
  FolderRepository,
} from './folder.repository';
import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { v4 } from 'uuid';
import { Folder, FolderAttributes, FolderOptions } from './folder.domain';
import { BridgeModule } from '../../externals/bridge/bridge.module';
import { CryptoModule } from '../../externals/crypto/crypto.module';
import { CryptoService } from '../../externals/crypto/crypto.service';
import { User } from '../user/user.domain';
import { newFolder } from '../../../test/fixtures';
import { CalculateFolderSizeTimeoutException } from './exception/calculate-folder-size-timeout.exception';

const folderId = 4;
describe('FolderUseCases', () => {
  let service: FolderUseCases;
  let folderRepository: FolderRepository;
  let cryptoService: CryptoService;

  const userMocked = User.build({
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
    uuid: v4(),
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
    lastPasswordChangedAt: new Date(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [BridgeModule, CryptoModule],
      providers: [FolderUseCases],
    })
      .useMocker(() => createMock())
      .compile();

    service = module.get<FolderUseCases>(FolderUseCases);
    folderRepository = module.get<FolderRepository>(SequelizeFolderRepository);
    cryptoService = module.get<CryptoService>(CryptoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('move folder to trash use case', () => {
    it('calls moveFolderToTrash and return file', async () => {
      const mockFolder = Folder.build({
        id: 1,
        parentId: null,
        parentUuid: null,
        name: 'name',
        bucket: 'bucket',
        userId: 1,
        encryptVersion: '03-aes',
        deleted: true,
        deletedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        uuid: '',
        plainName: '',
        removed: false,
        removedAt: null,
      });
      jest
        .spyOn(folderRepository, 'updateByFolderId')
        .mockResolvedValue(mockFolder);
      const result = await service.moveFolderToTrash(folderId);
      expect(result).toEqual(mockFolder);
    });

    it('throws an error if the folder is not found', async () => {
      jest
        .spyOn(folderRepository, 'updateByFolderId')
        .mockRejectedValue(new NotFoundException());
      expect(service.moveFolderToTrash(folderId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('get folder use case', () => {
    it('calls getFolder and return folder', async () => {
      const mockFolder = Folder.build({
        id: 1,
        parentId: null,
        parentUuid: null,
        name: 'name',
        bucket: 'bucket',
        userId: 1,
        encryptVersion: '03-aes',
        deleted: true,
        deletedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        user: null,
        parent: null,
        uuid: '',
        plainName: '',
        removed: false,
        removedAt: null,
      });
      jest
        .spyOn(folderRepository, 'findById')
        .mockResolvedValueOnce(mockFolder);
      jest
        .spyOn(cryptoService, 'decryptName')
        .mockResolvedValueOnce('a descrypt name' as never);

      const findDeletedFolders: FolderOptions['deleted'] = false;
      const result = await service.getFolder(folderId, {
        deleted: findDeletedFolders,
      });
      expect(result).toMatchObject({
        id: 1,
        bucket: 'bucket',
        userId: 1,
        encryptVersion: '03-aes',
        deleted: true,
        parent: null,
      });
      expect(folderRepository.findById).toHaveBeenNthCalledWith(
        1,
        folderId,
        findDeletedFolders,
      );
    });
  });

  describe('getChildrenFoldersToUser', () => {
    it('calls getChildrenFoldersToUser and return empty folders', async () => {
      const mockFolders = [];
      jest
        .spyOn(folderRepository, 'findAllByParentIdAndUserId')
        .mockResolvedValue(mockFolders);
      const result = await service.getChildrenFoldersToUser(
        folderId,
        userMocked.id,
      );
      expect(result).toEqual(mockFolders);
      expect(
        folderRepository.findAllByParentIdAndUserId,
      ).toHaveBeenNthCalledWith(1, folderId, userMocked.id, false);
    });

    it('calls getChildrenFoldersToUser and return folders', async () => {
      const nameEncrypted =
        'ONzgORtJ77qI28jDnr+GjwJn6xELsAEqsn3FKlKNYbHR7Z129AD/WOMkAChEKx6rm7hOER2drdmXmC296dvSXtE5y5os0XCS554YYc+dcCMIkot/v6Wu6rlBC5MPlngR+CkmvA==';
      const mockFolders = [
        Folder.build({
          id: 4,
          parentId: 1,
          parentUuid: v4(),
          name: nameEncrypted,
          bucket: 'bucket',
          userId: 1,
          encryptVersion: '03-aes',
          deleted: true,
          deletedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          uuid: '',
          plainName: '',
          removed: false,
          removedAt: null,
        }),
      ];
      jest
        .spyOn(folderRepository, 'findAllByParentIdAndUserId')
        .mockResolvedValue(mockFolders);
      const result = await service.getChildrenFoldersToUser(
        folderId,
        userMocked.id,
      );
      expect(result).toMatchObject([
        {
          id: 4,
          parentId: 1,
          name: nameEncrypted,
          bucket: 'bucket',
          userId: 1,
          encryptVersion: '03-aes',
          deleted: true,
        },
      ]);
      expect(
        folderRepository.findAllByParentIdAndUserId,
      ).toHaveBeenNthCalledWith(1, folderId, userMocked.id, false);
    });
  });

  describe('delete folder use case', () => {
    it('should be able to delete a trashed folder', async () => {
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
        lastPasswordChangedAt: new Date(),
      });
      const folderId = 2713105696;
      const folder = Folder.build({
        id: folderId,
        parentId: 3388762609,
        parentUuid: v4(),
        name: 'name',
        bucket: 'bucket',
        userId: 1,
        encryptVersion: '03-aes',
        deleted: true,
        deletedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        user: userOwnerMock,
        parent: null,
        uuid: '',
        plainName: '',
        removed: false,
        removedAt: null,
      });

      jest
        .spyOn(folderRepository, 'deleteById')
        .mockImplementationOnce(() => Promise.resolve());

      await service.deleteFolderPermanently(folder, userOwnerMock);

      expect(folderRepository.deleteById).toHaveBeenCalledWith(folderId);
    });

    it('should fail when the folder trying to delete has not been trashed', async () => {
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
        lastPasswordChangedAt: new Date(),
      });
      const folderId = 2713105696;
      const folder = Folder.build({
        id: folderId,
        parentId: 3388762609,
        parentUuid: v4(),
        name: 'name',
        bucket: 'bucket',
        userId: 1,
        encryptVersion: '03-aes',
        deleted: false,
        deletedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        user: userOwnerMock,
        parent: null,
        uuid: '',
        plainName: '',
        removed: false,
        removedAt: null,
      });

      jest
        .spyOn(folderRepository, 'deleteById')
        .mockImplementationOnce(() => Promise.resolve());

      expect(
        service.deleteFolderPermanently(folder, userOwnerMock),
      ).rejects.toThrow(
        new UnprocessableEntityException(
          `folder with id ${folderId} cannot be permanently deleted`,
        ),
      );
      expect(folderRepository.deleteById).toHaveBeenCalledTimes(0);
    });

    it('should fail when the folder trying to delete is a root folder', async () => {
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
        lastPasswordChangedAt: new Date(),
      });
      const folderId = 2713105696;
      const folder = Folder.build({
        id: folderId,
        parentId: null,
        parentUuid: null,
        name: 'name',
        bucket: 'bucket',
        userId: 1,
        encryptVersion: '03-aes',
        deleted: false,
        deletedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        user: userOwnerMock,
        parent: null,
        uuid: '',
        plainName: '',
        removed: false,
        removedAt: null,
      });

      jest
        .spyOn(folderRepository, 'deleteById')
        .mockImplementationOnce(() => Promise.resolve());

      expect(
        service.deleteFolderPermanently(folder, userOwnerMock),
      ).rejects.toThrow(
        new UnprocessableEntityException(
          `folder with id ${folderId} is a root folder`,
        ),
      );
      expect(folderRepository.deleteById).toHaveBeenCalledTimes(0);
    });
  });

  describe('delete Orphaned folders', () => {
    const userId = 3135417944;
    it('should delete orphan folders until there are none', async () => {
      jest
        .spyOn(folderRepository, 'clearOrphansFolders')
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(39)
        .mockResolvedValueOnce(4)
        .mockResolvedValueOnce(0);

      jest.spyOn(service, 'deleteOrphansFolders');

      await service.deleteOrphansFolders(userId);

      expect(service.deleteOrphansFolders).toBeCalledTimes(4);
    });

    it('should avoid recursion if not needed', async () => {
      jest
        .spyOn(folderRepository, 'clearOrphansFolders')
        .mockResolvedValueOnce(0);

      jest.spyOn(service, 'deleteOrphansFolders');

      await service.deleteOrphansFolders(userId);

      expect(service.deleteOrphansFolders).toBeCalledTimes(1);
    });
  });

  describe('decrypt folder name', () => {
    const folderAtributes: FolderAttributes = {
      id: 1,
      parentId: null,
      parentUuid: null,
      parent: null,
      name: 'name',
      bucket: 'bucket',
      userId: 1,
      encryptVersion: '03-aes',
      deleted: true,
      deletedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      uuid: '',
      plainName: 'name',
      removed: false,
      removedAt: null,
    };

    it('returns folder json data with the name decrypted', () => {
      const parentId = 3385750628;

      const encriptedName = cryptoService.encryptName(
        folderAtributes['name'],
        parentId,
      );

      const folder = Folder.build({
        ...folderAtributes,
        name: encriptedName,
        parentId,
      });

      const result = service.decryptFolderName(folder);

      const expectedResult = {
        ...folderAtributes,
        size: 0,
      };
      delete expectedResult.parentId;
      delete expectedResult.parentUuid;

      expect(result).toStrictEqual({ ...expectedResult, sharings: undefined });
    });

    it('fails when the folder name is not encrypted', () => {
      const name = 'not encrypted name';
      const parentId = 2192829271;

      const folder = Folder.build({ ...folderAtributes, name, parentId });

      try {
        service.decryptFolderName(folder);
      } catch (err: any) {
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe('Unable to decrypt folder name');
      }
    });
  });

  describe('get folder size', () => {
    const folder = newFolder();

    it('When the folder size is requested to be calculated, then it works', async () => {
      const mockSize = 123456789;

      jest
        .spyOn(folderRepository, 'calculateFolderSize')
        .mockResolvedValueOnce(mockSize);

      const result = await service.getFolderSizeByUuid(folder.uuid);

      expect(result).toBe(mockSize);
      expect(folderRepository.calculateFolderSize).toHaveBeenCalledTimes(1);
      expect(folderRepository.calculateFolderSize).toHaveBeenCalledWith(
        folder.uuid,
      );
    });

    it('When the folder size times out, then throw an exception', async () => {
      jest
        .spyOn(folderRepository, 'calculateFolderSize')
        .mockRejectedValueOnce(new CalculateFolderSizeTimeoutException());

      await expect(service.getFolderSizeByUuid(folder.uuid)).rejects.toThrow(
        CalculateFolderSizeTimeoutException,
      );
    });
  });

  describe('move folder', () => {
    const folder = newFolder({ attributes: { userId: userMocked.id } });
    const destinationFolder = newFolder({
      attributes: { userId: userMocked.id },
    });

    it('When folder is moved, then the folder is returned with its updated properties', async () => {
      const expectedFolder = newFolder({
        attributes: {
          ...folder,
          name: 'newencrypted-' + folder.name,
          parentUuid: destinationFolder.uuid,
          parentId: destinationFolder.parentId,
        },
      });

      jest.spyOn(folderRepository, 'findByUuid').mockResolvedValueOnce(folder);
      jest
        .spyOn(folderRepository, 'findByUuid')
        .mockResolvedValueOnce(destinationFolder);

      jest
        .spyOn(cryptoService, 'decryptName')
        .mockReturnValueOnce(folder.plainName);

      jest
        .spyOn(cryptoService, 'encryptName')
        .mockReturnValueOnce(expectedFolder.name);

      jest
        .spyOn(folderRepository, 'findByNameAndParentUuid')
        .mockResolvedValueOnce(null);

      jest
        .spyOn(folderRepository, 'updateByFolderId')
        .mockResolvedValueOnce(expectedFolder);

      const result = await service.moveFolder(
        userMocked,
        folder.uuid,
        destinationFolder.uuid,
      );

      expect(result).toEqual(expectedFolder);
      expect(folderRepository.updateByFolderId).toHaveBeenCalledTimes(1);
      expect(folderRepository.updateByFolderId).toHaveBeenCalledWith(
        folder.id,
        {
          parentId: destinationFolder.id,
          parentUuid: destinationFolder.uuid,
          name: expectedFolder.name,
          deleted: false,
          deletedAt: null,
        },
      );
    });

    it('When folder is moved from/to a non-existent folder, then it should throw a not found error', () => {
      jest.spyOn(folderRepository, 'findByUuid').mockResolvedValueOnce(null);
      expect(
        service.moveFolder(userMocked, folder.uuid, destinationFolder.uuid),
      ).rejects.toThrow(NotFoundException);

      jest.spyOn(folderRepository, 'findByUuid').mockResolvedValueOnce(folder);
      jest.spyOn(folderRepository, 'findByUuid').mockResolvedValueOnce(null);
      expect(
        service.moveFolder(userMocked, folder.uuid, destinationFolder.uuid),
      ).rejects.toThrow(NotFoundException);
    });

    it('When folder is moved to a folder that has been already moved to, then it should throw a conflict error', () => {
      jest.spyOn(folderRepository, 'findByUuid').mockResolvedValueOnce(folder);
      jest
        .spyOn(folderRepository, 'findByUuid')
        .mockResolvedValueOnce(destinationFolder);
      jest
        .spyOn(cryptoService, 'decryptName')
        .mockReturnValueOnce(folder.plainName);
      jest.spyOn(cryptoService, 'encryptName').mockReturnValueOnce(folder.name);
      jest
        .spyOn(folderRepository, 'findByNameAndParentUuid')
        .mockResolvedValueOnce(folder);

      expect(
        service.moveFolder(userMocked, folder.uuid, destinationFolder.uuid),
      ).rejects.toThrow(
        `Folder ${folder.uuid} was already moved to that location`,
      );
    });

    it('When folder is moved to a folder that has already a folder with the same name, then it should throw a conflict error', () => {
      const conflictFolder = newFolder({
        attributes: {
          ...folder,
          uuid: v4(),
        },
      });
      jest.spyOn(folderRepository, 'findByUuid').mockResolvedValueOnce(folder);
      jest
        .spyOn(folderRepository, 'findByUuid')
        .mockResolvedValueOnce(destinationFolder);
      jest
        .spyOn(cryptoService, 'decryptName')
        .mockReturnValueOnce(folder.plainName);
      jest.spyOn(cryptoService, 'encryptName').mockReturnValueOnce(folder.name);
      jest
        .spyOn(folderRepository, 'findByNameAndParentUuid')
        .mockResolvedValueOnce(conflictFolder);

      expect(
        service.moveFolder(userMocked, folder.uuid, destinationFolder.uuid),
      ).rejects.toThrow(
        'A folder with the same name already exists in destination folder',
      );
    });
  });
});
