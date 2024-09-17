import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { FolderUseCases } from './folder.usecase';
import {
  SequelizeFolderRepository,
  FolderRepository,
} from './folder.repository';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { v4 } from 'uuid';
import { Folder, FolderAttributes, FolderOptions } from './folder.domain';
import { BridgeModule } from '../../externals/bridge/bridge.module';
import { CryptoModule } from '../../externals/crypto/crypto.module';
import { CryptoService } from '../../externals/crypto/crypto.service';
import { User } from '../user/user.domain';
import {
  newFile,
  newFolder,
  newUser,
  newWorkspace,
} from '../../../test/fixtures';
import { CalculateFolderSizeTimeoutException } from './exception/calculate-folder-size-timeout.exception';
import { SharingService } from '../sharing/sharing.service';
import { InvalidParentFolderException } from './exception/invalid-parent-folder';
import { UpdateFolderMetaDto } from './dto/update-folder-meta.dto';
import { FileUseCases } from '../file/file.usecase';
import { FileStatus } from '../file/file.domain';

const folderId = 4;
const user = newUser();

describe('FolderUseCases', () => {
  let service: FolderUseCases;
  let folderRepository: FolderRepository;
  let cryptoService: CryptoService;
  let sharingService: SharingService;
  let fileUsecases: FileUseCases;

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
    lastPasswordChangedAt: new Date(),
    emailVerified: false,
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
    sharingService = module.get<SharingService>(SharingService);
    fileUsecases = module.get<FileUseCases>(FileUseCases);
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

  describe('move multiple folders to trash', () => {
    const rootFolderBucket = 'bucketRoot';
    const mockFolder = Folder.build({
      id: 1,
      parentId: null,
      parentUuid: null,
      name: 'name',
      bucket: rootFolderBucket,
      userId: 1,
      encryptVersion: '03-aes',
      deleted: true,
      deletedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      uuid: '2545feaf-4d6b-40d8-9bf8-550285268bd3',
      plainName: '',
      removed: false,
      removedAt: null,
    });

    it('When uuid and id are passed and there is a backup and drive folder, then backups and drive folders should be updated', async () => {
      const mockBackupFolder = Folder.build({
        id: 1,
        parentId: null,
        parentUuid: null,
        name: 'name',
        bucket: 'bucketIdforBackup',
        userId: 1,
        encryptVersion: '03-aes',
        deleted: true,
        deletedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        uuid: '656a3abb-36ab-47ee-8303-6e4198f2a32a',
        plainName: '',
        removed: false,
        removedAt: null,
      });

      jest
        .spyOn(service, 'getFoldersByIds')
        .mockResolvedValue([mockBackupFolder]);
      jest
        .spyOn(folderRepository, 'findUserFoldersByUuid')
        .mockResolvedValue([mockFolder]);
      jest.spyOn(service, 'getFolder').mockResolvedValue({
        bucket: rootFolderBucket,
      } as Folder);
      jest.spyOn(folderRepository, 'updateManyByFolderId');

      await service.moveFoldersToTrash(
        user,
        [mockBackupFolder.id],
        [mockFolder.uuid],
      );

      expect(folderRepository.updateManyByFolderId).toHaveBeenCalledTimes(2);
      expect(folderRepository.updateManyByFolderId).toHaveBeenCalledWith(
        [mockFolder.id],
        {
          deleted: true,
          deletedAt: expect.any(Date),
        },
      );
      expect(folderRepository.updateManyByFolderId).toHaveBeenCalledWith(
        [mockBackupFolder.id],
        {
          deleted: true,
          deletedAt: expect.any(Date),
          removed: true,
          removedAt: expect.any(Date),
        },
      );
      expect(sharingService.bulkRemoveSharings).toHaveBeenCalledWith(
        user,
        [mockBackupFolder.uuid, mockFolder.uuid],
        'folder',
      );
    });

    it('When only ids are passed, then only folders by id should be searched', async () => {
      jest.spyOn(service, 'getFoldersByIds').mockResolvedValue([mockFolder]);
      jest.spyOn(service, 'getFolder').mockResolvedValue({
        bucket: rootFolderBucket,
      } as Folder);
      jest.spyOn(folderRepository, 'findUserFoldersByUuid');
      jest.spyOn(service, 'getFoldersByIds');

      await service.moveFoldersToTrash(user, [mockFolder.id]);
      expect(folderRepository.findUserFoldersByUuid).not.toHaveBeenCalled();
      expect(service.getFoldersByIds).toHaveBeenCalledWith(user, [
        mockFolder.id,
      ]);
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
        lastPasswordChangedAt: new Date(),
        emailVerified: false,
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
        lastPasswordChangedAt: new Date(),
        emailVerified: false,
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
        lastPasswordChangedAt: new Date(),
        emailVerified: false,
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
        true,
      );
    });

    it('When the folder size is required without including trashed files, then it should request the size without trash', async () => {
      const mockSize = 123456789;

      jest
        .spyOn(folderRepository, 'calculateFolderSize')
        .mockResolvedValueOnce(mockSize);

      const result = await service.getFolderSizeByUuid(folder.uuid, false);

      expect(result).toBe(mockSize);
      expect(folderRepository.calculateFolderSize).toHaveBeenCalledTimes(1);
      expect(folderRepository.calculateFolderSize).toHaveBeenCalledWith(
        folder.uuid,
        false,
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
      const mockParentFolder = newFolder({
        attributes: { userId: userMocked.id, removed: false },
      });

      jest.spyOn(folderRepository, 'findOne').mockResolvedValueOnce(folder);
      jest
        .spyOn(folderRepository, 'findById')
        .mockResolvedValueOnce(mockParentFolder);
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

    it('When folder is moved but it is removed, then an error is thrown', async () => {
      const mockFolder = newFolder({
        attributes: { userId: userMocked.id, removed: true },
      });

      jest.spyOn(folderRepository, 'findOne').mockResolvedValueOnce(mockFolder);

      await expect(
        service.moveFolder(userMocked, folder.uuid, destinationFolder.uuid),
      ).rejects.toThrow(`Folder ${folder.uuid} can not be moved`);
    });

    it('When moved folder is not owned by user, then an error is thrown', async () => {
      const notOwnerUser = newUser();
      const mockFolder = newFolder({
        attributes: { userId: userMocked.id, removed: true },
      });

      jest.spyOn(folderRepository, 'findOne').mockResolvedValueOnce(mockFolder);

      await expect(
        service.moveFolder(notOwnerUser, folder.uuid, destinationFolder.uuid),
      ).rejects.toThrow(ForbiddenException);
    });

    it('When folder is moved but its parent folder is removed, then an error is thrown', async () => {
      const mockParentFolder = newFolder({
        attributes: { userId: userMocked.id, removed: true },
      });

      jest.spyOn(folderRepository, 'findOne').mockResolvedValueOnce(folder);
      jest
        .spyOn(folderRepository, 'findById')
        .mockResolvedValueOnce(mockParentFolder);

      await expect(
        service.moveFolder(userMocked, folder.uuid, destinationFolder.uuid),
      ).rejects.toThrow(`Folder ${folder.uuid} can not be moved`);
    });

    it('When folder is moved but the destination folder is removed, then an error is thrown', async () => {
      const mockParentFolder = newFolder({
        attributes: { userId: userMocked.id, removed: false },
      });
      const mockDestinationFolder = newFolder({
        attributes: { userId: userMocked.id, removed: true },
      });

      jest.spyOn(folderRepository, 'findOne').mockResolvedValueOnce(folder);
      jest
        .spyOn(folderRepository, 'findById')
        .mockResolvedValueOnce(mockParentFolder);
      jest
        .spyOn(folderRepository, 'findByUuid')
        .mockResolvedValueOnce(mockDestinationFolder);

      await expect(
        service.moveFolder(userMocked, folder.uuid, destinationFolder.uuid),
      ).rejects.toThrow(`Folder can not be moved to ${destinationFolder.uuid}`);
    });

    it('When root folder is moved, then an error is thrown', async () => {
      const mockFolder = newFolder({
        attributes: {
          userId: userMocked.id,
          isRootFolder: () => true,
          isRoot: () => true,
        },
      });

      jest.spyOn(folderRepository, 'findOne').mockResolvedValueOnce(mockFolder);

      await expect(
        service.moveFolder(userMocked, folder.uuid, destinationFolder.uuid),
      ).rejects.toThrow('The root folder can not be moved');
    });

    it('When folder is moved from/to a non-existent folder, then it should throw a not found error', async () => {
      jest.spyOn(folderRepository, 'findOne').mockResolvedValueOnce(null);
      await expect(
        service.moveFolder(userMocked, folder.uuid, destinationFolder.uuid),
      ).rejects.toThrow(NotFoundException);

      jest.spyOn(folderRepository, 'findOne').mockResolvedValueOnce(folder);
      jest.spyOn(folderRepository, 'findByUuid').mockResolvedValueOnce(null);
      await expect(
        service.moveFolder(userMocked, folder.uuid, destinationFolder.uuid),
      ).rejects.toThrow(NotFoundException);
    });

    it('When folder is moved to a folder that has been already moved to, then it should throw a conflict error', async () => {
      jest.spyOn(folderRepository, 'findOne').mockResolvedValueOnce(folder);
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

      await expect(
        service.moveFolder(userMocked, folder.uuid, destinationFolder.uuid),
      ).rejects.toThrow(
        `Folder ${folder.uuid} was already moved to that location`,
      );
    });

    it('When folder is moved to a folder that has already a folder with the same name, then it should throw a conflict error', async () => {
      const conflictFolder = newFolder({
        attributes: {
          ...folder,
          uuid: v4(),
        },
      });
      jest.spyOn(folderRepository, 'findOne').mockResolvedValueOnce(folder);
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

      await expect(
        service.moveFolder(userMocked, folder.uuid, destinationFolder.uuid),
      ).rejects.toThrow(
        'A folder with the same name already exists in destination folder',
      );
    });
  });

  describe('renameFolder', () => {
    it('When the new folder name is invalid, then it should throw', async () => {
      const folder = newFolder();
      const emptyName = '';

      await expect(service.renameFolder(folder, emptyName)).rejects.toThrow(
        BadRequestException,
      );

      const invalidName = 'Invalid/Name';
      await expect(service.renameFolder(folder, invalidName)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('When a folder already exists with the new name, then it should throw', async () => {
      const folder = newFolder();
      const existingFolder = newFolder({
        attributes: { parentId: folder.parentId, plainName: 'New Name' },
      });

      jest
        .spyOn(folderRepository, 'findByNameAndParentUuid')
        .mockResolvedValue(existingFolder);

      await expect(service.renameFolder(folder, 'New Name')).rejects.toThrow(
        ConflictException,
      );
    });

    it('When the folder is renamed successfully, then it should return the updated folder', async () => {
      const folder = newFolder();
      const encryptedFolderName = 'encrypted-folder-name';
      const newFolderName = 'New Name';
      const updatedFolder = newFolder({
        attributes: {
          name: encryptedFolderName,
          plainName: newFolderName,
        },
      });

      jest
        .spyOn(cryptoService, 'encryptName')
        .mockReturnValueOnce(encryptedFolderName);
      jest
        .spyOn(folderRepository, 'findByNameAndParentUuid')
        .mockResolvedValue(null);
      jest
        .spyOn(folderRepository, 'updateByFolderId')
        .mockResolvedValueOnce(updatedFolder);

      const result = await service.renameFolder(folder, newFolderName);

      expect(result).toEqual(updatedFolder);
    });
  });

  describe('createFolder', () => {
    const folderName = 'New Folder';

    it('When the parent folder does not exist or it was not created by user, then it should throw', async () => {
      const parentFolder = newFolder();
      jest.spyOn(folderRepository, 'findOne').mockResolvedValueOnce(null);

      await expect(
        service.createFolder(userMocked, folderName, parentFolder.uuid),
      ).rejects.toThrow(InvalidParentFolderException);
    });

    it('When the folder name is invalid, then it should throw', async () => {
      const parentFolder = newFolder({ attributes: { userId: userMocked.id } });
      const notValidName = '';

      jest
        .spyOn(folderRepository, 'findOne')
        .mockResolvedValueOnce(parentFolder);

      await expect(
        service.createFolder(userMocked, notValidName, parentFolder.uuid),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createFolder(userMocked, 'Invalid/Name', parentFolder.uuid),
      ).rejects.toThrow(BadRequestException);
    });

    it('When the folder name already exists in the same location, then it should throw', async () => {
      const parentFolder = newFolder({ attributes: { userId: userMocked.id } });
      const existingFolder = newFolder({
        attributes: { parentId: parentFolder.id, plainName: folderName },
      });

      jest
        .spyOn(folderRepository, 'findOne')
        .mockResolvedValueOnce(parentFolder);
      jest
        .spyOn(folderRepository, 'findOne')
        .mockResolvedValueOnce(existingFolder);

      await expect(
        service.createFolder(userMocked, folderName, parentFolder.uuid),
      ).rejects.toThrow(BadRequestException);
    });

    it('When new folder is valid, then it should create and return the new folder successfully', async () => {
      const parentFolder = newFolder({ attributes: { userId: userMocked.id } });
      const encryptedFolderName = 'encrypted-folder-name';
      const newFolderCreated = newFolder({
        attributes: {
          userId: userMocked.id,
          parentId: parentFolder.id,
          parentUuid: parentFolder.uuid,
          name: encryptedFolderName,
          plainName: folderName,
        },
      });

      jest
        .spyOn(folderRepository, 'findOne')
        .mockResolvedValueOnce(parentFolder);
      jest.spyOn(folderRepository, 'findOne').mockResolvedValueOnce(null);

      jest
        .spyOn(cryptoService, 'encryptName')
        .mockReturnValueOnce(encryptedFolderName);

      jest
        .spyOn(folderRepository, 'createWithAttributes')
        .mockResolvedValueOnce(newFolderCreated);

      const result = await service.createFolder(
        userMocked,
        folderName,
        parentFolder.uuid,
      );

      expect(result).toEqual(newFolderCreated);
    });
  });

  describe('searchFoldersInFolder', () => {
    const user = newUser();
    const folderUuid = v4();
    const plainNames = ['Documents', 'Photos'];

    it('When the parent folder is not valid, then it should throw', async () => {
      jest.spyOn(folderRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.searchFoldersInFolder(user, folderUuid, { plainNames }),
      ).rejects.toThrow(BadRequestException);
    });

    it('When folders match the specified plainNames, then it should return the folders', async () => {
      const mockParentFolder = newFolder({
        attributes: { uuid: folderUuid, userId: user.id, plainName: 'Root' },
      });

      const mockFolders = [
        newFolder({ attributes: { plainName: 'Documents', userId: user.id } }),
        newFolder({ attributes: { plainName: 'Photos', userId: user.id } }),
      ];

      jest
        .spyOn(folderRepository, 'findOne')
        .mockResolvedValue(mockParentFolder);
      jest
        .spyOn(folderRepository, 'findByParent')
        .mockResolvedValue(mockFolders);

      const result = await service.searchFoldersInFolder(user, folderUuid, {
        plainNames,
      });

      expect(result).toEqual(mockFolders);
      expect(folderRepository.findByParent).toHaveBeenCalledWith(
        mockParentFolder.id,
        {
          plainName: plainNames,
          removed: false,
          deleted: false,
        },
      );
    });

    it('When no folders match the specified plainNames, then it should return an empty array', async () => {
      const mockParentFolder = newFolder({
        attributes: { uuid: folderUuid, userId: user.id, plainName: 'Root' },
      });

      jest
        .spyOn(folderRepository, 'findOne')
        .mockResolvedValue(mockParentFolder);
      jest.spyOn(folderRepository, 'findByParent').mockResolvedValue([]);

      const result = await service.searchFoldersInFolder(user, folderUuid, {
        plainNames,
      });

      expect(result).toEqual([]);
      expect(folderRepository.findByParent).toHaveBeenCalledWith(
        mockParentFolder.id,
        {
          plainName: plainNames,
          removed: false,
          deleted: false,
        },
      );
    });
  });

  describe('getFoldersInWorkspace', () => {
    const createdBy = userMocked.uuid;
    const workspace = newWorkspace();
    const parentFolderUuid = 'parent-folder-uuid';
    const decryptedFolder = newFolder({
      attributes: { plainName: 'decrypted-name' },
    });
    const encryptedFolder = newFolder({
      attributes: { plainName: null },
    });

    const findOptions = { limit: 20, offset: 0 };

    it('When folders are found with plainName, then they should be returned as-is', async () => {
      jest
        .spyOn(folderRepository, 'findAllCursorInWorkspace')
        .mockResolvedValueOnce([decryptedFolder]);

      const result = await service.getFoldersInWorkspace(
        createdBy,
        workspace.id,
        { parentUuid: parentFolderUuid },
        findOptions,
      );

      expect(result).toEqual([decryptedFolder]);
    });

    it('When folders are found without plainName, then decryptFolderName should be called', async () => {
      jest
        .spyOn(folderRepository, 'findAllCursorInWorkspace')
        .mockResolvedValueOnce([encryptedFolder]);
      const decryptFolderNameSpy = jest
        .spyOn(service, 'decryptFolderName')
        .mockReturnValueOnce(decryptedFolder);

      const result = await service.getFoldersInWorkspace(
        createdBy,
        workspace.id,
        { parentUuid: parentFolderUuid },
        findOptions,
      );

      expect(result).toEqual([decryptedFolder]);
      expect(decryptFolderNameSpy).toHaveBeenCalledWith(encryptedFolder);
    });

    it('When sort options are provided, then they should be used', async () => {
      const sortOptions = [['name', 'ASC']];

      jest
        .spyOn(folderRepository, 'findAllCursorInWorkspace')
        .mockResolvedValueOnce([decryptedFolder]);

      const result = await service.getFoldersInWorkspace(
        createdBy,
        workspace.id,
        { parentUuid: parentFolderUuid },
        { ...findOptions, sort: sortOptions as any },
      );

      expect(result).toEqual([decryptedFolder]);
      expect(folderRepository.findAllCursorInWorkspace).toHaveBeenCalledWith(
        createdBy,
        workspace.id,
        { parentUuid: parentFolderUuid },
        findOptions.limit,
        findOptions.offset,
        sortOptions,
      );
    });
  });

  describe('updateFolderMetaData', () => {
    const newFolderMetadata: UpdateFolderMetaDto = {
      plainName: 'new-folder-name',
    };

    it('When the folder is not owned by the user, then it should throw', async () => {
      const mockFolder = newFolder();
      jest.spyOn(folderRepository, 'findOne').mockResolvedValueOnce(mockFolder);

      await expect(
        service.updateFolderMetaData(
          userMocked,
          mockFolder.uuid,
          newFolderMetadata,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('When a folder with the same name already exists in the same location, then it should throw', async () => {
      const mockFolder = newFolder({ owner: userMocked });
      const folderWithSameName = newFolder({
        owner: userMocked,
        attributes: { name: mockFolder.name, plainName: mockFolder.plainName },
      });

      jest.spyOn(folderRepository, 'findOne').mockResolvedValueOnce(mockFolder);
      jest
        .spyOn(folderRepository, 'findOne')
        .mockResolvedValueOnce(folderWithSameName);

      await expect(
        service.updateFolderMetaData(
          userMocked,
          mockFolder.uuid,
          newFolderMetadata,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('When the folder metadata is updated successfully, then it should update and return the updated folder', async () => {
      const encryptedName = 'encrypted-new-folder-name';
      const mockFolder = newFolder({ owner: userMocked });
      const updatedFolder = newFolder({
        attributes: {
          name: encryptedName,
          plainName: newFolderMetadata.plainName,
        },
      });

      jest.spyOn(folderRepository, 'findOne').mockResolvedValueOnce(mockFolder);
      jest.spyOn(mockFolder, 'isOwnedBy').mockReturnValueOnce(true);
      jest.spyOn(folderRepository, 'findOne').mockResolvedValueOnce(null);
      jest.spyOn(cryptoService, 'encryptName').mockReturnValue(encryptedName);
      jest
        .spyOn(folderRepository, 'updateByFolderId')
        .mockResolvedValue(updatedFolder);

      const result = await service.updateFolderMetaData(
        userMocked,
        mockFolder.uuid,
        newFolderMetadata,
      );

      expect(folderRepository.updateByFolderId).toHaveBeenCalledWith(
        mockFolder.id,
        { plainName: newFolderMetadata.plainName, name: encryptedName },
      );
      expect(result).toEqual(updatedFolder);
    });
  });

  describe('getFolderTree', () => {
    const user = newUser();
    const rootFolder = newFolder({ attributes: { userId: user.id } });
    const childFolder = newFolder({
      attributes: { userId: user.id, parentId: rootFolder.id },
    });
    const fileInRootFolder = newFile({
      attributes: { folderId: rootFolder.id, userId: user.id },
    });

    it('When retrieving the folder tree, then it should return the folder tree structure', async () => {
      jest
        .spyOn(folderRepository, 'findByUuid')
        .mockResolvedValueOnce(rootFolder);
      jest
        .spyOn(fileUsecases, 'getFilesByFolderUuid')
        .mockResolvedValueOnce([fileInRootFolder]);
      jest
        .spyOn(folderRepository, 'findAllByParentUuid')
        .mockResolvedValueOnce([childFolder]);
      jest
        .spyOn(fileUsecases, 'getFilesByFolderUuid')
        .mockResolvedValueOnce([]);

      const result = await service.getFolderTree(user, rootFolder.uuid);

      expect(result).toEqual({
        ...rootFolder,
        files: [fileInRootFolder],
        children: [{ ...childFolder, files: [], children: [] }],
      });
    });

    it('When the root folder does not belong to the user, then it should throw an error', async () => {
      const anotherUser = newUser();
      jest
        .spyOn(folderRepository, 'findByUuid')
        .mockResolvedValueOnce(rootFolder);

      await expect(
        service.getFolderTree(anotherUser, rootFolder.uuid),
      ).rejects.toThrow(ForbiddenException);
    });

    it('When a folder has no children, then it should return the folder tree without children', async () => {
      jest
        .spyOn(folderRepository, 'findByUuid')
        .mockResolvedValueOnce(rootFolder);
      jest
        .spyOn(fileUsecases, 'getFilesByFolderUuid')
        .mockResolvedValueOnce([fileInRootFolder]);
      jest
        .spyOn(folderRepository, 'findAllByParentUuid')
        .mockResolvedValueOnce([]);

      const result = await service.getFolderTree(user, rootFolder.uuid);

      expect(result).toEqual({
        ...rootFolder,
        files: [fileInRootFolder],
        children: [],
      });
    });

    it('When a folder tree is requested including removed folders and files, then should look for trashed files', async () => {
      jest
        .spyOn(folderRepository, 'findByUuid')
        .mockResolvedValueOnce(rootFolder);
      jest
        .spyOn(fileUsecases, 'getFilesByFolderUuid')
        .mockResolvedValueOnce([fileInRootFolder]);
      jest
        .spyOn(folderRepository, 'findAllByParentUuid')
        .mockResolvedValueOnce([]);

      await service.getFolderTree(user, rootFolder.uuid, true);

      expect(fileUsecases.getFilesByFolderUuid).toHaveBeenCalledWith(
        rootFolder.uuid,
        FileStatus.TRASHED,
      );
    });

    it('When the root folder is not found, then it should throw', async () => {
      jest.spyOn(folderRepository, 'findByUuid').mockResolvedValueOnce(null);

      await expect(
        service.getFolderTree(user, rootFolder.uuid),
      ).rejects.toThrow(NotFoundException);
    });

    it('When folder has children folders, then it should return the folder with children', async () => {
      const loopedFolder = newFolder({
        attributes: { userId: user.id, parentId: rootFolder.id },
      });
      jest
        .spyOn(folderRepository, 'findByUuid')
        .mockResolvedValueOnce(rootFolder);
      jest
        .spyOn(fileUsecases, 'getFilesByFolderUuid')
        .mockResolvedValueOnce([fileInRootFolder]);
      jest
        .spyOn(folderRepository, 'findAllByParentUuid')
        .mockResolvedValueOnce([loopedFolder]);
      jest
        .spyOn(fileUsecases, 'getFilesByFolderUuid')
        .mockResolvedValueOnce([]);
      jest
        .spyOn(folderRepository, 'findAllByParentUuid')
        .mockResolvedValueOnce([rootFolder]);

      const result = await service.getFolderTree(user, rootFolder.uuid);

      expect(result).toEqual({
        ...rootFolder,
        files: [fileInRootFolder],
        children: [{ ...loopedFolder, files: [], children: [] }],
      });
    });
  });
});
