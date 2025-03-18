import { newUser } from './../../../test/fixtures';
import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { BackupController } from './backup.controller';
import { BackupUseCase } from './backup.usecase';
import { NotFoundException, BadRequestException } from '@nestjs/common';

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
    it('When getDeviceAsFolder is called with a valid folderId, then it should return the folder', async () => {
      const mockResponse = { id: 1, name: 'Device Folder' };
      jest
        .spyOn(backupUseCase, 'getDeviceAsFolder')
        .mockResolvedValue(mockResponse as any);

      const result = await backupController.getDeviceAsFolder(userMocked, 1);
      expect(result).toEqual(mockResponse);
    });

    it('When folder is not found, then it should throw a NotFoundException', async () => {
      jest
        .spyOn(backupUseCase, 'getDeviceAsFolder')
        .mockRejectedValue(new NotFoundException());

      await expect(
        backupController.getDeviceAsFolder(userMocked, 1),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateDeviceAsFolder', () => {
    it('When updateDeviceAsFolder is called, then it should return the updated folder', async () => {
      const mockResponse = { id: 1, name: 'Updated Folder' };
      jest
        .spyOn(backupUseCase, 'updateDeviceAsFolder')
        .mockResolvedValue(mockResponse as any);

      const result = await backupController.updateDeviceAsFolder(
        userMocked,
        1,
        { deviceName: 'Updated Folder' },
      );
      expect(result).toEqual(mockResponse);
    });

    it('When folder is not found, then it should throw a NotFoundException', async () => {
      jest
        .spyOn(backupUseCase, 'updateDeviceAsFolder')
        .mockRejectedValue(new NotFoundException());

      await expect(
        backupController.updateDeviceAsFolder(userMocked, 1, {
          deviceName: 'Updated Folder',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
