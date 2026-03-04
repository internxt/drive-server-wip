import { newUser } from './../../../test/fixtures';
import { Test, type TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { BackupController } from './backup.controller';
import { BackupUseCase } from './backup.usecase';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { v4 } from 'uuid';
import { DevicePlatform } from './device.domain';

describe('BackupController', () => {
  let backupController: BackupController;
  let backupUseCase: BackupUseCase;

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
      controllers: [BackupController],
      providers: [BackupUseCase],
    })
      .useMocker(() => createMock())
      .compile();

    backupController = module.get<BackupController>(BackupController);
    backupUseCase = module.get<BackupUseCase>(BackupUseCase);
  });

  describe('activateBackup', () => {
    it('When activateBackup is called, then it should return the backups bucket', async () => {
      const mockResponse = { backupsBucket: 'bucket-id' };
      jest.spyOn(backupUseCase, 'activate').mockResolvedValue(mockResponse);

      const result = await backupController.activateBackup(userMocked);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getDevicesAndFolders', () => {
    it('When is called with filters and pagination params, then it should call usecase with expected values', async () => {
      const query = {
        platform: DevicePlatform.LINUX,
        key: v4(),
        limit: 50,
        offset: 0,
      };
      jest.spyOn(backupUseCase, 'getUserDevices');

      await backupController.getDevicesAndFolders(userMocked, query);

      expect(backupUseCase.getUserDevices).toHaveBeenCalledWith(
        userMocked,
        { platform: query.platform, key: query.key },
        query.limit,
        query.offset,
      );
    });

    it('When no devices are found, then it should return an empty array', async () => {
      jest.spyOn(backupUseCase, 'getUserDevices').mockResolvedValue([]);

      const query = { limit: 50, offset: 0 };

      const result = await backupController.getDevicesAndFolders(
        userMocked,
        query,
      );

      expect(result).toEqual([]);
    });
  });

  describe('createDeviceAsFolder', () => {
    it('When createDeviceAsFolder is called, then it should return the created folder', async () => {
      const mockResponse = { id: 1, name: 'Device Folder' };
      jest
        .spyOn(backupUseCase, 'createDeviceAsFolder')
        .mockResolvedValue(mockResponse as any);

      const result = await backupController.createDeviceAsFolder(userMocked, {
        deviceName: 'Device Folder',
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getDevicesAsFolder', () => {
    it('When getDevicesAsFolder is called, then it should return all devices as folders', async () => {
      const mockResponse = [{ id: 1, name: 'Device Folder' }];
      jest
        .spyOn(backupUseCase, 'getDevicesAsFolder')
        .mockResolvedValue(mockResponse as any);

      const result = await backupController.getDevicesAsFolder(userMocked);
      expect(result).toEqual(mockResponse);
    });

    it('When backups are not activated, then it should throw a BadRequestException', async () => {
      jest
        .spyOn(backupUseCase, 'getDevicesAsFolder')
        .mockRejectedValue(new BadRequestException());

      await expect(
        backupController.getDevicesAsFolder(userMocked),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getDeviceAsFolder', () => {
    it('When getDeviceAsFolder is called with a valid uuid, then it should return the folder', async () => {
      const mockResponse = { uuid: 'folder-uuid', name: 'Device Folder' };
      jest
        .spyOn(backupUseCase, 'getDeviceAsFolder')
        .mockResolvedValue(mockResponse as any);

      const result = await backupController.getDeviceAsFolder(
        userMocked,
        'folder-uuid',
      );
      expect(result).toEqual(mockResponse);
    });

    it('When folder is not found, then it should throw a NotFoundException', async () => {
      jest
        .spyOn(backupUseCase, 'getDeviceAsFolder')
        .mockRejectedValue(new NotFoundException());

      await expect(
        backupController.getDeviceAsFolder(userMocked, 'folder-uuid'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateDeviceAsFolder', () => {
    it('When updateDeviceAsFolder is called, then it should return the updated folder', async () => {
      const mockResponse = { uuid: 'folder-uuid', name: 'Updated Folder' };
      jest
        .spyOn(backupUseCase, 'updateDeviceAsFolder')
        .mockResolvedValue(mockResponse as any);

      const result = await backupController.updateDeviceAsFolder(
        userMocked,
        'folder-uuid',
        { deviceName: 'Updated Folder' },
      );
      expect(result).toEqual(mockResponse);
    });

    it('When folder is not found, then it should throw a NotFoundException', async () => {
      jest
        .spyOn(backupUseCase, 'updateDeviceAsFolder')
        .mockRejectedValue(new NotFoundException());

      await expect(
        backupController.updateDeviceAsFolder(userMocked, 'folder-uuid', {
          deviceName: 'Updated Folder',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getBackupsByMac', () => {
    const mockResponse = {
      id: 1,
      deviceId: 1,
      path: 'add_path',
      interval: 1,
      enabled: true,
      encrypt_version: '03-aes256',
    };
    it('When getBackupsByMac is called, then it should return backups for the device', async () => {
      jest
        .spyOn(backupUseCase, 'getBackupsByMac')
        .mockResolvedValue(mockResponse as any);

      const result = await backupController.getBackupsByMac(
        userMocked,
        'mac-address',
      );
      expect(result).toEqual(mockResponse);
    });

    it('When device is not found, then it should throw a NotFoundException', async () => {
      jest
        .spyOn(backupUseCase, 'getBackupsByMac')
        .mockRejectedValue(new NotFoundException());

      await expect(
        backupController.getBackupsByMac(userMocked, 'mac-address'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAllDevices', () => {
    it('When getAllDevices is called, then it should return all user devices', async () => {
      const mockResponse = [
        { id: 1, name: 'Device 1' },
        { id: 2, name: 'Device 2' },
      ];
      jest
        .spyOn(backupUseCase, 'getAllLegacyDevices')
        .mockResolvedValue(mockResponse as any);

      const result = await backupController.getAllDevices(userMocked);
      expect(result).toEqual(mockResponse);
    });

    it('When no devices are found, then it should return an empty array', async () => {
      const mockResponse = [];
      jest
        .spyOn(backupUseCase, 'getAllLegacyDevices')
        .mockResolvedValue(mockResponse as any);

      const result = await backupController.getAllDevices(userMocked);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('deleteDevice', () => {
    it('When deleteDevice is called with a valid deviceId, then it should return the number of deleted devices', async () => {
      const mockResponse = 1;
      jest.spyOn(backupUseCase, 'deleteDevice').mockResolvedValue(mockResponse);

      const result = await backupController.deleteDevice(userMocked, 1);
      expect(result).toEqual(mockResponse);
    });

    it('When device is not found, then it should throw a NotFoundException', async () => {
      jest
        .spyOn(backupUseCase, 'deleteDevice')
        .mockRejectedValue(new NotFoundException());

      await expect(
        backupController.deleteDevice(userMocked, 1),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteBackup', () => {
    it('When deleteBackup is called, then it should return the number of deleted backups', async () => {
      const mockResponse = 1;
      jest.spyOn(backupUseCase, 'deleteBackup').mockResolvedValue(mockResponse);

      const result = await backupController.deleteBackup(userMocked, 1);
      expect(result).toEqual(mockResponse);
    });

    it('When backup is not found, then it should throw a NotFoundException', async () => {
      jest
        .spyOn(backupUseCase, 'deleteBackup')
        .mockRejectedValue(new NotFoundException());

      await expect(
        backupController.deleteBackup(userMocked, 1),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteDeviceAsFolder', () => {
    it('When deleteDeviceAsFolder is called with a valid uuid, then it should call the usecase method', async () => {
      jest
        .spyOn(backupUseCase, 'deleteDeviceAsFolder')
        .mockResolvedValue(undefined);

      await backupController.deleteDeviceAsFolder(userMocked, 'folder-uuid');

      expect(backupUseCase.deleteDeviceAsFolder).toHaveBeenCalledWith(
        userMocked,
        'folder-uuid',
      );
    });

    it('When folder is not found, then it should throw a NotFoundException', async () => {
      jest
        .spyOn(backupUseCase, 'deleteDeviceAsFolder')
        .mockRejectedValue(new NotFoundException());

      await expect(
        backupController.deleteDeviceAsFolder(userMocked, 'folder-uuid'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
