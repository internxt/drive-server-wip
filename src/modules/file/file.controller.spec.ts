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
import { UpdateFileMetaDto } from './dto/update-file-meta.dto';

describe('FileController', () => {
  let fileController: FileController;
  let fileUseCases: FileUseCases;
  let file: File;
  const clientId = 'drive-web';

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
    file = newFile();
  });

  describe('move file', () => {
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

  describe('get file by path', () => {
    it('When get file metadata by path is requested with a valid path, then the file is returned', async () => {
      const expectedFile = newFile();
      const filePath = '/test/file.png';
      jest
        .spyOn(fileUseCases, 'getFileMetadataByPath')
        .mockResolvedValue(expectedFile);

      const result = await fileController.getFileMetaByPath(
        userMocked,
        filePath,
      );
      expect(result).toEqual(expectedFile);
    });

    it('When get folder metadata by path is requested with a valid path that not exists, then it should throw a not found error', async () => {
      const filePath = '/test/file.png';
      jest.spyOn(fileUseCases, 'getFileMetadataByPath').mockResolvedValue(null);

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
    });

    it('When get file metadata by path is requested with a path deep > 20, then it should throw an error', () => {
      const longPath =
        '/' +
        Array.from({ length: 21 }, (_, i) => `folder${i}`).join('/') +
        '/file.test';

      expect(
        fileController.getFileMetaByPath(userMocked, longPath),
      ).rejects.toThrow('Path is too deep');
    });
  });

  describe('update File MetaData by uuid', () => {
    it('When updateFileMetadata is missing properties, then it should fail', async () => {
      await expect(
        fileController.updateFileMetadata(
          userMocked,
          newFile().uuid,
          null,
          clientId,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        fileController.updateFileMetadata(
          userMocked,
          newFile().uuid,
          undefined,
          clientId,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        fileController.updateFileMetadata(
          userMocked,
          newFile().uuid,
          {},
          clientId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('When updateFileMetadata is requested with valid properties, then it should update the file', async () => {
      const mockFile = newFile();
      const newMetadataInfo: UpdateFileMetaDto = {
        plainName: 'test',
        type: 'png',
      };

      const expectedFile = {
        ...mockFile,
        ...newMetadataInfo,
      };

      jest
        .spyOn(fileUseCases, 'updateFileMetaData')
        .mockResolvedValue(expectedFile);

      const result = await fileController.updateFileMetadata(
        userMocked,
        mockFile.uuid,
        newMetadataInfo,
        clientId,
      );
      expect(result).toEqual(expectedFile);
    });
  });
});
