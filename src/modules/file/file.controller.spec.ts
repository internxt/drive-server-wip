import { createMock } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  InternalServerErrorException,
  Logger,
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
import { BridgeModule } from './../../externals/bridge/bridge.module';
import { ClientEnum } from '../../common/enums/platform.enum';
import { CreateFileDto } from './dto/create-file.dto';
import { ReplaceFileDto } from './dto/replace-file.dto';
import { StorageNotificationService } from '../../externals/notifications/storage.notifications.service';

describe('FileController', () => {
  let fileController: FileController;
  let fileUseCases: FileUseCases;
  let thumbnailUseCases: ThumbnailUseCases;
  let storageNotificationService: StorageNotificationService;

  let file: File;
  const clientId = ClientEnum.Web;

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
      imports: [BridgeModule, ThumbnailModule],
      controllers: [FileController],
      providers: [FileUseCases, StorageNotificationService],
    })
      .useMocker(() => createMock())
      .setLogger(createMock<Logger>())
      .compile();

    fileController = module.get<FileController>(FileController);
    fileUseCases = module.get<FileUseCases>(FileUseCases);
    thumbnailUseCases = module.get<ThumbnailUseCases>(ThumbnailUseCases);
    storageNotificationService = module.get<StorageNotificationService>(
      StorageNotificationService,
    );
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

      fileController.getRecentFiles(userMocked);

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
      fileUuid: v4(),
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
        'drive-web',
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
        fileController.createThumbnail(
          userMocked,
          createThumbnailDto,
          'drive-web',
        ),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('deleteFileByUuid', () => {
    const uuid = v4();
    const clientId = ClientEnum.Web;
    it('When a valid uuid is provided, then it should return a success response', async () => {
      jest
        .spyOn(fileUseCases, 'deleteFilePermanently')
        .mockResolvedValue({ id: 1234, uuid: file.uuid });
      const result = await fileController.deleteFileByUuid(
        userMocked,
        uuid,
        clientId,
      );
      expect(result).toEqual({ deleted: true });
      expect(fileUseCases.deleteFilePermanently).toHaveBeenCalledWith(
        userMocked,
        { uuid },
      );
    });

    it('When an error occurs during deletion, then it should throw', async () => {
      jest
        .spyOn(fileUseCases, 'deleteFilePermanently')
        .mockRejectedValue(new NotFoundException());
      await expect(
        fileController.deleteFileByUuid(userMocked, uuid, clientId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteFileByFileId', () => {
    const bucketId = 'test-bucket';
    const fileId = 'test-file-id';

    it('when file exists in db, should call usecase and send notification', async () => {
      const deleteResult = {
        fileExistedInDb: true,
        id: 123,
        uuid: 'test-uuid',
      };

      jest
        .spyOn(fileUseCases, 'deleteFileByFileId')
        .mockResolvedValue(deleteResult);
      const storageNotificationSpy = jest.spyOn(
        fileController['storageNotificationService'],
        'fileDeleted',
      );

      await fileController.deleteFileByFileId(
        userMocked,
        bucketId,
        fileId,
        clientId,
      );

      expect(fileUseCases.deleteFileByFileId).toHaveBeenCalledWith(
        userMocked,
        bucketId,
        fileId,
      );
      expect(storageNotificationSpy).toHaveBeenCalledWith({
        payload: { id: deleteResult.id, uuid: deleteResult.uuid },
        user: userMocked,
        clientId,
      });
    });

    it('when file does not exist in db, should call usecase without sending notification', async () => {
      const deleteResult = {
        fileExistedInDb: false,
      };

      jest
        .spyOn(fileUseCases, 'deleteFileByFileId')
        .mockResolvedValue(deleteResult);
      const storageNotificationSpy = jest.spyOn(
        fileController['storageNotificationService'],
        'fileDeleted',
      );

      await fileController.deleteFileByFileId(
        userMocked,
        bucketId,
        fileId,
        clientId,
      );

      expect(fileUseCases.deleteFileByFileId).toHaveBeenCalledWith(
        userMocked,
        bucketId,
        fileId,
      );
      expect(storageNotificationSpy).not.toHaveBeenCalled();
    });

    it('when fileUseCase throws an error, it should be propagated', async () => {
      jest
        .spyOn(fileUseCases, 'deleteFileByFileId')
        .mockRejectedValue(
          new InternalServerErrorException('Error deleting file from network'),
        );

      await expect(
        fileController.deleteFileByFileId(
          userMocked,
          bucketId,
          fileId,
          clientId,
        ),
      ).rejects.toThrow('Error deleting file from network');
    });
  });

  describe('createFile', () => {
    const createFileDto: CreateFileDto = {
      bucket: 'test-bucket',
      fileId: 'file-id',
      encryptVersion: 'v1',
      folderUuid: 'folder-uuid',
      size: BigInt(100),
      plainName: 'test-file.txt',
      type: 'text/plain',
      modificationTime: new Date(),
      date: new Date(),
    };

    it('When createFile is called with valid dto, then it should create file and send notification', async () => {
      const createdFile = newFile({
        attributes: {
          ...createFileDto,
          id: 1,
          userId: userMocked.id,
          uuid: v4(),
          status: FileStatus.EXISTS,
        },
      });

      jest.spyOn(fileUseCases, 'createFile').mockResolvedValue(createdFile);
      jest
        .spyOn(storageNotificationService, 'fileCreated')
        .mockImplementation();

      const result = await fileController.createFile(
        userMocked,
        createFileDto,
        clientId,
      );

      expect(result).toEqual(createdFile);
      expect(fileUseCases.createFile).toHaveBeenCalledWith(
        userMocked,
        createFileDto,
      );
      expect(storageNotificationService.fileCreated).toHaveBeenCalledWith({
        payload: createdFile,
        user: userMocked,
        clientId,
      });
    });

    it('When createFile throws an error, then it should propagate the error', async () => {
      jest
        .spyOn(fileUseCases, 'createFile')
        .mockRejectedValue(new BadRequestException('Invalid folder'));

      await expect(
        fileController.createFile(userMocked, createFileDto, clientId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getFileCount', () => {
    it('When getFileCount is called without status, then it should return drive files count', async () => {
      const count = 42;
      jest.spyOn(fileUseCases, 'getDriveFilesCount').mockResolvedValue(count);

      const result = await fileController.getFileCount(userMocked);

      expect(result).toEqual({ count });
      expect(fileUseCases.getDriveFilesCount).toHaveBeenCalledWith(
        userMocked.id,
      );
    });

    it('When getFileCount is called with orphan status, then it should return orphan files count', async () => {
      const count = 15;
      jest.spyOn(fileUseCases, 'getOrphanFilesCount').mockResolvedValue(count);

      const result = await fileController.getFileCount(userMocked, 'orphan');

      expect(result).toEqual({ count });
      expect(fileUseCases.getOrphanFilesCount).toHaveBeenCalledWith(
        userMocked.id,
      );
    });

    it('When getFileCount is called with trashed status, then it should return trashed files count', async () => {
      const count = 7;
      jest.spyOn(fileUseCases, 'getTrashFilesCount').mockResolvedValue(count);

      const result = await fileController.getFileCount(userMocked, 'trashed');

      expect(result).toEqual({ count });
      expect(fileUseCases.getTrashFilesCount).toHaveBeenCalledWith(
        userMocked.id,
      );
    });

    it('When getFileCount is called with invalid status, then it should throw BadRequestException', async () => {
      await expect(
        fileController.getFileCount(userMocked, 'invalid' as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getFileMetadata', () => {
    const validUuid = v4();

    it('When getFileMetadata is called with valid uuid, then it should return file metadata', async () => {
      const mockFile = newFile({ attributes: { uuid: validUuid } });
      jest.spyOn(fileUseCases, 'getFileMetadata').mockResolvedValue(mockFile);

      const result = await fileController.getFileMetadata(
        userMocked,
        validUuid,
      );

      expect(result).toEqual(mockFile);
      expect(fileUseCases.getFileMetadata).toHaveBeenCalledWith(
        userMocked,
        validUuid,
      );
    });

    it('When getFileMetadata throws NotFoundException, then it should propagate the error', async () => {
      jest
        .spyOn(fileUseCases, 'getFileMetadata')
        .mockRejectedValue(new NotFoundException('File not found'));

      await expect(
        fileController.getFileMetadata(userMocked, validUuid),
      ).rejects.toThrow(NotFoundException);
    });

    it('When getFileMetadata throws unexpected error, then it should log and not throw', async () => {
      const unexpectedError = new Error('Unexpected error');
      jest
        .spyOn(fileUseCases, 'getFileMetadata')
        .mockRejectedValue(unexpectedError);

      const result = await fileController.getFileMetadata(
        userMocked,
        validUuid,
      );

      expect(result).toBeUndefined();
    });
  });

  describe('replaceFile', () => {
    const validUuid = v4();
    const replaceFileDto: ReplaceFileDto = {
      fileId: 'new-file-id',
      size: BigInt(200),
    };

    it('When replaceFile is called with valid data, then it should replace file and send notification', async () => {
      const replacedFile = newFile({
        attributes: {
          uuid: validUuid,
          size: BigInt(100),
          fileId: 'test-file-id',
        },
      });
      jest.spyOn(fileUseCases, 'replaceFile').mockResolvedValue(replacedFile);
      jest
        .spyOn(storageNotificationService, 'fileUpdated')
        .mockImplementation();

      const result = await fileController.replaceFile(
        userMocked,
        validUuid,
        replaceFileDto,
        clientId,
        requester,
      );

      expect(result).toEqual(replacedFile);
      expect(fileUseCases.replaceFile).toHaveBeenCalledWith(
        userMocked,
        validUuid,
        replaceFileDto,
      );
      expect(storageNotificationService.fileUpdated).toHaveBeenCalledWith({
        payload: replacedFile,
        user: requester,
        clientId,
      });
    });

    it('When replaceFile throws an error, then it should log and re-throw the error', async () => {
      const error = new Error('Replace failed');
      jest.spyOn(fileUseCases, 'replaceFile').mockRejectedValue(error);

      await expect(
        fileController.replaceFile(
          userMocked,
          validUuid,
          replaceFileDto,
          clientId,
          requester,
        ),
      ).rejects.toThrow(error);
    });
  });

  describe('getFiles', () => {
    const validLimit = 50;
    const validOffset = 0;

    it('When getFiles is called with valid parameters, then it should return files', async () => {
      const mockFiles = [
        newFile({ attributes: { size: BigInt(100), fileId: 'file-1' } }),
        newFile({ attributes: { size: BigInt(200), fileId: 'file-2' } }),
      ];
      jest
        .spyOn(fileUseCases, 'getNotTrashedFilesUpdatedAfter')
        .mockResolvedValue(mockFiles);

      const result = await fileController.getFiles(
        userMocked,
        validLimit,
        validOffset,
        'EXISTS' as any,
        'test-bucket',
        'name',
        'ASC',
        '2023-01-01T00:00:00.000Z',
      );

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            size: BigInt(100),
            fileId: 'file-1',
          }),
          expect.objectContaining({
            size: BigInt(200),
            fileId: 'file-2',
          }),
        ]),
      );
      expect(fileUseCases.getNotTrashedFilesUpdatedAfter).toHaveBeenCalledWith(
        userMocked.id,
        expect.any(Date),
        expect.objectContaining({
          limit: validLimit,
          offset: validOffset,
          sort: [['name', 'ASC']],
        }),
        'test-bucket',
      );
    });

    it('When getFiles is called with invalid limit (non-number), then it should throw BadRequestException', async () => {
      await expect(
        fileController.getFiles(
          userMocked,
          'invalid' as any,
          validOffset,
          'EXISTS' as any,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('When getFiles is called with invalid offset (non-number), then it should throw BadRequestException', async () => {
      await expect(
        fileController.getFiles(
          userMocked,
          validLimit,
          'invalid' as any,
          'EXISTS' as any,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('When getFiles is called with limit out of range (too low), then it should throw BadRequestParamOutOfRangeException', async () => {
      await expect(
        fileController.getFiles(
          userMocked,
          0, // Below lower bound
          validOffset,
          'EXISTS' as any,
        ),
      ).rejects.toThrow();
    });

    it('When getFiles is called with limit out of range (too high), then it should throw BadRequestParamOutOfRangeException', async () => {
      await expect(
        fileController.getFiles(
          userMocked,
          5001, // Above upper bound assuming default limit is 5000
          validOffset,
          'EXISTS' as any,
        ),
      ).rejects.toThrow();
    });

    it('When getFiles is called with offset out of range (too high), then it should throw BadRequestParamOutOfRangeException', async () => {
      await expect(
        fileController.getFiles(
          userMocked,
          validLimit,
          1000001, // Above upper bound assuming default is 1000000
          'EXISTS' as any,
        ),
      ).rejects.toThrow();
    });

    it('When getFiles is called with ALL status, then it should handle all statuses', async () => {
      const mockFiles = [
        newFile({ attributes: { size: BigInt(100), fileId: 'file-1' } }),
        newFile({ attributes: { size: BigInt(200), fileId: 'file-2' } }),
      ];
      jest
        .spyOn(fileUseCases, 'getAllFilesUpdatedAfter')
        .mockResolvedValue(mockFiles);

      await fileController.getFiles(
        userMocked,
        validLimit,
        validOffset,
        'ALL' as any,
      );

      expect(fileUseCases.getAllFilesUpdatedAfter).toHaveBeenCalledWith(
        userMocked.id,
        expect.any(Date),
        expect.objectContaining({
          limit: validLimit,
          offset: validOffset,
        }),
        undefined,
      );
    });

    it('When getFiles is called with TRASHED status, then it should filter trashed files', async () => {
      const mockFiles = [
        newFile({
          attributes: {
            status: FileStatus.TRASHED,
            size: BigInt(100),
            fileId: 'trashed-file',
          },
        }),
      ];
      jest
        .spyOn(fileUseCases, 'getTrashedFilesUpdatedAfter')
        .mockResolvedValue(mockFiles);

      await fileController.getFiles(
        userMocked,
        validLimit,
        validOffset,
        'TRASHED' as any,
      );

      expect(fileUseCases.getTrashedFilesUpdatedAfter).toHaveBeenCalledWith(
        userMocked.id,
        expect.any(Date),
        expect.objectContaining({
          limit: validLimit,
          offset: validOffset,
        }),
        undefined,
      );
    });

    it('When getFiles is called with invalid updatedAt format, then it should throw BadRequestException', async () => {
      jest
        .spyOn(fileUseCases, 'getNotTrashedFilesUpdatedAfter')
        .mockRejectedValue(new Error('Invalid date'));

      await expect(
        fileController.getFiles(
          userMocked,
          validLimit,
          validOffset,
          'EXISTS' as any,
          undefined,
          undefined,
          undefined,
          'invalid-date',
        ),
      ).rejects.toThrow();
    });
  });
});
