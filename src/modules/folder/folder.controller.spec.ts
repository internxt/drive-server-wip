import { createMock } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { v4 } from 'uuid';
import { newFile, newFolder } from '../../../test/fixtures';
import { FileUseCases } from '../file/file.usecase';
import {
  BadRequestInvalidOffsetException,
  BadRequestOutOfRangeLimitException,
  FolderController,
} from './folder.controller';
import { Folder } from './folder.domain';
import { FolderUseCases } from './folder.usecase';
import { CalculateFolderSizeTimeoutException } from './exception/calculate-folder-size-timeout.exception';
import { User } from '../user/user.domain';
import { FileStatus } from '../file/file.domain';

describe('FolderController', () => {
  let folderController: FolderController;
  let folderUseCases: FolderUseCases;
  let fileUseCases: FileUseCases;
  let folder: Folder;

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
    uuid: 'uuid',
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
      controllers: [FolderController],
      providers: [
        { provide: FolderUseCases, useValue: createMock() },
        { provide: FileUseCases, useValue: createMock() },
      ],
    }).compile();

    folderController = module.get<FolderController>(FolderController);
    folderUseCases = module.get<FolderUseCases>(FolderUseCases);
    fileUseCases = module.get<FileUseCases>(FileUseCases);
    folder = newFolder();
  });

  describe('get folder size', () => {
    it('When get folder size is requested, then return the folder size', async () => {
      const expectedSize = 100;
      jest
        .spyOn(folderUseCases, 'getFolderSizeByUuid')
        .mockResolvedValue(expectedSize);

      const result = await folderController.getFolderSize(folder.uuid);
      expect(result).toEqual({ size: expectedSize });
    });

    it('When get folder size times out, then throw an exception', async () => {
      jest
        .spyOn(folderUseCases, 'getFolderSizeByUuid')
        .mockRejectedValue(new CalculateFolderSizeTimeoutException());

      await expect(folderController.getFolderSize(folder.uuid)).rejects.toThrow(
        CalculateFolderSizeTimeoutException,
      );
    });
  });

  describe('get folder content', () => {
    it('When get folder subfiles are requested by folder uuid, then the child files are returned', async () => {
      const expectedSubfiles = [
        newFile({ attributes: { id: 1, folderUuid: folder.uuid } }),
        newFile({ attributes: { id: 2, folderUuid: folder.uuid } }),
        newFile({ attributes: { id: 3, folderUuid: folder.uuid } }),
      ];
      jest.spyOn(fileUseCases, 'getFiles').mockResolvedValue(expectedSubfiles);

      const result = await folderController.getFolderContentFiles(
        userMocked,
        folder.uuid,
        50,
        0,
        'id',
        'ASC',
      );
      expect(result).toEqual({ files: expectedSubfiles });
    });

    it('When get folder subfolders are requested by folder uuid, then the child folders are returned', async () => {
      const expectedSubfolders = [
        newFolder({ attributes: { id: 1, parentUuid: folder.uuid } }),
        newFolder({ attributes: { id: 2, parentUuid: folder.uuid } }),
        newFolder({ attributes: { id: 3, parentUuid: folder.uuid } }),
      ];
      const mappedSubfolders = expectedSubfolders.map((f) => {
        let folderStatus: FileStatus;
        if (f.removed) {
          folderStatus = FileStatus.DELETED;
        } else if (f.deleted) {
          folderStatus = FileStatus.TRASHED;
        } else {
          folderStatus = FileStatus.EXISTS;
        }
        return { ...f, status: folderStatus };
      });

      jest
        .spyOn(folderUseCases, 'getFolders')
        .mockResolvedValue(expectedSubfolders);

      const result = await folderController.getFolderContentFolders(
        userMocked,
        folder.uuid,
        50,
        0,
        'id',
        'ASC',
      );

      expect(result).toEqual({ folders: mappedSubfolders });
    });

    it('When get folder subfiles are requested by invalid params, then it should throw an error', () => {
      expect(
        folderController.getFolderContentFiles(
          userMocked,
          'invalidUUID',
          50,
          0,
          'id',
          'ASC',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(
        folderController.getFolderContentFiles(
          userMocked,
          folder.uuid,
          0,
          0,
          'id',
          'ASC',
        ),
      ).rejects.toThrow(BadRequestOutOfRangeLimitException);

      expect(
        folderController.getFolderContentFiles(
          userMocked,
          folder.uuid,
          51,
          0,
          'id',
          'ASC',
        ),
      ).rejects.toThrow(BadRequestOutOfRangeLimitException);

      expect(
        folderController.getFolderContentFiles(
          userMocked,
          folder.uuid,
          50,
          -1,
          'id',
          'ASC',
        ),
      ).rejects.toThrow(BadRequestInvalidOffsetException);
    });

    it('When get folder subfolders are requested by invalid folder uuid, then it should throw an error', async () => {
      expect(
        folderController.getFolderContentFolders(
          userMocked,
          'invalidUUID',
          50,
          0,
          'id',
          'ASC',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(
        folderController.getFolderContentFolders(
          userMocked,
          folder.uuid,
          0,
          0,
          'id',
          'ASC',
        ),
      ).rejects.toThrow(BadRequestOutOfRangeLimitException);

      expect(
        folderController.getFolderContentFolders(
          userMocked,
          folder.uuid,
          51,
          0,
          'id',
          'ASC',
        ),
      ).rejects.toThrow(BadRequestOutOfRangeLimitException);

      expect(
        folderController.getFolderContentFolders(
          userMocked,
          folder.uuid,
          50,
          -1,
          'id',
          'ASC',
        ),
      ).rejects.toThrow(BadRequestInvalidOffsetException);
    });
  });

  describe('move folder', () => {
    it('When move folder is requested with valid params, then the folder is returned with its updated properties', async () => {
      const destinationFolder = newFolder();
      const expectedFolder = newFolder({
        attributes: {
          ...folder,
          parentUuid: destinationFolder.uuid,
          parentId: destinationFolder.parentId,
        },
      });

      jest
        .spyOn(folderUseCases, 'moveFolder')
        .mockResolvedValue(expectedFolder);

      const result = await folderController.moveFolder(
        userMocked,
        folder.uuid,
        { destinationFolder: destinationFolder.uuid },
      );
      expect(result).toEqual(expectedFolder);
    });

    it('When move folder is requested with invalid params, then it should throw an error', () => {
      expect(
        folderController.moveFolder(userMocked, 'invaliduuid', {
          destinationFolder: v4(),
        }),
      ).rejects.toThrow(BadRequestException);

      expect(
        folderController.moveFolder(userMocked, v4(), {
          destinationFolder: 'invaliduuid',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
