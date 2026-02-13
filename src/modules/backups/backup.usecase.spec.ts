import { newDevice, newFolder, newUser } from './../../../test/fixtures';
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
import { DevicePlatform } from './device.domain';
import { SequelizeFolderRepository } from '../folder/folder.repository';

describe('BackupUseCase', () => {
  let backupUseCase: BackupUseCase;
  let backupRepository: SequelizeBackupRepository;
  let folderRepository: SequelizeFolderRepository;

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
    folderRepository = module.get<SequelizeFolderRepository>(
      SequelizeFolderRepository,
    );
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
      const userWithoutBucket = newUser();
      userWithoutBucket.backupsBucket = null;

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

      const mockFolderResponse = {
        //TODO: temporary hotfix remove after mac newer version is released
        ...newBackupFolder(mockFolder),
        plain_name: mockFolder.plainName,
      };

      result.forEach((folder) => {
        expect(folder).toEqual(mockFolderResponse);
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

  describe('sumExistentBackupSizes', () => {
    it('When sumExistentBackupSizes is called, then it should return the sum of the backup sizes', async () => {
      jest
        .spyOn(backupRepository, 'sumExistentBackupSizes')
        .mockResolvedValue(1024);

      const result = await backupUseCase.sumExistentBackupSizes(userMocked.id);
      expect(result).toBe(1024);
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

  describe('getDeviceAsFolderById', () => {
    it('When folder usecase throws, then it should throw the same error', async () => {
      jest.spyOn(folderUseCases, 'getFolderByUserId').mockResolvedValue(null);

      await expect(
        backupUseCase.getDeviceAsFolderById(userMocked, 1),
      ).rejects.toThrow(NotFoundException);
    });

    it('When the folder exists, then it should return the folder', async () => {
      const mockFolder = newFolder();
      const mockFolderWithBackupAttributes = newBackupFolder(mockFolder);
      mockFolderWithBackupAttributes.hasBackups = true;

      jest
        .spyOn(folderUseCases, 'getFolderByUserId')
        .mockResolvedValue(mockFolder);
      jest.spyOn(backupUseCase, 'isFolderEmpty').mockResolvedValue(false);

      const result = await backupUseCase.getDeviceAsFolderById(userMocked, 1);
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
        .spyOn(folderUseCases, 'updateByFolderIdAndForceUpdatedAt')
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
        .spyOn(backupRepository, 'findAllLegacyDevices')
        .mockResolvedValue(mockDevices as any);

      const result = await backupUseCase.getAllLegacyDevices(userMocked);
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

  describe('deleteDeviceAsFolder', () => {
    it('When folder is not found, then it should throw a NotFoundException', async () => {
      jest.spyOn(folderUseCases, 'getFolderByUuid').mockResolvedValue(null);

      await expect(
        backupUseCase.deleteDeviceAsFolder(userMocked, 'folder-uuid'),
      ).rejects.toThrow(NotFoundException);
    });

    it('When folder is found, then it should call deleteByUser and deleteDevicesBy', async () => {
      const mockFolder = newFolder({
        attributes: {
          bucket: userMocked.backupsBucket,
        },
      });
      jest
        .spyOn(folderUseCases, 'getFolderByUuid')
        .mockResolvedValue(mockFolder);
      jest.spyOn(folderUseCases, 'deleteByUser').mockResolvedValue(undefined);
      jest.spyOn(backupRepository, 'deleteDevicesBy').mockResolvedValue(1);

      await backupUseCase.deleteDeviceAsFolder(userMocked, 'folder-uuid');

      expect(folderUseCases.deleteByUser).toHaveBeenCalledWith(userMocked, [
        mockFolder,
      ]);
      expect(backupRepository.deleteDevicesBy).toHaveBeenCalledWith({
        userId: userMocked.id,
        folderUuid: 'folder-uuid',
      });
    });

    it('When folder is not in the backups bucket, then it should throw a BadRequestException', async () => {
      const mockFolder = newFolder({
        attributes: {
          bucket: 'other-bucket',
        },
      });
      jest
        .spyOn(folderUseCases, 'getFolderByUuid')
        .mockResolvedValue(mockFolder);
      jest.spyOn(folderUseCases, 'deleteByUser').mockResolvedValue(undefined);

      await expect(
        backupUseCase.deleteDeviceAsFolder(userMocked, 'folder-uuid'),
      ).rejects.toThrow(BadRequestException);
    });

    it('When folder is deleted, then it should delete associated devices to prevent orphaned records', async () => {
      const mockFolder = newFolder({
        attributes: {
          uuid: 'test-folder-uuid',
          bucket: userMocked.backupsBucket,
        },
      });
      jest
        .spyOn(folderUseCases, 'getFolderByUuid')
        .mockResolvedValue(mockFolder);
      jest.spyOn(folderUseCases, 'deleteByUser').mockResolvedValue(undefined);
      jest.spyOn(backupRepository, 'deleteDevicesBy').mockResolvedValue(2);

      await backupUseCase.deleteDeviceAsFolder(userMocked, 'test-folder-uuid');

      expect(backupRepository.deleteDevicesBy).toHaveBeenCalledWith({
        userId: userMocked.id,
        folderUuid: 'test-folder-uuid',
      });
    });
  });

  describe('getUserDevices', () => {
    it('When backups are not enabled, then it should throw', async () => {
      const userWithoutBackups = newUser();
      userWithoutBackups.backupsBucket = null;
      await expect(
        backupUseCase.getUserDevices(userWithoutBackups, {}, 10, 0),
      ).rejects.toThrow(BadRequestException);
    });

    it('When backups are enabled, then it should return user devices with filters', async () => {
      const mockDevices = [
        newDevice({ platform: DevicePlatform.WINDOWS }),
        newDevice({ platform: DevicePlatform.WINDOWS }),
      ];
      const filterOptions = { platform: DevicePlatform.WINDOWS };

      jest
        .spyOn(backupRepository, 'findUserDevicesBy')
        .mockResolvedValue(mockDevices);

      const result = await backupUseCase.getUserDevices(
        userMocked,
        filterOptions,
        10,
        0,
      );

      expect(result).toEqual(mockDevices);
      expect(backupRepository.findUserDevicesBy).toHaveBeenCalledWith(
        userMocked,
        filterOptions,
        10,
        0,
      );
    });

    it('When called with empty filters, then it should return all user devices', async () => {
      const mockDevices = [newDevice(), newDevice()];

      jest
        .spyOn(backupRepository, 'findUserDevicesBy')
        .mockResolvedValue(mockDevices as any);

      const result = await backupUseCase.getUserDevices(userMocked, {}, 20, 5);

      expect(result).toEqual(mockDevices);
      expect(backupRepository.findUserDevicesBy).toHaveBeenCalledWith(
        userMocked,
        {},
        20,
        5,
      );
    });
  });

  describe('createDeviceAndFolder', () => {
    const createDeviceDto = {
      key: 'test-key',
      hostname: 'test-hostname',
      platform: DevicePlatform.LINUX,
      name: 'Test Device',
    };

    it('When user does not have backups enabled, then it should activate backups first', async () => {
      const userWithoutBackups = newUser();
      userWithoutBackups.backupsBucket = null;

      const mockFolder = newFolder({
        owner: userWithoutBackups,
      });
      mockFolder.bucket = userWithoutBackups.backupsBucket;
      const mockDevice = newDevice({
        ...createDeviceDto,
        userId: userWithoutBackups.id,
      });
      jest
        .spyOn(backupUseCase, 'activate')
        .mockResolvedValue({ backupsBucket: 'new-bucket' });
      jest
        .spyOn(backupRepository, 'findConflictingUserDevice')
        .mockResolvedValue(null);
      jest
        .spyOn(backupUseCase, 'createDeviceAsFolder')
        .mockResolvedValue(mockFolder as any);
      jest
        .spyOn(backupRepository, 'createDevice')
        .mockResolvedValue(mockDevice);

      const result = await backupUseCase.createDeviceAndFolder(
        userWithoutBackups,
        createDeviceDto,
      );

      expect(backupUseCase.activate).toHaveBeenCalledWith(userWithoutBackups);
      expect(result).toEqual({ ...mockDevice, folder: mockFolder });
    });

    it('When device with same key or hostname already exists, then it should throw a ConflictException', async () => {
      const existingDevice = newDevice({ userId: userMocked.id });

      jest
        .spyOn(backupRepository, 'findConflictingUserDevice')
        .mockResolvedValue(existingDevice);

      await expect(
        backupUseCase.createDeviceAndFolder(userMocked, createDeviceDto),
      ).rejects.toThrow(ConflictException);
    });

    it('When device does not exist, then it should create device and folder successfully', async () => {
      const mockFolder = newFolder();
      const mockDevice = newDevice({ userId: userMocked.id });

      jest
        .spyOn(backupRepository, 'findConflictingUserDevice')
        .mockResolvedValue(null);
      jest
        .spyOn(backupUseCase, 'createDeviceAsFolder')
        .mockResolvedValue(mockFolder as any);
      jest
        .spyOn(backupRepository, 'createDevice')
        .mockResolvedValue(mockDevice);

      const result = await backupUseCase.createDeviceAndFolder(
        userMocked,
        createDeviceDto,
      );

      expect(backupUseCase.createDeviceAsFolder).toHaveBeenCalledWith(
        userMocked,
        createDeviceDto.name,
      );
      expect(backupRepository.createDevice).toHaveBeenCalledWith({
        ...createDeviceDto,
        folderUuid: mockFolder.uuid,
        userId: userMocked.id,
      });

      expect(result).toEqual({ ...mockDevice, folder: mockFolder });
    });
  });

  describe('createDeviceForExistingFolder', () => {
    const createDeviceDto = {
      key: 'test-key',
      hostname: 'test-hostname',
      platform: DevicePlatform.LINUX,
      name: 'Test Device',
      folderUuid: 'folder-uuid',
    };

    it('When user does not have backups enabled, then it should throw', async () => {
      const userWithoutBackups = newUser();
      userWithoutBackups.backupsBucket = null;

      await expect(
        backupUseCase.createDeviceForExistingFolder(
          userWithoutBackups,
          createDeviceDto,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('When device with same key or hostname already exists, then it should throw', async () => {
      const existingDevice = newDevice({ userId: userMocked.id });

      jest
        .spyOn(backupRepository, 'findConflictingUserDevice')
        .mockResolvedValue(existingDevice as any);

      await expect(
        backupUseCase.createDeviceForExistingFolder(
          userMocked,
          createDeviceDto,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('When folder is already assigned to another device, then it should throw', async () => {
      const deviceAssignedToFolder = newDevice({
        folderUuid: createDeviceDto.folderUuid,
      });

      jest
        .spyOn(backupRepository, 'findConflictingUserDevice')
        .mockResolvedValue(null);
      jest
        .spyOn(backupRepository, 'findOneUserDeviceBy')
        .mockResolvedValue(deviceAssignedToFolder as any);

      await expect(
        backupUseCase.createDeviceForExistingFolder(
          userMocked,
          createDeviceDto,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('When folder does not belong to backups bucket, then it should throw', async () => {
      const mockFolder = newFolder({ attributes: { bucket: 'other-bucket' } });

      jest
        .spyOn(backupRepository, 'findConflictingUserDevice')
        .mockResolvedValue(null);
      jest
        .spyOn(backupRepository, 'findOneUserDeviceBy')
        .mockResolvedValue(null);
      jest
        .spyOn(folderUseCases, 'getFolderByUuid')
        .mockResolvedValue(mockFolder);

      await expect(
        backupUseCase.createDeviceForExistingFolder(
          userMocked,
          createDeviceDto,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('When folder is not found, then it should throw', async () => {
      jest
        .spyOn(backupRepository, 'findConflictingUserDevice')
        .mockResolvedValue(null);
      jest
        .spyOn(backupRepository, 'findOneUserDeviceBy')
        .mockResolvedValue(null);
      jest
        .spyOn(folderUseCases, 'getFolderByUuid')
        .mockRejectedValue(new NotFoundException());

      await expect(
        backupUseCase.createDeviceForExistingFolder(
          userMocked,
          createDeviceDto,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('When all conditions are met, then it should create device for existing folder successfully', async () => {
      const mockFolder = newFolder({
        attributes: { bucket: userMocked.backupsBucket },
      });
      const mockDevice = newDevice({
        ...createDeviceDto,
        userId: userMocked.id,
      });

      jest
        .spyOn(backupRepository, 'findConflictingUserDevice')
        .mockResolvedValue(null);
      jest
        .spyOn(backupRepository, 'findOneUserDeviceBy')
        .mockResolvedValue(null);
      jest
        .spyOn(folderUseCases, 'getFolderByUuid')
        .mockResolvedValue(mockFolder);
      jest
        .spyOn(backupRepository, 'createDevice')
        .mockResolvedValue(mockDevice);

      const result = await backupUseCase.createDeviceForExistingFolder(
        userMocked,
        createDeviceDto,
      );

      expect(backupRepository.createDevice).toHaveBeenCalledWith({
        ...createDeviceDto,
        folderUuid: createDeviceDto.folderUuid,
        userId: userMocked.id,
      });
      expect(result).toEqual({
        ...mockDevice,
        folder: newBackupFolder(mockFolder),
      });
    });
  });

  describe('deleteDeviceAndFolder', () => {
    it('When device is not found, then it should throw', async () => {
      jest
        .spyOn(backupRepository, 'findDeviceByUserAndKey')
        .mockResolvedValue(null);

      await expect(
        backupUseCase.deleteDeviceAndFolderByKey(userMocked, 'anyKey'),
      ).rejects.toThrow(NotFoundException);
    });

    it('When device exists but has no folderUuid, then it should only delete the device', async () => {
      const mockDevice = newDevice({
        id: 1,
        userId: userMocked.id,
        folderUuid: null,
      });

      jest
        .spyOn(backupRepository, 'findDeviceByUserAndKey')
        .mockResolvedValue(mockDevice);
      jest.spyOn(backupRepository, 'deleteDevicesBy').mockResolvedValue(1);

      await backupUseCase.deleteDeviceAndFolderByKey(
        userMocked,
        mockDevice.key,
      );

      expect(backupRepository.deleteDevicesBy).toHaveBeenCalledWith({
        id: 1,
        userId: userMocked.id,
      });
      expect(folderUseCases.getFolderByUuid).not.toHaveBeenCalled();
    });

    it('When device has folderUuid but folder is not in backups bucket, then it should only delete the device', async () => {
      const mockDevice = newDevice({
        id: 1,
        userId: userMocked.id,
      });
      const mockFolder = newFolder();

      jest
        .spyOn(backupRepository, 'findDeviceByUserAndKey')
        .mockResolvedValue(mockDevice);
      jest
        .spyOn(folderUseCases, 'getFolderByUuid')
        .mockResolvedValue(mockFolder);
      jest.spyOn(backupRepository, 'deleteDevicesBy').mockResolvedValue(1);

      await backupUseCase.deleteDeviceAndFolderByKey(
        userMocked,
        mockDevice.key,
      );

      expect(folderUseCases.deleteByUser).not.toHaveBeenCalled();
      expect(backupRepository.deleteDevicesBy).toHaveBeenCalledWith({
        id: 1,
        userId: userMocked.id,
      });
    });

    it('When device has folderUuid and folder is in backups bucket, then it should delete both device and folder', async () => {
      const mockFolder = newFolder({
        attributes: { bucket: userMocked.backupsBucket },
      });
      const mockDevice = newDevice({
        id: 1,
        userId: userMocked.id,
        folderUuid: mockFolder.uuid,
      });

      jest
        .spyOn(backupRepository, 'findDeviceByUserAndKey')
        .mockResolvedValue(mockDevice);
      jest
        .spyOn(folderUseCases, 'getFolderByUuid')
        .mockResolvedValue(mockFolder);
      jest.spyOn(folderUseCases, 'deleteByUser').mockResolvedValue(undefined);
      jest.spyOn(backupRepository, 'deleteDevicesBy').mockResolvedValue(1);

      await backupUseCase.deleteDeviceAndFolderByKey(
        userMocked,
        mockDevice.key,
      );

      expect(folderUseCases.deleteByUser).toHaveBeenCalledWith(userMocked, [
        mockFolder,
      ]);
      expect(backupRepository.deleteDevicesBy).toHaveBeenCalledWith({
        id: 1,
        userId: userMocked.id,
      });
    });
  });

  describe('updateDeviceAndFolderName', () => {
    const updateDeviceDto = { name: 'New Device Name' };

    it('When device is not found, then it should throw', async () => {
      jest
        .spyOn(backupRepository, 'findDeviceByUserAndKey')
        .mockResolvedValue(null);

      await expect(
        backupUseCase.updateDeviceAndFolderNameByKey(
          userMocked,
          'no-existent-key',
          updateDeviceDto,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('When another device with the same name already exists, then it should throw', async () => {
      const mockDevice = newDevice({ id: 1, userId: userMocked.id });
      const existingDevice = newDevice({
        id: 2,
        userId: userMocked.id,
        name: updateDeviceDto.name,
      });

      jest
        .spyOn(backupRepository, 'findDeviceByUserAndKey')
        .mockResolvedValue(mockDevice);
      jest
        .spyOn(backupRepository, 'findOneUserDeviceByName')
        .mockResolvedValue(existingDevice);

      await expect(
        backupUseCase.updateDeviceAndFolderNameByKey(
          userMocked,
          existingDevice.key,
          updateDeviceDto,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('When a folder with the same name already exists in backups bucket, then it should throw', async () => {
      const mockDevice = newDevice({ id: 1, userId: userMocked.id });
      const existingFolder = newFolder();

      jest
        .spyOn(backupRepository, 'findDeviceByUserAndKey')
        .mockResolvedValue(mockDevice);
      jest
        .spyOn(backupRepository, 'findOneUserDeviceByName')
        .mockResolvedValue(null);
      jest
        .spyOn(folderUseCases, 'getFoldersByUserId')
        .mockResolvedValue([existingFolder]);

      await expect(
        backupUseCase.updateDeviceAndFolderNameByKey(
          userMocked,
          mockDevice.key,
          updateDeviceDto,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('When device has no associated folder, then it should only update the device name', async () => {
      const mockDevice = newDevice({
        id: 1,
        userId: userMocked.id,
        folderUuid: null,
      });
      const updatedDevice = newDevice({
        ...mockDevice,
        name: updateDeviceDto.name,
      });

      jest
        .spyOn(backupRepository, 'findDeviceByUserAndKey')
        .mockResolvedValue(mockDevice);
      jest
        .spyOn(backupRepository, 'findOneUserDeviceByName')
        .mockResolvedValue(null);
      jest.spyOn(folderUseCases, 'getFoldersByUserId').mockResolvedValue([]);
      jest.spyOn(folderUseCases, 'getByUuid').mockResolvedValue(null);
      jest
        .spyOn(backupRepository, 'updateDeviceName')
        .mockResolvedValue(updatedDevice);

      const result = await backupUseCase.updateDeviceAndFolderNameByKey(
        userMocked,
        mockDevice.key,
        updateDeviceDto,
      );

      expect(result).toEqual(updatedDevice);
      expect(backupRepository.updateDeviceName).toHaveBeenCalledWith(
        userMocked,
        1,
        updateDeviceDto.name,
      );
    });

    it('When device has associated folder, then it should update both device and folder names', async () => {
      const mockFolder = newFolder({
        attributes: { bucket: userMocked.backupsBucket },
      });
      const mockBackupFolder = newBackupFolder(mockFolder);
      const mockDevice = newDevice({
        id: 1,
        userId: userMocked.id,
        folderUuid: mockFolder.uuid,
      });
      const updatedDevice = newDevice({
        ...mockDevice,
        name: updateDeviceDto.name,
      });

      jest
        .spyOn(backupRepository, 'findDeviceByUserAndKey')
        .mockResolvedValue(mockDevice);
      jest
        .spyOn(backupRepository, 'findOneUserDeviceByName')
        .mockResolvedValue(null);
      jest.spyOn(folderUseCases, 'getFoldersByUserId').mockResolvedValue([]);
      jest.spyOn(folderUseCases, 'getByUuid').mockResolvedValue(mockFolder);
      jest
        .spyOn(folderRepository, 'updateOneAndReturn')
        .mockResolvedValue(mockFolder);

      jest
        .spyOn(backupRepository, 'updateDeviceName')
        .mockResolvedValue(updatedDevice);

      const result = await backupUseCase.updateDeviceAndFolderNameByKey(
        userMocked,
        mockDevice.key,
        updateDeviceDto,
      );

      expect(result).toEqual({ ...updatedDevice, folder: mockBackupFolder });
      expect(backupRepository.updateDeviceName).toHaveBeenCalledWith(
        userMocked,
        1,
        updateDeviceDto.name,
      );
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
