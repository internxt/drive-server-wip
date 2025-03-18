import { newUser } from './../../../test/fixtures';
import { Test, TestingModule } from '@nestjs/testing';
import { SequelizeBackupRepository } from './backup.repository';
import { DeviceModel } from './models/device.model';
import { BackupModel } from './models/backup.model';
import { createMock } from '@golevelup/ts-jest';
import { getModelToken } from '@nestjs/sequelize';

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
