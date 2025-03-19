import { createMock } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { v4 } from 'uuid';
import { newFile, newFolder, newUser } from '../../../test/fixtures';
import { FileUseCases } from './file.usecase';
import { User } from '../user/user.domain';
import { File, FileStatus } from './file.domain';
import { FileController } from './file.controller';
import API_LIMITS from '../../lib/http/limits';
import { UpdateFileMetaDto } from './dto/update-file-meta.dto';
import { ThumbnailUseCases } from '../thumbnail/thumbnail.usecase';
import { ThumbnailDto } from '../thumbnail/dto/thumbnail.dto';
import { CreateThumbnailDto } from '../thumbnail/dto/create-thumbnail.dto';
import { ThumbnailModule } from '../thumbnail/thumbnail.module';

describe('FileController', () => {
  let fileController: FileController;
  let fileUseCases: FileUseCases;
  let thumbnailUseCases: ThumbnailUseCases;
  let file: File;
  const clientId = 'drive-web';

  const requester = newUser();

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
      controllers: [FileController, ThumbnailModule],
      providers: [FileUseCases],
    })
      .useMocker(() => createMock())
      .compile();

    fileController = module.get<FileController>(FileController);
    fileUseCases = module.get<FileUseCases>(FileUseCases);
    thumbnailUseCases = module.get<ThumbnailUseCases>(ThumbnailUseCases);
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
        requester,
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
          requester,
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
          requester,
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
          requester,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        fileController.updateFileMetadata(
          userMocked,
          newFile().uuid,
          undefined,
          clientId,
          requester,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        fileController.updateFileMetadata(
          userMocked,
          newFile().uuid,
          {},
          clientId,
          requester,
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
        requester,
      );
      expect(result).toEqual(expectedFile);
    });
  });

  describe('createThumbnail', () => {
    const createThumbnailDto: CreateThumbnailDto = {
      fileId: 1882,
      maxWidth: 300,
      maxHeight: 300,
      type: 'png',
      size: 19658,
      bucketId: '32fb049a85f433f5079cd72e',
      bucketFile: '67d02d2c52b2da002bf29f8a',
      encryptVersion: '03-aes',
    };
    const thumbnailDto: ThumbnailDto = {
      id: 1,
      ...createThumbnailDto,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    it('When a valid CreateThumbnailDto is provided, then it should return a ThumbnailDto', async () => {
      jest
        .spyOn(thumbnailUseCases, 'createThumbnail')
        .mockResolvedValue(thumbnailDto);
      const result = await fileController.createThumbnail(
        userMocked,
        createThumbnailDto,
      );
      expect(result).toEqual(thumbnailDto);
      expect(thumbnailUseCases.createThumbnail).toHaveBeenCalledWith(
        userMocked,
        createThumbnailDto,
      );
    });

    it('When an error occurs during thumbnail creation, then it should throw', async () => {
      jest
        .spyOn(thumbnailUseCases, 'createThumbnail')
        .mockRejectedValue(new InternalServerErrorException());
      await expect(
        fileController.createThumbnail(userMocked, createThumbnailDto),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });
});
