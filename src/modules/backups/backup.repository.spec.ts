import { newUser } from './../../../test/fixtures';
import { Test, type TestingModule } from '@nestjs/testing';
import { SequelizeBackupRepository } from './backup.repository';
import { DeviceModel } from './models/device.model';
import { BackupModel } from './models/backup.model';
import { createMock } from '@golevelup/ts-jest';
import { getModelToken } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize';

describe('SequelizeBackupRepository', () => {
  let repository: SequelizeBackupRepository;
  let deviceModel: typeof DeviceModel;
  let backupModel: typeof BackupModel;

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
      providers: [SequelizeBackupRepository],
    })
      .useMocker(() => createMock())
      .compile();

    repository = module.get<SequelizeBackupRepository>(
      SequelizeBackupRepository,
    );
    deviceModel = module.get<typeof DeviceModel>(getModelToken(DeviceModel));
    backupModel = module.get<typeof BackupModel>(getModelToken(BackupModel));
  });

  describe('deleteDevicesBy', () => {
    it('When deleteDevicesBy is called, then it should delete', async () => {
      jest.spyOn(deviceModel, 'destroy').mockResolvedValue(1);

      const result = await repository.deleteDevicesBy({
        userId: userMocked.id,
      });
      expect(result).toBe(1);
      expect(deviceModel.destroy).toHaveBeenCalledWith({
        where: { userId: userMocked.id },
      });
    });

    it('When no devices match the criteria, then it should return 0', async () => {
      jest.spyOn(deviceModel, 'destroy').mockResolvedValue(0);

      const result = await repository.deleteDevicesBy({ userId: 999 });
      expect(result).toBe(0);
      expect(deviceModel.destroy).toHaveBeenCalledWith({
        where: { userId: 999 },
      });
    });
  });

  describe('deleteBackupsBy', () => {
    it('When deleteBackupsBy is called, then it should delete', async () => {
      jest.spyOn(backupModel, 'destroy').mockResolvedValue(1);

      const result = await repository.deleteBackupsBy({
        userId: userMocked.id,
      });
      expect(result).toBe(1);
      expect(backupModel.destroy).toHaveBeenCalledWith({
        where: { userId: userMocked.id },
      });
    });

    it('When no backups match the criteria, then it should return 0', async () => {
      jest.spyOn(backupModel, 'destroy').mockResolvedValue(0);

      const result = await repository.deleteBackupsBy({ userId: 999 });
      expect(result).toBe(0);
      expect(backupModel.destroy).toHaveBeenCalledWith({
        where: { userId: 999 },
      });
    });
  });

  describe('findDeviceByUserAndMac', () => {
    it('When a device exists, then it should return the device', async () => {
      const mockDevice = {
        id: 1,
        name: 'Device 1',
        mac: 'mac-address',
        platform: 'linux',
      };
      jest
        .spyOn(deviceModel, 'findOne')
        .mockResolvedValue({ ...mockDevice, toJSON: () => mockDevice } as any);

      const result = await repository.findDeviceByUserAndMac(
        userMocked,
        'mac-address',
      );
      expect(result).toEqual(expect.objectContaining(mockDevice));
    });

    it('When a device does not exist, then it should return null', async () => {
      jest.spyOn(deviceModel, 'findOne').mockResolvedValue(null);

      const result = await repository.findDeviceByUserAndMac(
        userMocked,
        'mac-address',
      );
      expect(result).toBeNull();
    });
  });

  describe('findAllLegacyDevices', () => {
    it('When no devices exist for the user, then it should return an empty array', async () => {
      jest.spyOn(deviceModel, 'findAll').mockResolvedValue([]);

      const result = await repository.findAllLegacyDevices(userMocked);
      expect(result).toEqual([]);
    });

    it('When findAllDevfindAllLegacyDevicesices is called, then it should return all devices with aggregated backup size', async () => {
      const mockDevice = {
        id: 1,
        name: 'Device 1',
        mac: 'mac-address',
        platform: 'linux',
        backups: [
          { size: 100, toJSON: () => ({ size: 100 }) },
          { size: 200, toJSON: () => ({ size: 200 }) },
        ],
        toJSON: () => mockDevice,
      };
      jest.spyOn(deviceModel, 'findAll').mockResolvedValue([mockDevice] as any);

      const result = await repository.findAllLegacyDevices(userMocked);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 1,
        name: 'Device 1',
        backups: [{ size: 100 }, { size: 200 }],
      });
    });
  });

  describe('findDeviceByUserAndId', () => {
    it('When a device does not exist, then it should return null', async () => {
      jest.spyOn(deviceModel, 'findOne').mockResolvedValue(null);

      const result = await repository.findDeviceByUserAndId(userMocked, 1);
      expect(result).toBeNull();
    });

    it('When findDeviceByUserAndId is called, then it should return the device with its backups', async () => {
      const mockDevice = {
        id: 1,
        name: 'Device 1',
        mac: 'mac-address',
        platform: 'linux',
        backups: [
          { id: 1, path: 'path1', toJSON: () => ({ id: 1, path: 'path1' }) },
        ],
        toJSON: () => mockDevice,
      };
      jest.spyOn(deviceModel, 'findOne').mockResolvedValue(mockDevice as any);

      const result = await repository.findDeviceByUserAndId(userMocked, 1);
      expect(result).toMatchObject({
        id: 1,
        name: 'Device 1',
        backups: [{ id: 1, path: 'path1' }],
      });
    });
  });

  describe('findAllBackupsByUserAndDevice', () => {
    it('When findAllBackupsByUserAndDevice is called, then it should return all backups for the device', async () => {
      const backup1 = {
        id: 1,
        deviceId: 1,
        path: 'add_path',
        interval: 1,
        enabled: true,
        encrypt_version: '03-aes256',
      };
      const backup2 = {
        id: 2,
        deviceId: 1,
        path: 'add_path_2',
        interval: 2,
        enabled: false,
        encrypt_version: '03-aes256',
      };
      const mockBackups = [
        { ...backup1, toJSON: () => backup1 },
        { ...backup2, toJSON: () => backup2 },
      ];
      jest.spyOn(backupModel, 'findAll').mockResolvedValue(mockBackups as any);

      const result = await repository.findAllBackupsByUserAndDevice(
        userMocked,
        1,
      );
      expect(result).toEqual(expect.arrayContaining([backup1, backup2]));
    });

    it('When no backups exist for the device, then it should return an empty array', async () => {
      jest.spyOn(backupModel, 'findAll').mockResolvedValue([]);

      const result = await repository.findAllBackupsByUserAndDevice(
        userMocked,
        999,
      );
      expect(result).toEqual([]);
    });
  });

  describe('findBackupByUserAndId', () => {
    it('When a backup exists, then it should return the backup', async () => {
      const mockBackup = {
        id: 1,
        deviceId: 1,
        path: 'add_path',
        interval: 1,
        enabled: true,
        encrypt_version: '03-aes256',
      };
      jest.spyOn(backupModel, 'findOne').mockResolvedValue({
        ...mockBackup,
        toJSON: () => mockBackup,
      } as any);

      const result = await repository.findBackupByUserAndId(userMocked, 1);
      expect(result).toEqual(expect.objectContaining(mockBackup));
    });

    it('When a backup does not exist, then it should return null', async () => {
      jest.spyOn(backupModel, 'findOne').mockResolvedValue(null);

      const result = await repository.findBackupByUserAndId(userMocked, 1);
      expect(result).toBeNull();
    });
  });

  describe('deleteBackupByUserAndId', () => {
    it('When deleteBackupByUserAndId is called, then it should delete the backup', async () => {
      jest.spyOn(backupModel, 'destroy').mockResolvedValue(1);

      const result = await repository.deleteBackupByUserAndId(userMocked, 1);
      expect(result).toBe(1);
      expect(backupModel.destroy).toHaveBeenCalledWith({
        where: { userId: userMocked.id, id: 1 },
      });
    });

    it('When deleteBackupByUserAndId is called with an invalid ID, then it should return 0', async () => {
      jest.spyOn(backupModel, 'destroy').mockResolvedValue(0);

      const result = await repository.deleteBackupByUserAndId(userMocked, 999);
      expect(result).toBe(0);
      expect(backupModel.destroy).toHaveBeenCalledWith({
        where: { userId: userMocked.id, id: 999 },
      });
    });
  });

  describe('sumExistentBackupSizes', () => {
    it('When sumExistentBackupSizes is called, then it should return the sum of the backup sizes', async () => {
      const totalSize = 1024;
      const sizesSum = [{ total: totalSize }];

      jest.spyOn(backupModel, 'findAll').mockResolvedValueOnce(sizesSum as any);

      const result = await repository.sumExistentBackupSizes(userMocked.id);

      expect(backupModel.findAll).toHaveBeenCalledWith({
        attributes: [[Sequelize.fn(`SUM`, Sequelize.col('size')), 'total']],
        where: { userId: userMocked.id },
        raw: true,
      });
      expect(result).toBe(totalSize);
    });
  });

  describe('toDomainDevice', () => {
    const deviceModelMock = {
      toJSON: jest.fn().mockReturnValue({
        id: 1,
        name: 'Device 1',
        backups: [{ id: 1, path: 'add_path_here' }],
      }),
      backups: [
        {
          toJSON: jest.fn().mockReturnValue({ id: 1, path: 'add_path_here' }),
        },
      ],
    } as unknown as DeviceModel;
    it('When toDomainDevice is called with a device model, then it should return', () => {
      const result = (repository as any).toDomainDevice(deviceModelMock);

      expect(result).toEqual(
        expect.objectContaining({
          id: 1,
          name: 'Device 1',
          backups: [
            expect.objectContaining({
              id: 1,
              path: 'add_path_here',
            }),
          ],
        }),
      );
    });

    it('When toDomainDevice is called with a device model without backups, then it should return with an empty backups array', () => {
      deviceModelMock.backups = [];
      const result = (repository as any).toDomainDevice(deviceModelMock);

      expect(result).toEqual(
        expect.objectContaining({
          id: 1,
          name: 'Device 1',
          backups: [],
        }),
      );
    });
  });

  describe('toDomainBackup', () => {
    it('When toDomainBackup is called with a backup model, then it should return', () => {
      const backupModelMock = {
        toJSON: jest.fn().mockReturnValue({
          id: 1,
          path: 'add_path_here',
        }),
      } as unknown as BackupModel;

      const result = (repository as any).toDomainBackup(backupModelMock);

      expect(result).toEqual(
        expect.objectContaining({
          id: 1,
          path: 'add_path_here',
        }),
      );
    });
  });
});
