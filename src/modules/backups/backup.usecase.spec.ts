import { newUser } from './../../../test/fixtures';
import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { BackupUseCase } from './backup.usecase';
import { SequelizeBackupRepository } from './backup.repository';
import { BridgeService } from '../../externals/bridge/bridge.service';
import { CryptoService } from '../../externals/crypto/crypto.service';
import { FolderUseCases } from '../folder/folder.usecase';
import { FileUseCases } from '../file/file.usecase';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';

describe('BackupUseCase', () => {
  let backupUseCase: BackupUseCase;
  let backupRepository: SequelizeBackupRepository;
  let bridgeService: BridgeService;
  let cryptoService: CryptoService;
  let folderUseCases: FolderUseCases;
  let fileUseCases: FileUseCases;

  const userMocked = newUser({
    attributes: {
      id: 1,
      uuid: 'user-uuid',
      email: 'test@example.com',
      backupsBucket: 'bucket-id',
    },
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BackupUseCase],
    })
      .useMocker(() => createMock())
      .compile();

    backupUseCase = module.get<BackupUseCase>(BackupUseCase);
    backupRepository = module.get<SequelizeBackupRepository>(
      SequelizeBackupRepository,
    );
    bridgeService = module.get<BridgeService>(BridgeService);
    cryptoService = module.get<CryptoService>(CryptoService);
    folderUseCases = module.get<FolderUseCases>(FolderUseCases);
    fileUseCases = module.get<FileUseCases>(FileUseCases);
  });

  describe('activate', () => {
    it('When backups are already activated, then it should return the backups bucket', async () => {
      const result = await backupUseCase.activate(userMocked);
      expect(result).toEqual({ backupsBucket: 'bucket-id' });
    });

    it('When backups are not activated, then it should create a new bucket', async () => {
      const mockBucket = { id: 'new-bucket-id' };
      jest
        .spyOn(bridgeService, 'createBucket')
        .mockResolvedValue(mockBucket as any);

      const userWithoutBucket = { ...userMocked, backupsBucket: null };
      const result = await backupUseCase.activate(userWithoutBucket as any);
      expect(result).toEqual({ backupsBucket: 'new-bucket-id' });
    });
  });

  describe('createDeviceAsFolder', () => {
    it('When a folder with the same name exists, then it should throw a ConflictException', async () => {
      jest
        .spyOn(folderUseCases, 'getFolders')
        .mockResolvedValue([{ id: 1, name: 'Device Folder' }] as any);

      await expect(
        backupUseCase.createDeviceAsFolder(userMocked, 'Device Folder'),
      ).rejects.toThrow(ConflictException);
    });

    it('When no folder with the same name exists, then it should create the folder', async () => {
      const mockFolder = { id: 1, name: 'Device Folder' };
      jest.spyOn(folderUseCases, 'getFolders').mockResolvedValue([]);
      jest
        .spyOn(folderUseCases, 'createFolderDevice')
        .mockResolvedValue(mockFolder as any);

      const result = await backupUseCase.createDeviceAsFolder(
        userMocked,
        'Device Folder',
      );
      expect(result).toEqual(mockFolder);
    });
  });

  describe('getDevicesAsFolder', () => {
    it('When backups are not activated, then it should throw a BadRequestException', async () => {
      const userWithoutBucket = { ...userMocked, backupsBucket: null };
      await expect(
        backupUseCase.getDevicesAsFolder(userWithoutBucket as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('When backups are activated, then it should return all devices as folders', async () => {
      const mockFolders = [{ id: 1, name: 'Device Folder' }];
      jest
        .spyOn(folderUseCases, 'getFoldersByUserId')
        .mockResolvedValue(mockFolders as any);

      const result = await backupUseCase.getDevicesAsFolder(userMocked);
      expect(result).toEqual(expect.any(Array));
    });
  });

  describe('deleteUserBackups', () => {
    it('When deleting user backups, then it should delete all backups and devices for the user', async () => {
      jest.spyOn(backupRepository, 'deleteBackupsBy').mockResolvedValue(5);
      jest.spyOn(backupRepository, 'deleteDevicesBy').mockResolvedValue(3);

      const result = await backupUseCase.deleteUserBackups(userMocked.id);
      expect(result).toEqual({ deletedBackups: 5, deletedDevices: 3 });
    });
  });

  describe('isFolderEmpty', () => {
    it('When the folder has no subfolders or files, then it should return true', async () => {
      jest.spyOn(folderUseCases, 'getFoldersByParentId').mockResolvedValue([]);
      jest.spyOn(fileUseCases, 'getByFolderAndUser').mockResolvedValue([]);

      const result = await backupUseCase.isFolderEmpty(userMocked, {
        id: 1,
      } as any);
      expect(result).toBe(true);
    });

    it('When the folder has subfolders or files, then it should return false', async () => {
      jest
        .spyOn(folderUseCases, 'getFoldersByParentId')
        .mockResolvedValue([{ id: 2 }] as any);
      jest.spyOn(fileUseCases, 'getByFolderAndUser').mockResolvedValue([]);

      const result = await backupUseCase.isFolderEmpty(userMocked, {
        id: 1,
      } as any);
      expect(result).toBe(false);
    });
  });

  describe('getDeviceAsFolder', () => {
    it('When the folder does not exist, then it should throw a NotFoundException', async () => {
      jest.spyOn(folderUseCases, 'getFolderByUserId').mockResolvedValue(null);

      await expect(
        backupUseCase.getDeviceAsFolder(userMocked, 1),
      ).rejects.toThrow(NotFoundException);
    });

    it('When the folder exists, then it should return the folder', async () => {
      const mockFolder = {
        id: 1,
        name: 'Encrypted Folder',
        bucket: 'bucket-id',
        updatedAt: new Date(),
      };
      jest
        .spyOn(folderUseCases, 'getFolderByUserId')
        .mockResolvedValue(mockFolder as any);
      jest.spyOn(backupUseCase, 'isFolderEmpty').mockResolvedValue(false);

      const result = await backupUseCase.getDeviceAsFolder(userMocked, 1);
      expect(result).toEqual({
        ...mockFolder,
        hasBackups: true,
        lastBackupAt: mockFolder.updatedAt,
      });
    });
  });

  describe('updateDeviceAsFolder', () => {
    it('When the folder does not exist, then it should throw a NotFoundException', async () => {
      jest.spyOn(folderUseCases, 'getFolderByUserId').mockResolvedValue(null);

      await expect(
        backupUseCase.updateDeviceAsFolder(userMocked, 1, 'New Device Name'),
      ).rejects.toThrow(NotFoundException);
    });

    it('When the folder exists, then it should update the folder with the new name', async () => {
      const mockFolder = {
        id: 1,
        name: 'Old Encrypted Name',
        bucket: 'bucket-id',
      };
      const updatedFolder = {
        ...mockFolder,
        name: 'New Encrypted Name',
        plainName: 'New Device Name',
      };
      jest
        .spyOn(folderUseCases, 'getFolderByUserId')
        .mockResolvedValue(mockFolder as any);
      jest
        .spyOn(cryptoService, 'encryptName')
        .mockReturnValue('New Encrypted Name');
      jest
        .spyOn(folderUseCases, 'updateByFolderId')
        .mockResolvedValue(updatedFolder as any);

      const result = await backupUseCase.updateDeviceAsFolder(
        userMocked,
        1,
        'New Device Name',
      );
      expect(result).toEqual(updatedFolder);
    });
  });
});
