import { newFolder, newUser } from './../../../test/fixtures';
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
import { Folder } from '../folder/folder.domain';

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

  beforeAll(() => {
    const fixedSystemCurrentDate = new Date('2022-01-01');
    jest.useFakeTimers();
    jest.setSystemTime(fixedSystemCurrentDate);
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
      const mockFolder = newFolder();
      jest.spyOn(folderUseCases, 'getFolders').mockResolvedValue([]);
      jest
        .spyOn(folderUseCases, 'createFolderDevice')
        .mockResolvedValue(mockFolder);

      const result = await backupUseCase.createDeviceAsFolder(
        userMocked,
        'Device Folder',
      );
      expect(result).toEqual({
        ...newBackupFolder(mockFolder),
      });
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
      const mockFolder = newFolder();
      jest
        .spyOn(folderUseCases, 'getFoldersByUserId')
        .mockResolvedValue([mockFolder]);
      jest
        .spyOn(cryptoService, 'decryptName')
        .mockReturnValueOnce(mockFolder.plainName as never);

      const result = await backupUseCase.getDevicesAsFolder(userMocked);

      result.forEach((folder) => {
        expect(folder).toEqual({ ...newBackupFolder(mockFolder) });
      });
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
      jest
        .spyOn(folderUseCases, 'getFolderByUuid')
        .mockRejectedValue(new NotFoundException());

      await expect(
        backupUseCase.getDeviceAsFolder(userMocked, 'folder-uuid'),
      ).rejects.toThrow(NotFoundException);
    });

    it('When the folder exists, then it should return the folder', async () => {
      const mockFolder = newFolder();
      const mockFolderWithBackupAttributes = newBackupFolder(mockFolder);
      mockFolderWithBackupAttributes.hasBackups = true;

      jest
        .spyOn(folderUseCases, 'getFolderByUuid')
        .mockResolvedValue(mockFolder);
      jest.spyOn(backupUseCase, 'isFolderEmpty').mockResolvedValue(false);

      const result = await backupUseCase.getDeviceAsFolder(
        userMocked,
        'folder-uuid',
      );
      expect(result).toEqual(mockFolderWithBackupAttributes);
    });
  });

  describe('updateDeviceAsFolder', () => {
    it('When the folder does not exist, then it should throw a NotFoundException', async () => {
      jest
        .spyOn(folderUseCases, 'getFolderByUuid')
        .mockRejectedValue(new NotFoundException());

      await expect(
        backupUseCase.updateDeviceAsFolder(
          userMocked,
          'folder-uuid',
          'New Device Name',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('When the folder exists, then it should update the folder with the new name', async () => {
      const mockFolder = newFolder();
      const updatedFolder = newFolder({
        attributes: {
          ...mockFolder,
          name: 'New Encrypted Name',
          plainName: 'New Device Name',
        },
      });

      jest
        .spyOn(folderUseCases, 'getFolderByUuid')
        .mockResolvedValue(mockFolder);
      jest
        .spyOn(cryptoService, 'encryptName')
        .mockReturnValue('New Encrypted Name');
      jest
        .spyOn(folderUseCases, 'updateByFolderId')
        .mockResolvedValue(updatedFolder);

      const result = await backupUseCase.updateDeviceAsFolder(
        userMocked,
        'folder-uuid',
        'New Device Name',
      );
      expect(result).toEqual({ ...newBackupFolder(updatedFolder) });
    });
  });

  describe('deleteBackup', () => {
    it('When backup is not found, then it should throw a NotFoundException', async () => {
      jest
        .spyOn(backupRepository, 'findBackupByUserAndId')
        .mockResolvedValue(null);

      await expect(backupUseCase.deleteBackup(userMocked, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('When backup is found, then it should delete the backup', async () => {
      const mockBackup = { id: 1, deviceId: 1, path: 'add_path' };
      jest
        .spyOn(backupRepository, 'findBackupByUserAndId')
        .mockResolvedValue(mockBackup as any);
      jest
        .spyOn(backupRepository, 'deleteBackupByUserAndId')
        .mockResolvedValue(1);

      const result = await backupUseCase.deleteBackup(userMocked, 1);
      expect(result).toEqual(1);
    });
  });

  describe('getAllDevices', () => {
    it('When fetching all devices, then it should return all devices for the user', async () => {
      const mockDevices = [{ id: 1, name: 'Device 1' }];
      jest
        .spyOn(backupRepository, 'findAllDevices')
        .mockResolvedValue(mockDevices as any);

      const result = await backupUseCase.getAllDevices(userMocked);
      expect(result).toEqual(mockDevices);
    });
  });

  describe('deleteDevice', () => {
    it('When the device is not found, then it should throw a NotFoundException', async () => {
      jest
        .spyOn(backupRepository, 'findDeviceByUserAndId')
        .mockResolvedValue(null);

      await expect(backupUseCase.deleteDevice(userMocked, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('When the device is found, then it should delete the device and its backups', async () => {
      const mockDevice = {
        id: 1,
        backups: [{ fileId: 'file-id', bucket: 'bucket-id' }],
      };
      jest
        .spyOn(backupRepository, 'findDeviceByUserAndId')
        .mockResolvedValue(mockDevice as any);
      jest.spyOn(backupRepository, 'deleteBackupsBy').mockResolvedValue(1);
      jest.spyOn(backupRepository, 'deleteDevicesBy').mockResolvedValue(1);
      jest.spyOn(bridgeService, 'deleteFile').mockResolvedValue(undefined);

      const result = await backupUseCase.deleteDevice(userMocked, 1);
      expect(result).toEqual(1);
    });
  });

  describe('getBackupsByMac', () => {
    it('When the device is not found, then it should throw a NotFoundException', async () => {
      jest
        .spyOn(backupRepository, 'findDeviceByUserAndMac')
        .mockResolvedValue(null);

      await expect(
        backupUseCase.getBackupsByMac(userMocked, 'mac-address'),
      ).rejects.toThrow(NotFoundException);
    });

    it('When the device is found, then it should return backups for the device', async () => {
      const mockBackups = [{ id: 1, path: 'backup-path' }];
      jest
        .spyOn(backupRepository, 'findDeviceByUserAndMac')
        .mockResolvedValue({ id: 1 } as any);
      jest
        .spyOn(backupRepository, 'findAllBackupsByUserAndDevice')
        .mockResolvedValue(mockBackups as any);

      const result = await backupUseCase.getBackupsByMac(
        userMocked,
        'mac-address',
      );
      expect(result).toEqual(mockBackups);
    });
  });
});

const newBackupFolder = (folder: Folder) => {
  const backupFolder = folder || newFolder();

  return {
    ...backupFolder,
    hasBackups: false,
    lastBackupAt: folder.updatedAt,
    status: folder.getFolderStatus(),
  };
};
