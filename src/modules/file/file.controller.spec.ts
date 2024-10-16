import { createMock } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { v4 } from 'uuid';
import { newFile, newFolder } from '../../../test/fixtures';
import { FileUseCases } from './file.usecase';
import { User } from '../user/user.domain';
import { File, FileStatus } from './file.domain';
import { FileController } from './file.controller';
import API_LIMITS from '../../lib/http/limits';
import { FolderUseCases } from '../folder/folder.usecase';

describe('FileController', () => {
  let fileController: FileController;
  let fileUseCases: FileUseCases;
  let folderUseCases: FolderUseCases;
  let file: File;

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
      controllers: [FileController],
      providers: [FileUseCases],
    })
      .useMocker(() => createMock())
      .compile();

    fileController = module.get<FileController>(FileController);
    fileUseCases = module.get<FileUseCases>(FileUseCases);
    folderUseCases = module.get<FolderUseCases>(FolderUseCases);
    file = newFile();
  });

  describe('move file', () => {
    const clientId = 'drive-web';
    it('When move file is requested with valid params, then the file is returned with its updated properties', async () => {
      const destinationFolder = newFolder();
      const expectedFile = newFile({
        attributes: {
          ...file,
          name: 'newencrypted-' + file.name,
          folderId: destinationFolder.id,
          folderUuid: destinationFolder.uuid,
          status: FileStatus.EXISTS,
        },
      });

      jest.spyOn(fileUseCases, 'moveFile').mockResolvedValue(expectedFile);

      const result = await fileController.moveFile(
        userMocked,
        file.uuid,
        {
          destinationFolder: destinationFolder.uuid,
        },
        clientId,
      );
      expect(result).toEqual(expectedFile);
    });

    it('When move file is requested with invalid params, then it should throw an error', () => {
      expect(
        fileController.moveFile(
          userMocked,
          'invaliduuid',
          {
            destinationFolder: v4(),
          },
          clientId,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(
        fileController.moveFile(
          userMocked,
          v4(),
          {
            destinationFolder: 'invaliduuid',
          },
          clientId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getRecentFiles', () => {
    it('When getRecentFiles is requested with valid params, then it should return the recent files', async () => {
      const limit = 10;
      const files = [
        newFile({ owner: userMocked }),
        newFile({ owner: userMocked }),
      ];
      jest.spyOn(fileUseCases, 'getFiles').mockResolvedValue(files);

      const result = await fileController.getRecentFiles(userMocked, limit);
      expect(result).toEqual(files);
      expect(fileUseCases.getFiles).toHaveBeenCalledWith(
        userMocked.id,
        {
          status: FileStatus.EXISTS,
        },
        {
          limit,
          offset: 0,
          sort: [['updatedAt', 'DESC']],
        },
      );
    });

    it('When getRecentFiles is requested with no limit, then it should use upper bound limit', () => {
      const files = [
        newFile({ owner: userMocked }),
        newFile({ owner: userMocked }),
      ];

      jest.spyOn(fileUseCases, 'getFiles').mockResolvedValue(files);

      fileController.getRecentFiles(userMocked, undefined);

      expect(fileUseCases.getFiles).toHaveBeenCalledWith(
        userMocked.id,
        {
          status: FileStatus.EXISTS,
        },
        {
          limit: API_LIMITS.FILES.GET.LIMIT.UPPER_BOUND,
          offset: 0,
          sort: [['updatedAt', 'DESC']],
        },
      );
    });
  });

  describe.only('get file by path', () => {
    it('When get file metadata by path is requested with a valid path, then the file is returned', async () => {
      const expectedFile = newFile();
      const rootFolder = newFolder();
      const parentFolderFile = newFolder();
      const filePath = Buffer.from('/test/file.png', 'utf-8').toString(
        'base64',
      );
      jest
        .spyOn(folderUseCases, 'getFolderByUserId')
        .mockResolvedValue(rootFolder);
      jest
        .spyOn(folderUseCases, 'getFolderByPath')
        .mockResolvedValue(parentFolderFile);
      jest
        .spyOn(fileUseCases, 'findByNameAndFolderUuid')
        .mockResolvedValue(expectedFile);

      const result = await fileController.getFileMetaByPath(
        userMocked,
        filePath,
      );
      expect(result).toEqual(expectedFile);
    });

    it('When get file metadata by path is requested with a valid path that not exists, then it should throw a not found error', async () => {
      const filePath = Buffer.from('/test/file.png', 'utf-8').toString(
        'base64',
      );
      jest.spyOn(folderUseCases, 'getFolderByUserId').mockResolvedValue(null);

      expect(
        fileController.getFileMetaByPath(userMocked, filePath),
      ).rejects.toThrow(NotFoundException);
    });

    it('When get file metadata by path is requested with a valid path that not exists, then it should throw a not found error', async () => {
      const rootFolder = newFolder();
      const filePath = Buffer.from('/test/file.png', 'utf-8').toString(
        'base64',
      );
      jest
        .spyOn(folderUseCases, 'getFolderByUserId')
        .mockResolvedValue(rootFolder);
      jest.spyOn(folderUseCases, 'getFolderByPath').mockResolvedValue(null);

      expect(
        fileController.getFileMetaByPath(userMocked, filePath),
      ).rejects.toThrow(NotFoundException);
    });

    it('When get file metadata by path is requested with a valid path that not exists, then it should throw a not found error', async () => {
      const rootFolder = newFolder();
      const parentFolderFile = newFolder();
      const filePath = Buffer.from('/test/file.png', 'utf-8').toString(
        'base64',
      );
      jest
        .spyOn(folderUseCases, 'getFolderByUserId')
        .mockResolvedValue(rootFolder);
      jest
        .spyOn(folderUseCases, 'getFolderByPath')
        .mockResolvedValue(parentFolderFile);
      jest
        .spyOn(fileUseCases, 'findByNameAndFolderUuid')
        .mockResolvedValue(null);

      expect(
        fileController.getFileMetaByPath(userMocked, filePath),
      ).rejects.toThrow(NotFoundException);
    });

    it('When get file metadata by path is requested with an invalid path, then it should throw an error', () => {
      expect(
        fileController.getFileMetaByPath(userMocked, 'invalidpath'),
      ).rejects.toThrow(BadRequestException);

      expect(fileController.getFileMetaByPath(userMocked, '')).rejects.toThrow(
        BadRequestException,
      );

      expect(
        fileController.getFileMetaByPath(userMocked, '/path/notBase64Encoded'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
