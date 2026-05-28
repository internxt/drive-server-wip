import { newUser } from '../../../../test/fixtures';
import { Test, type TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { PhotosController } from './photos.controller';
import { BackupUseCase } from '../backup.usecase';
import { v4 } from 'uuid';

describe('PhotosController', () => {
  let controller: PhotosController;
  let backupUseCase: BackupUseCase;

  const user = newUser();
  const uuid = v4();
  const deviceFolder = { uuid, plainName: 'My Phone' } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PhotosController],
      providers: [BackupUseCase],
    })
      .useMocker(() => createMock())
      .compile();

    controller = module.get(PhotosController);
    backupUseCase = module.get(BackupUseCase);
  });

  describe('createPhotoDeviceAsFolder', () => {
    it('When createPhotoDeviceAsFolder is called, then it should return the created device folder', async () => {
      jest
        .spyOn(backupUseCase, 'createPhotoDeviceAsFolder')
        .mockResolvedValue(deviceFolder);

      const result = await controller.createPhotoDeviceAsFolder(user, {
        deviceName: 'My Phone',
      });

      expect(backupUseCase.createPhotoDeviceAsFolder).toHaveBeenCalledWith(
        user,
        'My Phone',
      );
      expect(result).toEqual(deviceFolder);
    });
  });

  describe('getPhotoDevicesAsFolder', () => {
    it('When getPhotoDevicesAsFolder is called, then it should return all photo devices', async () => {
      jest
        .spyOn(backupUseCase, 'getPhotoDevicesAsFolder')
        .mockResolvedValue([deviceFolder]);

      const result = await controller.getPhotoDevicesAsFolder(user);

      expect(backupUseCase.getPhotoDevicesAsFolder).toHaveBeenCalledWith(user);
      expect(result).toEqual([deviceFolder]);
    });
  });

  describe('getPhotoDeviceAsFolder', () => {
    it('When getPhotoDeviceAsFolder is called with uuid, then it should return the matching device', async () => {
      jest
        .spyOn(backupUseCase, 'getPhotoDeviceAsFolder')
        .mockResolvedValue(deviceFolder);

      const result = await controller.getPhotoDeviceAsFolder(user, uuid);

      expect(backupUseCase.getPhotoDeviceAsFolder).toHaveBeenCalledWith(
        user,
        uuid,
      );
      expect(result).toEqual(deviceFolder);
    });
  });

  describe('deletePhotoDeviceAsFolder', () => {
    it('When deletePhotoDeviceAsFolder is called, then it should delete the device folder', async () => {
      jest
        .spyOn(backupUseCase, 'deletePhotoDeviceAsFolder')
        .mockResolvedValue(undefined);

      await controller.deletePhotoDeviceAsFolder(user, uuid);

      expect(backupUseCase.deletePhotoDeviceAsFolder).toHaveBeenCalledWith(
        user,
        uuid,
      );
    });
  });

  describe('updatePhotoDeviceAsFolder', () => {
    it('When updatePhotoDeviceAsFolder is called, then it should return the updated device folder', async () => {
      const updated = { ...deviceFolder, plainName: 'New Name' } as any;
      jest
        .spyOn(backupUseCase, 'updatePhotoDeviceAsFolder')
        .mockResolvedValue(updated);

      const result = await controller.updatePhotoDeviceAsFolder(user, uuid, {
        deviceName: 'New Name',
      });

      expect(backupUseCase.updatePhotoDeviceAsFolder).toHaveBeenCalledWith(
        user,
        uuid,
        'New Name',
      );
      expect(result).toEqual(updated);
    });
  });
});
