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

  describe('getFilesInFolders', () => {
    it('When updatedAt is provided, then it should use it as the filter date', async () => {
      const page = { files: [{ uuid: v4() }], nextCursor: null } as any;
      jest.spyOn(backupUseCase, 'getFilesInFolders').mockResolvedValue(page);
      const updatedAt = '2024-01-01T00:00:00.000Z';
      const folderUuids = [uuid];

      const result = await controller.getFilesInFolders(user, {
        folderUuids,
        updatedAt,
      });

      expect(backupUseCase.getFilesInFolders).toHaveBeenCalledWith(
        user,
        folderUuids,
        new Date(updatedAt),
        undefined,
      );
      expect(result).toEqual(page);
    });

    it('When updatedAt is not provided, then it should default to epoch', async () => {
      const page = { files: [], nextCursor: null } as any;
      jest.spyOn(backupUseCase, 'getFilesInFolders').mockResolvedValue(page);
      const folderUuids = [uuid];

      await controller.getFilesInFolders(user, { folderUuids });

      expect(backupUseCase.getFilesInFolders).toHaveBeenCalledWith(
        user,
        folderUuids,
        new Date(0),
        undefined,
      );
    });

    it('When cursor is provided, then it should forward it to the usecase', async () => {
      const page = { files: [], nextCursor: null } as any;
      jest.spyOn(backupUseCase, 'getFilesInFolders').mockResolvedValue(page);
      const cursor = 'some-cursor-token';
      const folderUuids = [uuid];

      await controller.getFilesInFolders(user, { folderUuids, cursor });

      expect(backupUseCase.getFilesInFolders).toHaveBeenCalledWith(
        user,
        folderUuids,
        new Date(0),
        cursor,
      );
    });
  });
});
