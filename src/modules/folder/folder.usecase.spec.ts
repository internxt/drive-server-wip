import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { FolderUseCases, SortParamsFolder } from './folder.usecase';
import { SequelizeFolderRepository } from './folder.repository';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotAcceptableException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { v4 } from 'uuid';
import { Folder, FolderOptions } from './folder.domain';
import { FolderAttributes } from './folder.attributes';
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
import { UpdateFolderMetaDto } from './dto/update-folder-meta.dto';
import { FileUseCases } from '../file/file.usecase';
import { FileStatus } from '../file/file.domain';
import { TrashUseCases } from '../trash/trash.usecase';
import { TrashItemType } from '../trash/trash.attributes';
import { FeatureLimitService } from '../feature-limit/feature-limit.service';

const folderId = 4;
const user = newUser();

describe('FolderUseCases', () => {
  let service: FolderUseCases;
  let folderRepository: SequelizeFolderRepository;
  let cryptoService: CryptoService;
  let sharingService: SharingService;
  let fileUsecases: FileUseCases;
  let trashUsecases: TrashUseCases;
  let featureLimitService: FeatureLimitService;

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
    folderRepository = module.get<SequelizeFolderRepository>(
      SequelizeFolderRepository,
    );
    cryptoService = module.get<CryptoService>(CryptoService);
    sharingService = module.get<SharingService>(SharingService);
    fileUsecases = module.get<FileUseCases>(FileUseCases);
    trashUsecases = module.get<TrashUseCases>(TrashUseCases);
    featureLimitService = module.get<FeatureLimitService>(FeatureLimitService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('move folder to trash use case', () => {
    it('calls moveFolderToTrash and return file', async () => {
      const mockFolder = newFolder();
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
    const mockFolder = newFolder();

    it('When uuid and id are passed and there is a backup and drive folder, then backups and drive folders should be updated', async () => {
      const mockBackupFolder = newFolder({
        attributes: {
          id: 1,
          parentId: null,
          parentUuid: null,
          name: 'name',
          bucket: 'bucketIdforBackup',
          userId: 1,
          encryptVersion: '03-aes',
          deleted: true,
          plainName: '',
          removed: false,
          removedAt: null,
        },
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

    it('When you trash regular folders and backup folders, then only regular folders go to the trash bin', async () => {
      const rootFolderBucket = 'drive-bucket';
      const mockDriveFolder = newFolder({
        attributes: { bucket: rootFolderBucket, parentId: 1 },
      });
      const mockBackupFolder = newFolder({
        attributes: { bucket: 'backup-bucket', parentId: null },
      });

      jest
        .spyOn(service, 'getFoldersByIds')
        .mockResolvedValue([mockDriveFolder, mockBackupFolder]);
      jest
        .spyOn(service, 'getFolder')
        .mockResolvedValue({ bucket: rootFolderBucket } as Folder);
      jest.spyOn(trashUsecases, 'addItemsToTrash');

      await service.moveFoldersToTrash(
        user,
        [mockDriveFolder.id, mockBackupFolder.id],
        [],
        'free_individual',
      );

      expect(trashUsecases.addItemsToTrash).toHaveBeenCalledTimes(1);
      expect(trashUsecases.addItemsToTrash).toHaveBeenCalledWith(
        [mockDriveFolder.uuid],
        TrashItemType.Folder,
        'free_individual',
        user.id,
      );
    });

    it('When you trash only backup folders, then the trash bin is not updated', async () => {
      const rootFolderBucket = 'drive-bucket';
      const mockBackupFolder = newFolder({
        attributes: { bucket: 'backup-bucket', parentId: null },
      });
      const mockTier = { id: '1', label: 'free_individual' };

      jest
        .spyOn(service, 'getFoldersByIds')
        .mockResolvedValue([mockBackupFolder]);
      jest
        .spyOn(service, 'getFolder')
        .mockResolvedValue({ bucket: rootFolderBucket } as Folder);
      jest
        .spyOn(featureLimitService, 'getTier')
        .mockResolvedValueOnce(mockTier);
      jest.spyOn(trashUsecases, 'addItemsToTrash');

      await service.moveFoldersToTrash(user, [mockBackupFolder.id]);

      expect(trashUsecases.addItemsToTrash).not.toHaveBeenCalled();
    });

    it('When you trash folders, then the retention period is determined by the user tier', async () => {
      const rootFolderBucket = 'drive-bucket';
      const mockFolder = newFolder({
        attributes: { bucket: rootFolderBucket, parentId: 1 },
      });

      jest.spyOn(service, 'getFoldersByIds').mockResolvedValue([mockFolder]);
      jest
        .spyOn(service, 'getFolder')
        .mockResolvedValue({ bucket: rootFolderBucket } as Folder);
      jest.spyOn(trashUsecases, 'addItemsToTrash');

      await service.moveFoldersToTrash(
        user,
        [mockFolder.id],
        [],
        'essential_individual',
      );

      expect(trashUsecases.addItemsToTrash).toHaveBeenCalledWith(
        [mockFolder.uuid],
        TrashItemType.Folder,
        'essential_individual',
        user.id,
      );
    });
  });

  describe('get folder use case', () => {
    it('calls getFolder and return folder', async () => {
      const mockFolder = newFolder({
        attributes: {
          bucket: 'bucket',
          id: 1,
          parent: null,
          userId: 1,
          deleted: true,
        },
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
        newFolder({
          attributes: {
            name: nameEncrypted,
            bucket: 'bucket',
            parentId: 1,
            id: 4,
            deleted: true,
            userId: 1,
          },
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
    it('When called, then it should be able to delete folder', async () => {
      const userOwnerMock = newUser({ attributes: { id: 1 } });
      const folderId = 2713105696;
      const folder = newFolder({
        attributes: {
          id: folderId,
          parentId: 3388762609,
          name: 'name',
          bucket: 'bucket',
          userId: 1,
          encryptVersion: '03-aes',
          deleted: true,
          deletedAt: new Date(),
        },
      });

      jest
        .spyOn(folderRepository, 'deleteById')
        .mockImplementationOnce(() => Promise.resolve());

      await service.deleteFolderPermanently(folder, userOwnerMock);

      expect(folderRepository.deleteById).toHaveBeenCalledWith(folderId);
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

      expect(service.deleteOrphansFolders).toHaveBeenCalledTimes(4);
    });

    it('should avoid recursion if not needed', async () => {
      jest
        .spyOn(folderRepository, 'clearOrphansFolders')
        .mockResolvedValueOnce(0);

      jest.spyOn(service, 'deleteOrphansFolders');

      await service.deleteOrphansFolders(userId);

      expect(service.deleteOrphansFolders).toHaveBeenCalledTimes(1);
    });
  });

  describe('removeUserOrphanFolders', () => {
    it('When called, then it should mark folders as deleted and removed', async () => {
      jest.spyOn(folderRepository, 'updateBy');
      jest.spyOn(service, 'deleteOrphansFolders');

      await service.removeUserOrphanFolders(user);

      expect(folderRepository.updateBy).toHaveBeenCalledWith(
        { removed: true, deleted: true },
        { userId: user.id, parentId: null },
      );
    });
  });

  describe('decryptFolderName()', () => {
    it('When the name is encrypted, then the decrypting works', () => {
      const folder = newFolder();
      const encriptedName = cryptoService.encryptName(
        folder.plainName,
        folder.parentId,
      );
      folder.name = encriptedName;

      const result = service.decryptFolderName(folder);

      expect(result instanceof Folder).toBeTruthy();
      expect(result.name).toStrictEqual(folder.plainName);
    });

    it('When the name is not encrypted, then the decrypting fails', () => {
      const folder = newFolder({
        attributes: {
          name: 'not encrypted name',
          plainName: null,
        },
      });

      jest.spyOn(cryptoService, 'decryptName').mockReturnValue('');

      expect(() => service.decryptFolderName(folder)).toThrow(
        'Unable to decrypt folder name',
      );
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
        .spyOn(folderRepository, 'findOne')
        .mockResolvedValueOnce(mockParentFolder);
      jest
        .spyOn(service, 'getFolderByUuid')
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

      const result = await service.moveFolder(userMocked, folder.uuid, {
        destinationFolder: destinationFolder.uuid,
      });

      expect(result).toEqual(expectedFolder);
      expect(folderRepository.updateByFolderId).toHaveBeenCalledTimes(1);
      expect(folderRepository.updateByFolderId).toHaveBeenCalledWith(
        folder.id,
        {
          parentId: destinationFolder.id,
          parentUuid: destinationFolder.uuid,
          name: expectedFolder.name,
          plainName: expectedFolder.plainName,
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
        service.moveFolder(userMocked, folder.uuid, {
          destinationFolder: destinationFolder.uuid,
        }),
      ).rejects.toThrow(`Folder ${folder.uuid} can not be moved`);
    });

    it('When moved folder is not owned by user, then an error is thrown', async () => {
      const notOwnerUser = newUser();
      const mockFolder = newFolder({
        attributes: { userId: userMocked.id, removed: true },
      });

      jest.spyOn(folderRepository, 'findOne').mockResolvedValueOnce(mockFolder);

      await expect(
        service.moveFolder(notOwnerUser, folder.uuid, {
          destinationFolder: destinationFolder.uuid,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('When folder is moved but its parent folder is removed, then an error is thrown', async () => {
      const mockParentFolder = newFolder({
        attributes: { userId: userMocked.id, removed: true },
      });

      jest.spyOn(folderRepository, 'findOne').mockResolvedValueOnce(folder);
      jest
        .spyOn(folderRepository, 'findOne')
        .mockResolvedValueOnce(mockParentFolder);

      await expect(
        service.moveFolder(userMocked, folder.uuid, {
          destinationFolder: destinationFolder.uuid,
        }),
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
        .spyOn(folderRepository, 'findOne')
        .mockResolvedValueOnce(mockParentFolder);
      jest
        .spyOn(service, 'getFolderByUuid')
        .mockResolvedValueOnce(mockDestinationFolder);

      await expect(
        service.moveFolder(userMocked, folder.uuid, {
          destinationFolder: destinationFolder.uuid,
        }),
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
        service.moveFolder(userMocked, folder.uuid, {
          destinationFolder: destinationFolder.uuid,
        }),
      ).rejects.toThrow('The root folder can not be moved');
    });

    it('When folder is moved from/to a non-existent folder, then it should throw a not found error', async () => {
      jest.spyOn(folderRepository, 'findOne').mockResolvedValueOnce(null);
      await expect(
        service.moveFolder(userMocked, folder.uuid, {
          destinationFolder: destinationFolder.uuid,
        }),
      ).rejects.toThrow(NotFoundException);

      jest.spyOn(folderRepository, 'findOne').mockResolvedValueOnce(folder);
      jest.spyOn(folderRepository, 'findOne').mockResolvedValueOnce(null);
      jest
        .spyOn(service, 'getFolderByUuid')
        .mockRejectedValueOnce(new NotFoundException());
      await expect(
        service.moveFolder(userMocked, folder.uuid, {
          destinationFolder: destinationFolder.uuid,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('When folder is moved to a folder that has been already moved to, then it should throw a conflict error', async () => {
      const mockParentFolder = newFolder({
        attributes: { userId: userMocked.id },
      });

      jest.spyOn(folderRepository, 'findOne').mockResolvedValueOnce(folder);
      jest
        .spyOn(folderRepository, 'findOne')
        .mockResolvedValueOnce(mockParentFolder);
      jest
        .spyOn(service, 'getFolderByUuid')
        .mockResolvedValueOnce(destinationFolder);
      jest
        .spyOn(cryptoService, 'decryptName')
        .mockReturnValueOnce(folder.plainName);
      jest.spyOn(cryptoService, 'encryptName').mockReturnValueOnce(folder.name);
      jest
        .spyOn(folderRepository, 'findByNameAndParentUuid')
        .mockResolvedValueOnce(folder);

      await expect(
        service.moveFolder(userMocked, folder.uuid, {
          destinationFolder: destinationFolder.uuid,
        }),
      ).rejects.toThrow(
        `Folder ${folder.uuid} was already moved to that location`,
      );
    });

    it('When folder is moved to a folder that has already a folder with the same name, then it should throw a conflict error', async () => {
      const mockParentFolder = newFolder({
        attributes: { userId: userMocked.id },
      });

      const conflictFolder = newFolder({
        attributes: {
          ...folder,
          uuid: v4(),
        },
      });
      jest.spyOn(folderRepository, 'findOne').mockResolvedValueOnce(folder);
      jest
        .spyOn(folderRepository, 'findOne')
        .mockResolvedValueOnce(mockParentFolder);

      jest
        .spyOn(service, 'getFolderByUuid')
        .mockResolvedValueOnce(destinationFolder);
      jest
        .spyOn(cryptoService, 'decryptName')
        .mockReturnValueOnce(folder.plainName);
      jest.spyOn(cryptoService, 'encryptName').mockReturnValueOnce(folder.name);
      jest
        .spyOn(folderRepository, 'findByNameAndParentUuid')
        .mockResolvedValueOnce(conflictFolder);

      await expect(
        service.moveFolder(userMocked, folder.uuid, {
          destinationFolder: destinationFolder.uuid,
        }),
      ).rejects.toThrow(
        'A folder with the same name already exists in destination folder',
      );
    });

    it('When folder is moved with a new name, then the folder is updated using the new name and returned', async () => {
      const newName = 'New Folder Name';
      const expectedFolder = newFolder({
        attributes: {
          ...folder,
          name: 'newencrypted-' + newName,
          plainName: newName,
          parentUuid: destinationFolder.uuid,
          parentId: destinationFolder.id,
        },
      });
      const mockParentFolder = newFolder({
        attributes: { userId: userMocked.id, removed: false },
      });

      jest.spyOn(folderRepository, 'findOne').mockResolvedValueOnce(folder);
      jest
        .spyOn(folderRepository, 'findOne')
        .mockResolvedValueOnce(mockParentFolder);
      jest
        .spyOn(service, 'getFolderByUuid')
        .mockResolvedValueOnce(destinationFolder);

      jest
        .spyOn(cryptoService, 'encryptName')
        .mockReturnValueOnce(expectedFolder.name);

      jest
        .spyOn(folderRepository, 'findByNameAndParentUuid')
        .mockResolvedValueOnce(null);

      jest
        .spyOn(folderRepository, 'updateByFolderId')
        .mockResolvedValueOnce(expectedFolder);

      const result = await service.moveFolder(userMocked, folder.uuid, {
        destinationFolder: destinationFolder.uuid,
        name: newName,
      });

      expect(result).toEqual(expectedFolder);
      expect(folderRepository.updateByFolderId).toHaveBeenCalledTimes(1);
      expect(folderRepository.updateByFolderId).toHaveBeenCalledWith(
        folder.id,
        {
          parentId: destinationFolder.id,
          parentUuid: destinationFolder.uuid,
          name: expectedFolder.name,
          plainName: newName,
          deleted: false,
          deletedAt: null,
        },
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
        service.createFolder(userMocked, {
          plainName: folderName,
          parentFolderUuid: parentFolder.uuid,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('When the folder name is invalid, then it should throw', async () => {
      const parentFolder = newFolder({ attributes: { userId: userMocked.id } });
      const notValidName = '';

      jest
        .spyOn(folderRepository, 'findOne')
        .mockResolvedValueOnce(parentFolder);

      await expect(
        service.createFolder(userMocked, {
          plainName: notValidName,
          parentFolderUuid: parentFolder.uuid,
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createFolder(userMocked, {
          plainName: 'Invalid/Name',
          parentFolderUuid: parentFolder.uuid,
        }),
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
        service.createFolder(userMocked, {
          plainName: folderName,
          parentFolderUuid: parentFolder.uuid,
        }),
      ).rejects.toThrow(ConflictException);
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
          creationTime: new Date('2024-09-08T12:00:00Z'),
          modificationTime: new Date('2024-09-12T12:00:00Z'),
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

      const result = await service.createFolder(userMocked, {
        plainName: folderName,
        parentFolderUuid: parentFolder.uuid,
        creationTime: new Date('2024-09-08T12:00:00Z'),
        modificationTime: new Date('2024-09-12T12:00:00Z'),
      });

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

    it('When the folder is removed, then it should throw', async () => {
      const mockFolder = newFolder({ attributes: { removed: true } });
      jest.spyOn(folderRepository, 'findOne').mockResolvedValueOnce(mockFolder);

      await expect(
        service.updateFolderMetaData(
          userMocked,
          mockFolder.uuid,
          newFolderMetadata,
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('When the folder is not found, then it should throw', async () => {
      jest.spyOn(folderRepository, 'findOne').mockResolvedValueOnce(null);

      await expect(
        service.updateFolderMetaData(userMocked, v4(), newFolderMetadata),
      ).rejects.toThrow(NotFoundException);
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
          modificationTime: new Date(),
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
        expect.objectContaining({
          plainName: newFolderMetadata.plainName,
          name: encryptedName,
        }),
      );

      expect(result).toEqual(updatedFolder);
    });
  });

  describe('getFolderTree', () => {
    const user = newUser();
    const rootFolder = newFolder({ attributes: { userId: user.id } });
    const fileInRootFolder = newFile({
      attributes: { folderId: rootFolder.id, userId: user.id },
    });

    it('When retrieving the folder tree, then it should return the folder tree structure', async () => {
      const childrenFolder = newFolder({
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
        .mockResolvedValueOnce([childrenFolder]);
      jest
        .spyOn(fileUsecases, 'getFilesByFolderUuid')
        .mockResolvedValueOnce([]);

      // Second iteration mocks for children folder
      jest
        .spyOn(folderRepository, 'findByUuid')
        .mockResolvedValueOnce(childrenFolder);
      jest
        .spyOn(fileUsecases, 'getFilesByFolderUuid')
        .mockResolvedValueOnce([]);
      jest
        .spyOn(folderRepository, 'findAllByParentUuid')
        .mockResolvedValueOnce([]);

      const result = await service.getFolderTree(user, rootFolder.uuid);

      expect(result).toEqual({
        ...rootFolder,
        files: [fileInRootFolder],
        children: [{ ...childrenFolder, files: [], children: [] }],
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
      const childrenFolder = newFolder({
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
        .mockResolvedValueOnce([childrenFolder]);

      // Second iteration mocks for children folder
      jest
        .spyOn(folderRepository, 'findByUuid')
        .mockResolvedValueOnce(childrenFolder); // Children folder is fetch again from queue
      jest
        .spyOn(fileUsecases, 'getFilesByFolderUuid')
        .mockResolvedValueOnce([]);
      jest
        .spyOn(folderRepository, 'findAllByParentUuid')
        .mockResolvedValueOnce([]);

      const result = await service.getFolderTree(user, rootFolder.uuid);

      expect(result).toEqual({
        ...rootFolder,
        files: [fileInRootFolder],
        children: [
          {
            ...childrenFolder,
            files: [],
            children: [],
          },
        ],
      });
    });
  });

  describe('getFolderAncestorsInWorkspace', () => {
    it('Should return the ancestors of a folder in a workspace', async () => {
      const user = newUser();
      const folder = newFolder({ attributes: { userId: user.id } });
      const ancestors = [newFolder({ owner: user })];

      jest
        .spyOn(folderRepository, 'getFolderAncestorsInWorkspace')
        .mockResolvedValueOnce(ancestors);

      const result = await service.getFolderAncestorsInWorkspace(
        user,
        folder.uuid,
      );

      expect(result).toEqual(ancestors);
    });
  });

  describe('get folder by path', () => {
    it('When get folder metadata by path is requested with a valid path, then the folder is returned', async () => {
      const expectedFolder = newFolder();
      const rootFolder = newFolder();
      const folderPath = '/folder1/folder2';
      jest.spyOn(service, 'getFolderByUserId').mockResolvedValue(rootFolder);
      jest
        .spyOn(folderRepository, 'getFolderByPath')
        .mockResolvedValue(expectedFolder);

      const result = await service.getFolderMetadataByPath(
        userMocked,
        folderPath,
      );
      expect(result).toEqual(expectedFolder);
    });

    it('When get folder metadata by path is requested with a valid path that not exists, then it should return null', async () => {
      const rootFolder = newFolder();
      const folderPath = '/folder1/folder2';
      jest.spyOn(service, 'getFolderByUserId').mockResolvedValue(rootFolder);
      jest.spyOn(folderRepository, 'getFolderByPath').mockResolvedValue(null);

      const result = await service.getFolderMetadataByPath(
        userMocked,
        folderPath,
      );
      expect(result).toBeNull();
    });

    it('When get folder metadata by path is requested with a valid path but the root folder doesnt exists, then it should throw a not found error', async () => {
      const folderPath = '/folder1/folder2';
      jest.spyOn(service, 'getFolderByUserId').mockResolvedValue(null);

      expect(
        service.getFolderMetadataByPath(userMocked, folderPath),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getWorkspacesFoldersUpdatedAfter', () => {
    const createdBy = v4();
    const workspaceId = v4();
    const updatedAfter = new Date('2023-01-01T00:00:00Z');
    const whereClause = { deleted: false, removed: false };
    const options = {
      limit: 10,
      offset: 0,
      sort: [['updatedAt', 'ASC']] as SortParamsFolder,
    };

    it('When folders are found, then it should return those folders', async () => {
      const folders = [newFolder(), newFolder()];
      jest
        .spyOn(folderRepository, 'findAllCursorInWorkspaceWhereUpdatedAfter')
        .mockResolvedValueOnce(folders);

      const result = await service.getWorkspacesFoldersUpdatedAfter(
        createdBy,
        workspaceId,
        whereClause,
        updatedAfter,
        options,
      );

      expect(result).toEqual(folders);
      expect(
        folderRepository.findAllCursorInWorkspaceWhereUpdatedAfter,
      ).toHaveBeenCalledWith(
        createdBy,
        workspaceId,
        whereClause,
        updatedAfter,
        options.limit,
        options.offset,
        options.sort,
      );
    });

    it('When no sort options are provided, it should default to updatedAt ASC', async () => {
      jest.spyOn(folderRepository, 'findAllCursorInWorkspaceWhereUpdatedAfter');

      await service.getWorkspacesFoldersUpdatedAfter(
        createdBy,
        workspaceId,
        whereClause,
        updatedAfter,
        { limit: 5, offset: 0 },
      );

      expect(
        folderRepository.findAllCursorInWorkspaceWhereUpdatedAfter,
      ).toHaveBeenCalledWith(
        createdBy,
        workspaceId,
        whereClause,
        updatedAfter,
        5,
        0,
        [['updatedAt', 'ASC']],
      );
    });

    it('When no folders are found, it should return an empty array', async () => {
      jest
        .spyOn(folderRepository, 'findAllCursorInWorkspaceWhereUpdatedAfter')
        .mockResolvedValueOnce([]);

      const result = await service.getWorkspacesFoldersUpdatedAfter(
        createdBy,
        workspaceId,
        whereClause,
        updatedAfter,
        options,
      );

      expect(result).toEqual([]);
    });

    it('When the where clause is empty, it should call the repository with empty filters', async () => {
      jest.spyOn(folderRepository, 'findAllCursorInWorkspaceWhereUpdatedAfter');

      await service.getWorkspacesFoldersUpdatedAfter(
        createdBy,
        workspaceId,
        {},
        updatedAfter,
        options,
      );

      expect(
        folderRepository.findAllCursorInWorkspaceWhereUpdatedAfter,
      ).toHaveBeenCalledWith(
        createdBy,
        workspaceId,
        {},
        updatedAfter,
        options.limit,
        options.offset,
        options.sort,
      );
    });
  });

  describe('getFolderByUuidAndUser', () => {
    const mockUser = newUser();
    const mockFolder = newFolder({
      attributes: {
        userId: mockUser.id,
        user: mockUser,
      },
      owner: mockUser,
    });

    it('When the folder exists, then it is returned', async () => {
      jest
        .spyOn(folderRepository, 'findByUuidAndUser')
        .mockResolvedValueOnce(mockFolder);

      const result = await service.getFolderByUuidAndUser(
        mockFolder.uuid,
        mockUser,
      );

      expect(result).toBe(mockFolder);
    });

    it('When the folder is not found, then an error is thrown', async () => {
      jest.spyOn(folderRepository, 'findByUuidAndUser').mockResolvedValue(null);

      await expect(
        service.getFolderByUuidAndUser(mockFolder.uuid, mockUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUserRootFolder', () => {
    const mockUser = newUser();
    const mockFolder = newFolder({
      attributes: {
        userId: mockUser.id,
        user: mockUser,
      },
      owner: mockUser,
    });
    mockUser.rootFolderId = mockFolder.id;

    it('When root folder exists, then it is returned', async () => {
      jest.spyOn(folderRepository, 'findOne').mockResolvedValueOnce(mockFolder);

      const result = await service.getUserRootFolder(mockUser);

      expect(result).toBe(mockFolder);
    });
  });

  describe('deleteNotRootFolderByUser ', () => {
    const userMocked = newUser();
    userMocked.rootFolderId = 1;
    const folderMocked: Folder[] = [
      { id: 2, parentId: 1 } as Folder,
      { id: 3, parentId: null } as Folder,
    ];

    it('When folders are deleted successfully, then it should call deleteByUser ', async () => {
      jest.spyOn(folderRepository, 'deleteByUser').mockResolvedValue(undefined);

      await service.deleteNotRootFolderByUser(userMocked, [folderMocked[0]]);

      expect(folderRepository.deleteByUser).toHaveBeenCalledWith(userMocked, [
        folderMocked[0],
      ]);
    });

    it('When trying to delete the root folder, then it should throw an error', async () => {
      const rootFolder = {
        id: userMocked.rootFolderId,
        parentId: null,
      } as Folder;

      await expect(
        service.deleteNotRootFolderByUser(userMocked, [rootFolder]),
      ).rejects.toThrow(NotAcceptableException);
    });

    it('When an error occurs during deletion, then it should throw an error', async () => {
      jest
        .spyOn(folderRepository, 'deleteByUser')
        .mockRejectedValue(new Error('Deletion failed'));

      await expect(
        service.deleteNotRootFolderByUser(userMocked, [folderMocked[0]]),
      ).rejects.toThrow('Deletion failed');
    });
  });

  describe('updateByFolderIdAndForceUpdatedAt', () => {
    const folder = newFolder();
    const folderData = {
      plainName: 'Updated Folder Name',
    };
    const mockedCurrentDate = new Date('2024-10-02T12:00:00Z');

    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(mockedCurrentDate);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('When folderData includes updatedAt, then it should use the provided value', async () => {
      const customDate = new Date('2024-10-01T12:00:00Z');
      const folderDataWithDate = {
        ...folderData,
        updatedAt: customDate,
      };
      const updatedFolder = newFolder({
        attributes: {
          ...folderDataWithDate,
        },
      });

      jest
        .spyOn(folderRepository, 'updateById')
        .mockResolvedValueOnce(updatedFolder);

      await service.updateByFolderIdAndForceUpdatedAt(
        folder,
        folderDataWithDate,
      );

      expect(folderRepository.updateById).toHaveBeenCalledWith(
        folder.id,
        expect.objectContaining({
          plainName: folderData.plainName,
          updatedAt: customDate,
        }),
      );
    });

    it('When folderData does not include updatedAt, then it should add the current date', async () => {
      const updatedFolder = newFolder({
        attributes: {
          ...folderData,
        },
      });

      jest
        .spyOn(folderRepository, 'updateById')
        .mockResolvedValueOnce(updatedFolder);

      await service.updateByFolderIdAndForceUpdatedAt(folder, folderData);

      expect(folderRepository.updateById).toHaveBeenCalledWith(
        folder.id,
        expect.objectContaining({
          plainName: folderData.plainName,
          updatedAt: mockedCurrentDate,
        }),
      );
    });
  });

  describe('getByUuid', () => {
    const folderUuid = v4();

    it('When folder exists, then it should decrypt and return the folder', async () => {
      const folder = newFolder({
        attributes: { uuid: folderUuid, plainName: null },
      });
      const decryptedName = 'Decrypted Name';

      jest.spyOn(folderRepository, 'findByUuid').mockResolvedValueOnce(folder);
      jest
        .spyOn(cryptoService, 'decryptName')
        .mockReturnValueOnce(decryptedName);

      const result = await service.getByUuid(folderUuid);

      expect(folderRepository.findByUuid).toHaveBeenCalledWith(
        folderUuid,
        false,
      );
      expect(cryptoService.decryptName).toHaveBeenCalledWith(
        folder.name,
        folder.parentId,
      );
      expect(result.plainName).toBe(decryptedName);
    });

    it('When the folder has a plain name, then the plain name is returned', async () => {
      const folder = newFolder({
        attributes: { uuid: folderUuid, plainName: 'plain name' },
      });

      jest.spyOn(folderRepository, 'findByUuid').mockResolvedValueOnce(folder);
      const decryptSpy = jest.spyOn(cryptoService, 'decryptName');

      const result = await service.getByUuid(folderUuid);

      expect(folderRepository.findByUuid).toHaveBeenCalledWith(
        folderUuid,
        false,
      );
      expect(decryptSpy).not.toHaveBeenCalled();
      expect(result.plainName).toBe('plain name');
    });

    it('When folder does not exist, then it should throw NotFoundException', async () => {
      jest.spyOn(folderRepository, 'findByUuid').mockResolvedValueOnce(null);

      await expect(service.getByUuid(folderUuid)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getFolderByUuid', () => {
    const user = newUser();
    const folderUuid = v4();

    it('When folder exists and belongs to user, then it should return the folder', async () => {
      const folder = newFolder({
        attributes: { userId: user.id, uuid: folderUuid },
      });

      jest.spyOn(folderRepository, 'findByUuid').mockResolvedValueOnce(folder);

      const result = await service.getFolderByUuid(folderUuid, user);

      expect(result).toEqual(folder);
    });

    it('When folder does not exist, then it should throw NotFoundException', async () => {
      jest.spyOn(folderRepository, 'findByUuid').mockResolvedValueOnce(null);

      await expect(service.getFolderByUuid(folderUuid, user)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('When folder does not belong to user, then it should throw ForbiddenException', async () => {
      const folder = newFolder({
        attributes: { userId: 999, uuid: folderUuid },
      });

      jest.spyOn(folderRepository, 'findByUuid').mockResolvedValueOnce(folder);

      await expect(service.getFolderByUuid(folderUuid, user)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('getFolderByUserId', () => {
    it('When finding folder by user id, then it should return the folder', async () => {
      const folderId = 1;
      const userId = 2;
      const folder = newFolder();

      jest.spyOn(folderRepository, 'findOne').mockResolvedValueOnce(folder);

      const result = await service.getFolderByUserId(folderId, userId);

      expect(folderRepository.findOne).toHaveBeenCalledWith({
        userId,
        id: folderId,
      });
      expect(result).toEqual(folder);
    });
  });

  describe('isFolderInsideFolder', () => {
    const parentId = 1;
    const folderId = 2;
    const userId = 3;

    it('When folder exists and is inside tree, then it should return true', async () => {
      const folder = newFolder();
      const treeResult = { id: folderId };

      jest.spyOn(folderRepository, 'findOne').mockResolvedValueOnce(folder);
      jest
        .spyOn(folderRepository, 'findInTree')
        .mockResolvedValueOnce(treeResult as any);

      const result = await service.isFolderInsideFolder(
        parentId,
        folderId,
        userId,
      );

      expect(result).toBe(true);
      expect(folderRepository.findInTree).toHaveBeenCalledWith(
        parentId,
        folderId,
        userId,
        false,
      );
    });

    it('When folder does not exist, then it should return false', async () => {
      jest.spyOn(folderRepository, 'findOne').mockResolvedValueOnce(null);

      const result = await service.isFolderInsideFolder(
        parentId,
        folderId,
        userId,
      );

      expect(result).toBe(false);
    });

    it('When folder exists but is not inside tree, then it should return false', async () => {
      const folder = newFolder();

      jest.spyOn(folderRepository, 'findOne').mockResolvedValueOnce(folder);
      jest.spyOn(folderRepository, 'findInTree').mockResolvedValueOnce(null);

      const result = await service.isFolderInsideFolder(
        parentId,
        folderId,
        userId,
      );

      expect(result).toBe(false);
    });
  });

  describe('getFoldersByUserId', () => {
    it('When getting folders by user id with where clause, then it should return matching folders', async () => {
      const userId = 1;
      const whereClause = { deleted: false };
      const folders = [newFolder(), newFolder()];

      jest.spyOn(folderRepository, 'findAll').mockResolvedValueOnce(folders);

      const result = await service.getFoldersByUserId(userId, whereClause);

      expect(folderRepository.findAll).toHaveBeenCalledWith({
        userId,
        ...whereClause,
      });
      expect(result).toEqual(folders);
    });
  });

  describe('get folder stats', () => {
    it('When folder belongs to user, then return folder stats', async () => {
      const folderUuid = v4();
      const mockFolder = newFolder({ attributes: { uuid: folderUuid } });
      const mockStats = {
        fileCount: 500,
        isFileCountExact: true,
        totalSize: 5000000,
        isTotalSizeExact: true,
      };

      jest
        .spyOn(service, 'getFolderByUuidAndUser')
        .mockResolvedValueOnce(mockFolder);
      jest
        .spyOn(folderRepository, 'calculateFolderStats')
        .mockResolvedValueOnce(mockStats);

      const result = await service.getFolderStats(userMocked, folderUuid);

      expect(service.getFolderByUuidAndUser).toHaveBeenCalledWith(
        folderUuid,
        userMocked,
      );
      expect(folderRepository.calculateFolderStats).toHaveBeenCalledWith(
        folderUuid,
      );
      expect(result).toEqual(mockStats);
    });

    it('When folder does not exist, then it should not be found', async () => {
      const folderUuid = v4();

      jest.spyOn(service, 'getFolderByUuidAndUser').mockResolvedValueOnce(null);

      await expect(
        service.getFolderStats(userMocked, folderUuid),
      ).rejects.toThrow(NotFoundException);
    });

    it('When folder does not belong to user, then it should not be found', async () => {
      const folderUuid = v4();

      jest.spyOn(service, 'getFolderByUuidAndUser').mockResolvedValueOnce(null);

      await expect(
        service.getFolderStats(userMocked, folderUuid),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getFoldersUpdatedAfter', () => {
    const userId = 1;
    const updatedAfter = new Date('2024-01-01T00:00:00Z');
    const limit = 50;
    const offset = 0;

    it('When getting folders updated after a date with default sort, then it should use default sort order', async () => {
      const whereClause = { deleted: false, removed: false };
      const folders = [newFolder(), newFolder()];

      jest
        .spyOn(folderRepository, 'findAllCursorWhereUpdatedAfter')
        .mockResolvedValueOnce(folders);

      const result = await service.getFoldersUpdatedAfter(
        userId,
        whereClause,
        updatedAfter,
        { limit, offset },
      );

      expect(
        folderRepository.findAllCursorWhereUpdatedAfter,
      ).toHaveBeenCalledWith(
        { ...whereClause, userId },
        updatedAfter,
        limit,
        offset,
        [['updatedAt', 'ASC']],
      );
      expect(result).toEqual(folders);
    });

    it('When getting folders updated after a date with custom sort, then it should use custom sort order', async () => {
      const whereClause = { deleted: false };
      const folders = [newFolder(), newFolder()];
      const customSort: Array<[keyof FolderAttributes, 'ASC' | 'DESC']> = [
        ['plainName', 'DESC'],
        ['updatedAt', 'ASC'],
      ];

      jest
        .spyOn(folderRepository, 'findAllCursorWhereUpdatedAfter')
        .mockResolvedValueOnce(folders);

      const result = await service.getFoldersUpdatedAfter(
        userId,
        whereClause,
        updatedAfter,
        { limit, offset, sort: customSort },
      );

      expect(
        folderRepository.findAllCursorWhereUpdatedAfter,
      ).toHaveBeenCalledWith(
        { ...whereClause, userId },
        updatedAfter,
        limit,
        offset,
        customSort,
      );
      expect(result).toEqual(folders);
    });

    it('When getting folders with empty where clause, then it should only include userId', async () => {
      const folders = [newFolder()];

      jest
        .spyOn(folderRepository, 'findAllCursorWhereUpdatedAfter')
        .mockResolvedValueOnce(folders);

      const result = await service.getFoldersUpdatedAfter(
        userId,
        {},
        updatedAfter,
        { limit, offset },
      );

      expect(
        folderRepository.findAllCursorWhereUpdatedAfter,
      ).toHaveBeenCalledWith({ userId }, updatedAfter, limit, offset, [
        ['updatedAt', 'ASC'],
      ]);
      expect(result).toEqual(folders);
    });

    it('When getting folders with multiple where conditions, then it should merge all conditions with userId', async () => {
      const whereClause = {
        deleted: false,
        removed: false,
        parentId: 123,
      };
      const folders = [newFolder()];

      jest
        .spyOn(folderRepository, 'findAllCursorWhereUpdatedAfter')
        .mockResolvedValueOnce(folders);

      const result = await service.getFoldersUpdatedAfter(
        userId,
        whereClause,
        updatedAfter,
        { limit, offset },
      );

      expect(
        folderRepository.findAllCursorWhereUpdatedAfter,
      ).toHaveBeenCalledWith(
        { ...whereClause, userId },
        updatedAfter,
        limit,
        offset,
        [['updatedAt', 'ASC']],
      );
      expect(result).toEqual(folders);
    });

    it('When getting folders with different pagination options, then it should pass correct limit and offset', async () => {
      const whereClause = { deleted: false };
      const folders = [newFolder()];
      const customLimit = 100;
      const customOffset = 50;

      jest
        .spyOn(folderRepository, 'findAllCursorWhereUpdatedAfter')
        .mockResolvedValueOnce(folders);

      const result = await service.getFoldersUpdatedAfter(
        userId,
        whereClause,
        updatedAfter,
        { limit: customLimit, offset: customOffset },
      );

      expect(
        folderRepository.findAllCursorWhereUpdatedAfter,
      ).toHaveBeenCalledWith(
        { ...whereClause, userId },
        updatedAfter,
        customLimit,
        customOffset,
        [['updatedAt', 'ASC']],
      );
      expect(result).toEqual(folders);
    });

    it('When getting folders with uuid sort, then it should pass uuid sort to repository', async () => {
      const whereClause = { deleted: false };
      const folders = [newFolder()];
      const uuidSort: Array<[keyof FolderAttributes, 'ASC' | 'DESC']> = [
        ['uuid', 'ASC'],
      ];

      jest
        .spyOn(folderRepository, 'findAllCursorWhereUpdatedAfter')
        .mockResolvedValueOnce(folders);

      const result = await service.getFoldersUpdatedAfter(
        userId,
        whereClause,
        updatedAfter,
        { limit, offset, sort: uuidSort },
      );

      expect(
        folderRepository.findAllCursorWhereUpdatedAfter,
      ).toHaveBeenCalledWith(
        { ...whereClause, userId },
        updatedAfter,
        limit,
        offset,
        uuidSort,
      );
      expect(result).toEqual(folders);
    });
  });
  describe('createFolderDevice', () => {
    it('When plain name is not given, then it should throw an error', async () => {
      const mockFolderData: Partial<FolderAttributes> = {
        bucket: 'mock bucket',
      };
      await expect(
        service.createFolderDevice(userMocked, mockFolderData),
      ).rejects.toThrow(BadRequestException);
      expect(folderRepository.createFolder).not.toHaveBeenCalled();
    });

    it('When bucket is not given, then it should throw an error', async () => {
      const mockFolderData: Partial<FolderAttributes> = {
        plainName: 'mock plain name',
      };

      await expect(
        service.createFolderDevice(userMocked, mockFolderData),
      ).rejects.toThrow(BadRequestException);
      expect(folderRepository.createFolder).not.toHaveBeenCalled();
    });

    it('When both plain name and bucket are given, then it should create a folder', async () => {
      const mockFolder = newFolder();
      const mockFolderData: Partial<FolderAttributes> = {
        plainName: 'mock plain name',
        bucket: 'mock bucket',
      };
      jest
        .spyOn(folderRepository, 'createFolder')
        .mockResolvedValue(mockFolder);
      const result = await service.createFolderDevice(
        userMocked,
        mockFolderData,
      );

      expect(result).toBe(mockFolder);
      expect(folderRepository.createFolder).toHaveBeenCalledTimes(1);
    });
  });
});
