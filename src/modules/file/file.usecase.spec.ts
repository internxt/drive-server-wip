import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { FileUseCases, VersionableFileExtension } from './file.usecase';
import { SequelizeFileRepository, FileRepository } from './file.repository';
import { SequelizeFileVersionRepository } from './file-version.repository';
import { FileVersion, FileVersionStatus } from './file-version.domain';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PaymentRequiredException } from '../feature-limit/exceptions/payment-required.exception';
import {
  File,
  FileAttributes,
  FileStatus,
  SortableFileAttributes,
} from './file.domain';
import { User } from '../user/user.domain';
import { CryptoModule } from '../../externals/crypto/crypto.module';
import { CryptoService } from '../../externals/crypto/crypto.service';
import { BridgeService } from '../../externals/bridge/bridge.service';
import {
  newFile,
  newFileVersion,
  newFolder,
  newUser,
  newWorkspace,
  newUsage,
  newVersioningLimits,
  newFeatureLimit,
} from '../../../test/fixtures';
import { FolderUseCases } from '../folder/folder.usecase';
import { v4 } from 'uuid';
import { SharingService } from '../sharing/sharing.service';
import { SharingItemType } from '../sharing/sharing.domain';
import { CreateFileDto } from './dto/create-file.dto';
import { UpdateFileMetaDto } from './dto/update-file-meta.dto';
import { ThumbnailUseCases } from '../thumbnail/thumbnail.usecase';
import { UsageService } from '../usage/usage.service';
import { Time } from '../../lib/time';
import { MailerService } from '../../externals/mailer/mailer.service';
import { FeatureLimitService } from '../feature-limit/feature-limit.service';
import { Tier } from '../feature-limit/domain/tier.domain';
import { LimitLabels, LimitTypes } from '../feature-limit/limits.enum';
import { RedisService } from '../../externals/redis/redis.service';
import { UserUseCases } from '../user/user.usecase';
import { TrashUseCases } from '../trash/trash.usecase';
import { TrashItemType } from '../trash/trash.attributes';
import { CacheManagerService } from '../cache-manager/cache-manager.service';

const fileId = '6295c99a241bb000083f1c6a';
const userId = 1;
const folderId = 4;

describe('FileUseCases', () => {
  let service: FileUseCases;
  let folderUseCases: FolderUseCases;
  let fileRepository: FileRepository;
  let fileVersionRepository: SequelizeFileVersionRepository;
  let sharingService: SharingService;
  let bridgeService: BridgeService;
  let cryptoService: CryptoService;
  let thumbnailUseCases: ThumbnailUseCases;
  let usageService: UsageService;
  let mailerService: MailerService;
  let featureLimitService: FeatureLimitService;
  let redisService: RedisService;
  let trashUsecases: TrashUseCases;
  let cacheManagerService: CacheManagerService;

  const userMocked = newUser({
    attributes: {
      tierId: 'free_id',
    },
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [CryptoModule],
      providers: [FileUseCases],
    })
      .useMocker(() => createMock())
      .compile();

    service = module.get<FileUseCases>(FileUseCases);
    fileRepository = module.get<FileRepository>(SequelizeFileRepository);
    fileVersionRepository = module.get<SequelizeFileVersionRepository>(
      SequelizeFileVersionRepository,
    );
    folderUseCases = module.get<FolderUseCases>(FolderUseCases);
    bridgeService = module.get<BridgeService>(BridgeService);
    cryptoService = module.get<CryptoService>(CryptoService);
    sharingService = module.get<SharingService>(SharingService);
    thumbnailUseCases = module.get<ThumbnailUseCases>(ThumbnailUseCases);
    usageService = module.get<UsageService>(UsageService);
    mailerService = module.get<MailerService>(MailerService);
    featureLimitService = module.get<FeatureLimitService>(FeatureLimitService);
    redisService = module.get<RedisService>(RedisService);
    trashUsecases = module.get<TrashUseCases>(TrashUseCases);
    cacheManagerService = module.get<CacheManagerService>(CacheManagerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('move file to trash', () => {
    const mockFile = File.build({
      id: 1,
      fileId: '',
      name: '',
      type: 'jpg',
      size: null,
      bucket: '',
      folderId: 4,
      encryptVersion: '',
      deleted: false,
      deletedAt: new Date(),
      userId: 1,
      creationTime: new Date(),
      modificationTime: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      uuid: '723274e5-ca2a-4e61-bf17-d9fba3b8d430',
      folderUuid: '',
      removed: false,
      removedAt: undefined,
      plainName: 'test',
      status: FileStatus.EXISTS,
    });

    it('When you try to trash files with id and uuid, then functions are called with respective values', async () => {
      const fileIds = [fileId];
      const fileUuids = [mockFile.uuid];
      const mockTier = { id: '1', label: 'free_individual' };

      jest
        .spyOn(fileRepository, 'findByFileIds')
        .mockResolvedValueOnce([mockFile]);
      jest
        .spyOn(featureLimitService, 'getTier')
        .mockResolvedValueOnce(mockTier);
      jest.spyOn(fileRepository, 'updateFilesStatusToTrashed');
      jest.spyOn(fileRepository, 'updateFilesStatusToTrashedByUuid');
      jest.spyOn(trashUsecases, 'addItemsToTrash');
      await service.moveFilesToTrash(userMocked, fileIds, fileUuids);
      expect(fileRepository.updateFilesStatusToTrashed).toHaveBeenCalledTimes(
        1,
      );
      expect(fileRepository.updateFilesStatusToTrashed).toHaveBeenCalledWith(
        userMocked,
        fileIds,
      );
      expect(
        fileRepository.updateFilesStatusToTrashedByUuid,
      ).toHaveBeenCalledWith(userMocked, fileUuids);
      expect(trashUsecases.addItemsToTrash).toHaveBeenCalledWith(
        expect.arrayContaining(fileUuids),
        TrashItemType.File,
        'free_individual',
        userMocked.id,
      );
    });

    it('When you trash files, then the retention period is determined by the user tier', async () => {
      const fileIds = [fileId];
      const fileUuids = [mockFile.uuid];

      jest
        .spyOn(fileRepository, 'findByFileIds')
        .mockResolvedValueOnce([mockFile]);
      jest.spyOn(trashUsecases, 'addItemsToTrash');

      await service.moveFilesToTrash(
        userMocked,
        fileIds,
        fileUuids,
        'premium_individual',
      );

      expect(trashUsecases.addItemsToTrash).toHaveBeenCalledWith(
        expect.arrayContaining(fileUuids),
        TrashItemType.File,
        'premium_individual',
        userMocked.id,
      );
    });

    it('When you try to trash files, then it stops sharing those files', async () => {
      const files = [newFile(), newFile(), newFile()];
      const fileUuids = ['656a3abb-36ab-47ee-8303-6e4198f2a32a'];
      const fileIds = [fileId];

      jest.spyOn(fileRepository, 'findByFileIds').mockResolvedValueOnce(files);

      await service.moveFilesToTrash(userMocked, fileIds, fileUuids);

      expect(sharingService.bulkRemoveSharings).toHaveBeenCalledWith(
        userMocked,
        [...fileUuids, ...files.map((file) => file.uuid)],
        SharingItemType.File,
      );
    });
  });

  describe('get folder by folderId and User Id', () => {
    it('calls getByFolderAndUser and return empty files', async () => {
      const mockFile = [];
      jest
        .spyOn(fileRepository, 'findAllByFolderIdAndUserId')
        .mockResolvedValue([]);

      const options = { deleted: false };
      const result = await service.getByFolderAndUser(
        folderId,
        userId,
        options,
      );
      expect(result).toEqual(mockFile);
      expect(fileRepository.findAllByFolderIdAndUserId).toHaveBeenNthCalledWith(
        1,
        folderId,
        userId,
        options,
      );
    });

    it('calls getByFolderAndUser and return files', async () => {
      const mockFile = File.build({
        id: 1,
        fileId: '',
        name: '',
        type: 'jpg',
        size: null,
        bucket: '',
        folderId: 4,
        encryptVersion: '',
        deleted: false,
        deletedAt: new Date(),
        userId: 1,
        creationTime: new Date(),
        modificationTime: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        uuid: '',
        folderUuid: '',
        removed: false,
        removedAt: undefined,
        plainName: 'test',
        status: FileStatus.EXISTS,
      });
      jest
        .spyOn(fileRepository, 'findAllByFolderIdAndUserId')
        .mockResolvedValue([mockFile]);

      const options = { deleted: false };
      const result = await service.getByFolderAndUser(
        folderId,
        userId,
        options,
      );
      expect(result).toEqual([mockFile]);
      expect(fileRepository.findAllByFolderIdAndUserId).toHaveBeenNthCalledWith(
        1,
        folderId,
        userId,
        options,
      );
    });
  });

  describe('deleteFilePermanently', () => {
    const mockUser = newUser();

    it('When file is not found then, thow NotFoundException', async () => {
      jest.spyOn(fileRepository, 'findOneBy').mockResolvedValueOnce(undefined);

      await expect(
        service.deleteFilePermanently(mockUser, { uuid: v4() }),
      ).rejects.toThrow(NotFoundException);
    });

    it('When user is not owner of the file, then throw ForbiddenException', async () => {
      const unownedFile = newFile();
      jest
        .spyOn(fileRepository, 'findOneBy')
        .mockResolvedValueOnce(unownedFile);

      await expect(
        service.deleteFilePermanently(mockUser, { uuid: v4() }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('When the file is found and owned by the requesting user, then delete file', async () => {
      const mockFile = newFile({
        attributes: { user: mockUser, userId: mockUser.id },
      });

      jest.spyOn(fileRepository, 'findOneBy').mockResolvedValueOnce(mockFile);
      jest.spyOn(sharingService, 'bulkRemoveSharings').mockResolvedValueOnce();
      jest
        .spyOn(thumbnailUseCases, 'deleteThumbnailByFileUuid')
        .mockResolvedValueOnce();
      jest.spyOn(fileRepository, 'deleteFilesByUser').mockResolvedValueOnce();

      const { id, uuid } = await service.deleteFilePermanently(mockUser, {
        uuid: mockFile.uuid,
      });

      expect(sharingService.bulkRemoveSharings).toHaveBeenCalledWith(
        mockUser,
        [mockFile.uuid],
        SharingItemType.File,
      );

      expect(thumbnailUseCases.deleteThumbnailByFileUuid).toHaveBeenCalledWith(
        mockUser,
        mockFile.uuid,
      );

      expect(fileRepository.deleteFilesByUser).toHaveBeenCalledWith(mockUser, [
        mockFile,
      ]);

      expect(id).toBe(mockFile.id);
      expect(uuid).toBe(mockFile.uuid);
    });
  });

  describe('decrypt file name', () => {
    const fileAttributes: FileAttributes = {
      id: 0,
      fileId: '4fda5d98-e5b4-56da-a4f2-000084ac0678',
      name: 'Myanmar',
      type: 'type',
      size: BigInt(60),
      bucket: 'bucket',
      folderId,
      folder: null,
      encryptVersion: 'aes-2',
      deleted: false,
      deletedAt: new Date('2022-09-21T11:11:30.742Z'),
      userId: 3431709237,
      user: null,
      creationTime: new Date('2022-09-21T11:11:30.742Z'),
      modificationTime: new Date('2022-09-21T11:11:30.742Z'),
      createdAt: new Date('2022-09-21T11:11:30.742Z'),
      updatedAt: new Date('2022-09-21T11:11:30.742Z'),
      uuid: '',
      folderUuid: '',
      removed: false,
      removedAt: undefined,
      plainName: 'Myanmar',
      status: FileStatus.EXISTS,
    };

    it('returns a file with the name decrypted', () => {
      const folderId = 523;

      const encryptedName = cryptoService.encryptName(
        fileAttributes['name'],
        folderId,
      );

      const file = {
        ...fileAttributes,
        name: encryptedName,
        folderId,
        plainName: null,
      };

      const decryptedName = 'decryptedName';
      jest.spyOn(cryptoService, 'decryptName').mockReturnValue(decryptedName);

      delete fileAttributes['user'];

      const result = service.decrypFileName(file as File);

      expect(cryptoService.decryptName).toHaveBeenCalledWith(
        file.name,
        file.folderId,
      );
      expect(result).toEqual(
        File.build({
          ...file,
          name: decryptedName,
          plainName: decryptedName,
        }),
      );
    });

    it('When the file has a plain name, then the plain name is returned', () => {
      const file = File.build({
        ...fileAttributes,
        plainName: 'plain name',
      });

      const result = service.decrypFileName(file);
      expect(result).toEqual(
        File.build({
          ...file,
          name: 'plain name',
          plainName: 'plain name',
        }),
      );
    });

    it('fails when name is not encrypted', () => {
      const decyptedName = 'not encrypted name';

      const file = File.build({
        ...fileAttributes,
        name: decyptedName,
      });

      try {
        service.decrypFileName(file);
      } catch (err: any) {
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe('Unable to decrypt file name');
      }
    });
  });

  describe('move file', () => {
    const file = newFile({ attributes: { userId: userMocked.id } });
    const destinationFolder = newFolder({
      attributes: { userId: userMocked.id },
    });

    it('When file is moved, then the file is returned with its updated properties', async () => {
      const expectedFile = newFile({
        attributes: {
          ...file,
          name: 'newencrypted-' + file.name,
          folderId: destinationFolder.id,
          folderUuid: destinationFolder.uuid,
          status: FileStatus.EXISTS,
        },
      });

      jest.spyOn(fileRepository, 'findByUuid').mockResolvedValueOnce(file);
      jest
        .spyOn(folderUseCases, 'getFolderByUuid')
        .mockResolvedValueOnce(destinationFolder);

      jest
        .spyOn(cryptoService, 'encryptName')
        .mockReturnValueOnce(expectedFile.name);

      jest
        .spyOn(fileRepository, 'findByPlainNameAndFolderId')
        .mockResolvedValueOnce(null);

      jest
        .spyOn(fileRepository, 'updateByUuidAndUserId')
        .mockResolvedValueOnce();

      const result = await service.moveFile(userMocked, file.uuid, {
        destinationFolder: destinationFolder.uuid,
      });

      expect(result.toJSON()).toStrictEqual(expectedFile.toJSON());
      expect(fileRepository.updateByUuidAndUserId).toHaveBeenCalledTimes(1);
      expect(fileRepository.updateByUuidAndUserId).toHaveBeenCalledWith(
        file.uuid,
        userMocked.id,
        {
          folderId: destinationFolder.id,
          folderUuid: destinationFolder.uuid,
          name: expectedFile.name,
          status: FileStatus.EXISTS,
          plainName: expectedFile.plainName,
          type: expectedFile.type,
        },
      );
    });

    it('When file is moved but it is removed, then an error is thrown', async () => {
      const mockFile = newFile({
        attributes: { userId: userMocked.id, removed: true },
      });

      jest.spyOn(fileRepository, 'findByUuid').mockResolvedValueOnce(mockFile);

      await expect(
        service.moveFile(userMocked, file.uuid, {
          destinationFolder: destinationFolder.uuid,
        }),
      ).rejects.toThrow(`File ${file.uuid} can not be moved`);
    });

    it('When file is moved but the destination folder is removed, then an error is thrown', async () => {
      const mockDestinationFolder = newFolder({
        attributes: { userId: userMocked.id, removed: true },
      });

      jest.spyOn(fileRepository, 'findByUuid').mockResolvedValueOnce(file);
      jest
        .spyOn(folderUseCases, 'getFolderByUuid')
        .mockResolvedValueOnce(mockDestinationFolder);

      await expect(
        service.moveFile(userMocked, file.uuid, {
          destinationFolder: destinationFolder.uuid,
        }),
      ).rejects.toThrow(`File can not be moved to ${destinationFolder.uuid}`);
    });

    it('When a non existent file is moved to a folder, then it should throw a not found error', async () => {
      jest.spyOn(fileRepository, 'findByUuid').mockResolvedValueOnce(null);
      await expect(
        service.moveFile(userMocked, file.uuid, {
          destinationFolder: destinationFolder.uuid,
        }),
      ).rejects.toThrow(`File ${file.uuid} can not be moved`);
    });

    it('When a file is moved to a non existent folder, then it should throw a not found error', async () => {
      jest.spyOn(fileRepository, 'findByUuid').mockResolvedValueOnce(file);
      jest.spyOn(folderUseCases, 'getFolderByUuid').mockResolvedValueOnce(null);
      await expect(
        service.moveFile(userMocked, file.uuid, {
          destinationFolder: destinationFolder.uuid,
        }),
      ).rejects.toThrow(`File can not be moved to ${destinationFolder.uuid}`);
    });

    it('When file is moved to a folder that has been already moved to, then it should throw a conflict error', async () => {
      jest.spyOn(fileRepository, 'findByUuid').mockResolvedValueOnce(file);
      jest
        .spyOn(folderUseCases, 'getFolderByUuid')
        .mockResolvedValueOnce(destinationFolder);
      jest.spyOn(cryptoService, 'encryptName').mockReturnValueOnce(file.name);
      jest
        .spyOn(fileRepository, 'findByPlainNameAndFolderId')
        .mockResolvedValueOnce(file);

      await expect(
        service.moveFile(userMocked, file.uuid, {
          destinationFolder: destinationFolder.uuid,
        }),
      ).rejects.toThrow(`File ${file.uuid} was already moved to that location`);
    });

    it('When file is moved to a folder that has already a file with the same name, then it should throw a conflict error', async () => {
      const conflictFile = newFile({
        attributes: {
          ...file,
          uuid: v4(),
        },
      });
      jest.spyOn(fileRepository, 'findByUuid').mockResolvedValueOnce(file);
      jest
        .spyOn(folderUseCases, 'getFolderByUuid')
        .mockResolvedValueOnce(destinationFolder);
      jest.spyOn(cryptoService, 'encryptName').mockReturnValueOnce(file.name);
      jest
        .spyOn(fileRepository, 'findByPlainNameAndFolderId')
        .mockResolvedValueOnce(conflictFile);

      await expect(
        service.moveFile(userMocked, file.uuid, {
          destinationFolder: destinationFolder.uuid,
        }),
      ).rejects.toThrow(
        'A file with the same name already exists in destination folder',
      );
    });

    it('When file is renamed and moved, then the file is returned with its updated properties', async () => {
      const fileToBeMovedAndRenamed = newFile({
        attributes: {
          ...file,
          folderId: destinationFolder.id + 1,
          folderUuid: v4(),
          status: FileStatus.EXISTS,
          plainName: 'name',
          type: 'type',
        },
      });

      const newAttributes = {
        name: 'newName',
        type: 'newType',
      };

      const expectedFile = newFile({
        attributes: {
          ...file,
          folderId: destinationFolder.id,
          folderUuid: destinationFolder.uuid,
          status: FileStatus.EXISTS,
          plainName: newAttributes.name,
          type: newAttributes.type,
        },
      });

      jest
        .spyOn(fileRepository, 'findByUuid')
        .mockResolvedValueOnce(fileToBeMovedAndRenamed);
      jest
        .spyOn(folderUseCases, 'getFolderByUuid')
        .mockResolvedValueOnce(destinationFolder);

      jest
        .spyOn(cryptoService, 'encryptName')
        .mockReturnValueOnce(fileToBeMovedAndRenamed.name);

      jest
        .spyOn(fileRepository, 'findByPlainNameAndFolderId')
        .mockResolvedValueOnce(null);

      jest
        .spyOn(fileRepository, 'updateByUuidAndUserId')
        .mockResolvedValueOnce();

      const result = await service.moveFile(
        userMocked,
        fileToBeMovedAndRenamed.uuid,
        {
          destinationFolder: destinationFolder.uuid,
          ...newAttributes,
        },
      );

      expect(result.toJSON()).toStrictEqual(expectedFile.toJSON());
      expect(fileRepository.updateByUuidAndUserId).toHaveBeenCalledTimes(1);
      expect(fileRepository.updateByUuidAndUserId).toHaveBeenCalledWith(
        expectedFile.uuid,
        expectedFile.userId,
        {
          folderId: destinationFolder.id,
          folderUuid: destinationFolder.uuid,
          name: expectedFile.name,
          status: FileStatus.EXISTS,
          plainName: expectedFile.plainName,
          type: expectedFile.type,
        },
      );
    });

    it('When file is renamed (but not moved), then the file is returned with its updated properties', async () => {
      const fileToBeRenamed = newFile({
        attributes: {
          ...file,
          folderId: destinationFolder.id,
          folderUuid: destinationFolder.uuid,
          status: FileStatus.EXISTS,
          plainName: 'name',
          type: 'type',
        },
      });

      const newAttributes = {
        name: 'newName',
        type: 'newType',
      };

      const expectedFile = newFile({
        attributes: {
          ...file,
          folderId: destinationFolder.id,
          folderUuid: destinationFolder.uuid,
          status: FileStatus.EXISTS,
          plainName: newAttributes.name,
          type: newAttributes.type,
        },
      });

      jest
        .spyOn(fileRepository, 'findByUuid')
        .mockResolvedValueOnce(fileToBeRenamed);
      jest
        .spyOn(folderUseCases, 'getFolderByUuid')
        .mockResolvedValueOnce(destinationFolder);

      jest
        .spyOn(cryptoService, 'encryptName')
        .mockReturnValueOnce(fileToBeRenamed.name);

      jest
        .spyOn(fileRepository, 'findByPlainNameAndFolderId')
        .mockResolvedValueOnce(null);

      jest
        .spyOn(fileRepository, 'updateByUuidAndUserId')
        .mockResolvedValueOnce();

      const result = await service.moveFile(userMocked, fileToBeRenamed.uuid, {
        destinationFolder: fileToBeRenamed.folderUuid,
        ...newAttributes,
      });

      expect(result.toJSON()).toStrictEqual(expectedFile.toJSON());
      expect(fileRepository.updateByUuidAndUserId).toHaveBeenCalledTimes(1);
      expect(fileRepository.updateByUuidAndUserId).toHaveBeenCalledWith(
        expectedFile.uuid,
        expectedFile.userId,
        {
          folderId: expectedFile.folderId,
          folderUuid: expectedFile.folderUuid,
          name: expectedFile.name,
          status: FileStatus.EXISTS,
          plainName: expectedFile.plainName,
          type: expectedFile.type,
        },
      );
    });

    it('When file is renamed with an empty filename, then it should throw a BadRequestException', async () => {
      const fileToBeRenamed = newFile({
        attributes: {
          ...file,
          folderId: destinationFolder.id,
          folderUuid: destinationFolder.uuid,
          status: FileStatus.EXISTS,
          plainName: 'name',
          type: 'type',
        },
      });

      const newAttributes = {
        name: '',
        type: '',
      };

      jest
        .spyOn(fileRepository, 'findByUuid')
        .mockResolvedValueOnce(fileToBeRenamed);
      jest
        .spyOn(folderUseCases, 'getFolderByUuid')
        .mockResolvedValueOnce(destinationFolder);

      jest
        .spyOn(cryptoService, 'encryptName')
        .mockReturnValueOnce(fileToBeRenamed.name);

      jest
        .spyOn(fileRepository, 'findByPlainNameAndFolderId')
        .mockResolvedValueOnce(null);

      jest
        .spyOn(fileRepository, 'updateByUuidAndUserId')
        .mockResolvedValueOnce();

      await expect(
        service.moveFile(userMocked, file.uuid, {
          destinationFolder: destinationFolder.uuid,
          ...newAttributes,
        }),
      ).rejects.toThrow('Filename is not valid');
    });
  });

  describe('createFile', () => {
    const newFileDto: CreateFileDto = {
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

    it('When folder does not exist, then it should throw', async () => {
      jest.spyOn(folderUseCases, 'getByUuid').mockResolvedValueOnce(null);

      await expect(service.createFile(userMocked, newFileDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('When folder is not owned by user, then it should throw', async () => {
      const folder = newFolder({ attributes: { userId: userMocked.id + 1 } });
      jest.spyOn(folderUseCases, 'getByUuid').mockResolvedValueOnce(folder);

      await expect(service.createFile(userMocked, newFileDto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('When file with same name already exists in folder, then it should throw', async () => {
      const folder = newFolder({ attributes: { userId: userMocked.id } });
      const existingFile = newFile({
        attributes: {
          folderId: folder.id,
          plainName: newFileDto.plainName,
        },
      });

      jest.spyOn(folderUseCases, 'getByUuid').mockResolvedValueOnce(folder);
      jest
        .spyOn(fileRepository, 'findOneBy')
        .mockResolvedValueOnce(existingFile);

      await expect(service.createFile(userMocked, newFileDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('When file is created successfully, then it should return the new file and clear the limit cache', async () => {
      const folder = newFolder({ attributes: { userId: userMocked.id } });

      jest.spyOn(folderUseCases, 'getByUuid').mockResolvedValueOnce(folder);
      jest
        .spyOn(fileRepository, 'findByPlainNameAndFolderId')
        .mockResolvedValueOnce(null);
      const expireUsageSpy = jest.spyOn(cacheManagerService, 'expireUserUsage');

      const createdFile = newFile({
        attributes: {
          ...newFileDto,
          id: 1,
          folderId: folder.id,
          folderUuid: folder.uuid,
          userId: userMocked.id,
          uuid: v4(),
          status: FileStatus.EXISTS,
        },
      });

      jest.spyOn(fileRepository, 'create').mockResolvedValueOnce(createdFile);

      const result = await service.createFile(userMocked, newFileDto);

      expect(result).toEqual(createdFile);
      expect(expireUsageSpy).toHaveBeenCalledWith(userMocked.uuid);
    });

    it('When creating a file and the cached usage fails to be expired, then it still returns succesfully', async () => {
      const folder = newFolder({ attributes: { userId: userMocked.id } });

      jest.spyOn(folderUseCases, 'getByUuid').mockResolvedValueOnce(folder);
      jest
        .spyOn(fileRepository, 'findByPlainNameAndFolderId')
        .mockResolvedValueOnce(null);
      jest
        .spyOn(cacheManagerService, 'expireUserUsage')
        .mockRejectedValue(new Error('Cache failed'));

      const createdFile = newFile({
        attributes: {
          ...newFileDto,
          id: 1,
          folderId: folder.id,
          folderUuid: folder.uuid,
          userId: userMocked.id,
          uuid: v4(),
          status: FileStatus.EXISTS,
        },
      });

      jest.spyOn(fileRepository, 'create').mockResolvedValueOnce(createdFile);

      const result = await service.createFile(userMocked, newFileDto);

      expect(result).toEqual(createdFile);
    });

    describe('Empty files creation', () => {
      it('When creating empty file and limit is not reached, then it should create successfully', async () => {
        const folder = newFolder({ attributes: { userId: userMocked.id } });
        const emptyFileDto: CreateFileDto = {
          ...newFileDto,
          size: BigInt(0),
        };

        const mockLimit = newFeatureLimit({
          label: LimitLabels.MaxZeroSizeFiles,
          type: LimitTypes.Counter,
          value: '1000',
        });

        jest.spyOn(folderUseCases, 'getByUuid').mockResolvedValueOnce(folder);
        jest
          .spyOn(fileRepository, 'findByPlainNameAndFolderId')
          .mockResolvedValueOnce(null);
        jest
          .spyOn(featureLimitService, 'getUserLimitByLabel')
          .mockResolvedValue(mockLimit);
        jest
          .spyOn(fileRepository, 'getZeroSizeFilesCountByUser')
          .mockResolvedValue(5);

        const createdFile = newFile({
          attributes: {
            ...emptyFileDto,
            id: 1,
            folderId: folder.id,
            folderUuid: folder.uuid,
            userId: userMocked.id,
            uuid: v4(),
            status: FileStatus.EXISTS,
          },
        });

        jest.spyOn(fileRepository, 'create').mockResolvedValueOnce(createdFile);

        const result = await service.createFile(userMocked, emptyFileDto);

        expect(result).toEqual(createdFile);
        expect(featureLimitService.getUserLimitByLabel).toHaveBeenCalledWith(
          LimitLabels.MaxZeroSizeFiles,
          userMocked,
        );
        expect(fileRepository.getZeroSizeFilesCountByUser).toHaveBeenCalledWith(
          userMocked.id,
        );
      });

      it('When creating empty file and limit is reached, then it should throw', async () => {
        const folder = newFolder({ attributes: { userId: userMocked.id } });
        const emptyFileDto: CreateFileDto = {
          ...newFileDto,
          size: BigInt(0),
        };

        const mockLimit = newFeatureLimit({
          label: LimitLabels.MaxZeroSizeFiles,
          type: LimitTypes.Counter,
          value: '1000',
        });

        jest.spyOn(folderUseCases, 'getByUuid').mockResolvedValueOnce(folder);
        jest
          .spyOn(fileRepository, 'findByPlainNameAndFolderId')
          .mockResolvedValueOnce(null);
        jest
          .spyOn(featureLimitService, 'getUserLimitByLabel')
          .mockResolvedValue(mockLimit);
        jest
          .spyOn(fileRepository, 'getZeroSizeFilesCountByUser')
          .mockResolvedValue(1000);

        await expect(
          service.createFile(userMocked, emptyFileDto),
        ).rejects.toThrow(BadRequestException);

        expect(featureLimitService.getUserLimitByLabel).toHaveBeenCalledWith(
          LimitLabels.MaxZeroSizeFiles,
          userMocked,
        );
        expect(fileRepository.getZeroSizeFilesCountByUser).toHaveBeenCalledWith(
          userMocked.id,
        );
      });

      it('When creating empty file and limit does not exist, then it should throw', async () => {
        const folder = newFolder({ attributes: { userId: userMocked.id } });
        const emptyFileDto: CreateFileDto = {
          ...newFileDto,
          size: BigInt(0),
        };

        jest.spyOn(folderUseCases, 'getByUuid').mockResolvedValueOnce(folder);
        jest
          .spyOn(fileRepository, 'findByPlainNameAndFolderId')
          .mockResolvedValueOnce(null);
        jest
          .spyOn(featureLimitService, 'getUserLimitByLabel')
          .mockResolvedValue(null);
        jest
          .spyOn(fileRepository, 'getZeroSizeFilesCountByUser')
          .mockResolvedValue(5);

        await expect(
          service.createFile(userMocked, emptyFileDto),
        ).rejects.toThrow(PaymentRequiredException);

        expect(featureLimitService.getUserLimitByLabel).toHaveBeenCalledWith(
          LimitLabels.MaxZeroSizeFiles,
          userMocked,
        );
        expect(fileRepository.getZeroSizeFilesCountByUser).toHaveBeenCalledWith(
          userMocked.id,
        );
      });

      it('When creating empty file, then fileId should be set to null', async () => {
        const folder = newFolder({ attributes: { userId: userMocked.id } });
        const emptyFileDto: CreateFileDto = {
          ...newFileDto,
          fileId: 'some-file-id',
          size: BigInt(0),
        };

        const mockLimit = newFeatureLimit({
          label: LimitLabels.MaxZeroSizeFiles,
          type: LimitTypes.Counter,
          value: '1000',
        });

        jest.spyOn(folderUseCases, 'getByUuid').mockResolvedValueOnce(folder);
        jest
          .spyOn(fileRepository, 'findByPlainNameAndFolderId')
          .mockResolvedValueOnce(null);
        jest
          .spyOn(featureLimitService, 'getUserLimitByLabel')
          .mockResolvedValue(mockLimit);
        jest
          .spyOn(fileRepository, 'getZeroSizeFilesCountByUser')
          .mockResolvedValue(5);

        const createSpy = jest
          .spyOn(fileRepository, 'create')
          .mockResolvedValueOnce({} as any);

        await service.createFile(userMocked, emptyFileDto);

        expect(createSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            fileId: null,
            size: BigInt(0),
          }),
        );
      });
    });

    describe('first upload email functionality', () => {
      it('When user has no previous files, then should send first upload email', async () => {
        const folder = newFolder({ attributes: { userId: userMocked.id } });
        const createdFile = newFile({
          attributes: {
            ...newFileDto,
            id: 1,
            folderId: folder.id,
            folderUuid: folder.uuid,
            userId: userMocked.id,
            uuid: v4(),
            status: FileStatus.EXISTS,
          },
        });

        jest.spyOn(service, 'hasUploadedFiles').mockResolvedValueOnce(false);
        jest.spyOn(folderUseCases, 'getByUuid').mockResolvedValueOnce(folder);
        jest
          .spyOn(fileRepository, 'findByPlainNameAndFolderId')
          .mockResolvedValueOnce(null);
        jest.spyOn(fileRepository, 'create').mockResolvedValueOnce(createdFile);
        jest
          .spyOn(mailerService, 'sendFirstUploadEmail')
          .mockResolvedValueOnce(undefined);

        await service.createFile(userMocked, newFileDto, {
          label: 'free_individual',
        });

        expect(mailerService.sendFirstUploadEmail).toHaveBeenCalledWith(
          userMocked.email,
        );
      });

      it('When user already has files, then should not send email', async () => {
        const folder = newFolder({ attributes: { userId: userMocked.id } });
        const createdFile = newFile({
          attributes: {
            ...newFileDto,
            id: 1,
            folderId: folder.id,
            folderUuid: folder.uuid,
            userId: userMocked.id,
            uuid: v4(),
            status: FileStatus.EXISTS,
          },
        });

        jest.spyOn(service, 'hasUploadedFiles').mockResolvedValueOnce(true);
        jest.spyOn(folderUseCases, 'getByUuid').mockResolvedValueOnce(folder);
        jest
          .spyOn(fileRepository, 'findByPlainNameAndFolderId')
          .mockResolvedValueOnce(null);
        jest.spyOn(fileRepository, 'create').mockResolvedValueOnce(createdFile);
        jest
          .spyOn(mailerService, 'sendFirstUploadEmail')
          .mockResolvedValueOnce(undefined);

        await service.createFile(userMocked, newFileDto);

        expect(mailerService.sendFirstUploadEmail).not.toHaveBeenCalled();
      });

      it('When email fails, then should not affect file creation', async () => {
        const folder = newFolder({ attributes: { userId: userMocked.id } });
        const createdFile = newFile({
          attributes: {
            ...newFileDto,
            id: 1,
            folderId: folder.id,
            folderUuid: folder.uuid,
            userId: userMocked.id,
            uuid: v4(),
            status: FileStatus.EXISTS,
          },
        });

        jest.spyOn(service, 'hasUploadedFiles').mockResolvedValueOnce(false);
        jest.spyOn(folderUseCases, 'getByUuid').mockResolvedValueOnce(folder);
        jest
          .spyOn(fileRepository, 'findByPlainNameAndFolderId')
          .mockResolvedValueOnce(null);
        jest.spyOn(fileRepository, 'create').mockResolvedValueOnce(createdFile);
        jest
          .spyOn(mailerService, 'sendFirstUploadEmail')
          .mockRejectedValueOnce(new Error('Email service failed'));

        const result = await service.createFile(userMocked, newFileDto, {
          label: 'free_individual',
        });

        expect(result).toEqual(createdFile);
        expect(mailerService.sendFirstUploadEmail).toHaveBeenCalledWith(
          userMocked.email,
        );
      });

      it('When user has paid tier, then should not send first upload email', async () => {
        const folder = newFolder({ attributes: { userId: userMocked.id } });
        const createdFile = newFile({
          attributes: {
            ...newFileDto,
            id: 1,
            folderId: folder.id,
            folderUuid: folder.uuid,
            userId: userMocked.id,
            uuid: v4(),
            status: FileStatus.EXISTS,
          },
        });

        jest.spyOn(service, 'hasUploadedFiles').mockResolvedValueOnce(false);
        jest.spyOn(folderUseCases, 'getByUuid').mockResolvedValueOnce(folder);
        jest
          .spyOn(fileRepository, 'findByPlainNameAndFolderId')
          .mockResolvedValueOnce(null);
        jest.spyOn(fileRepository, 'create').mockResolvedValueOnce(createdFile);
        jest
          .spyOn(featureLimitService, 'getTier')
          .mockResolvedValueOnce({ label: '10gb_individual' } as Tier);
        jest
          .spyOn(mailerService, 'sendFirstUploadEmail')
          .mockResolvedValueOnce(undefined);

        await service.createFile(userMocked, newFileDto);

        expect(mailerService.sendFirstUploadEmail).not.toHaveBeenCalled();
      });
    });
  });

  describe('checkEmptyFilesLimit', () => {
    it('When limit is null, then it should throw', async () => {
      jest
        .spyOn(featureLimitService, 'getUserLimitByLabel')
        .mockResolvedValue(null);
      jest
        .spyOn(fileRepository, 'getZeroSizeFilesCountByUser')
        .mockResolvedValue(5);

      await expect(service.checkEmptyFilesLimit(userMocked)).rejects.toThrow(
        PaymentRequiredException,
      );

      expect(featureLimitService.getUserLimitByLabel).toHaveBeenCalledWith(
        LimitLabels.MaxZeroSizeFiles,
        userMocked,
      );
      expect(fileRepository.getZeroSizeFilesCountByUser).toHaveBeenCalledWith(
        userMocked.id,
      );
    });

    it('When limit exists and user has reached the zero-size files limit, then it should throw', async () => {
      const mockLimit = newFeatureLimit({
        label: LimitLabels.MaxZeroSizeFiles,
        type: LimitTypes.Counter,
        value: '1000',
      });

      jest
        .spyOn(featureLimitService, 'getUserLimitByLabel')
        .mockResolvedValue(mockLimit);
      jest
        .spyOn(fileRepository, 'getZeroSizeFilesCountByUser')
        .mockResolvedValue(1000);

      await expect(service.checkEmptyFilesLimit(userMocked)).rejects.toThrow(
        BadRequestException,
      );

      expect(featureLimitService.getUserLimitByLabel).toHaveBeenCalledWith(
        LimitLabels.MaxZeroSizeFiles,
        userMocked,
      );
      expect(fileRepository.getZeroSizeFilesCountByUser).toHaveBeenCalledWith(
        userMocked.id,
      );
    });

    it('When limit exists and user has not reached the zero-size limit yet, then it should not throw', async () => {
      const mockLimit = newFeatureLimit({
        label: LimitLabels.MaxZeroSizeFiles,
        type: LimitTypes.Counter,
        value: '1000',
      });

      jest
        .spyOn(featureLimitService, 'getUserLimitByLabel')
        .mockResolvedValue(mockLimit);
      jest
        .spyOn(fileRepository, 'getZeroSizeFilesCountByUser')
        .mockResolvedValue(5);

      await expect(
        service.checkEmptyFilesLimit(userMocked),
      ).resolves.not.toThrow();

      expect(featureLimitService.getUserLimitByLabel).toHaveBeenCalledWith(
        LimitLabels.MaxZeroSizeFiles,
        userMocked,
      );
      expect(fileRepository.getZeroSizeFilesCountByUser).toHaveBeenCalledWith(
        userMocked.id,
      );
    });
  });

  describe('updateFileMetaData', () => {
    it('When a file with the same name already exists in the folder, then it should fail', async () => {
      const newFileMeta: UpdateFileMetaDto = { plainName: 'new-name' };
      const mockFile = newFile({ owner: userMocked });
      const fileWithSameName = newFile({
        owner: userMocked,
        attributes: { name: mockFile.name, plainName: mockFile.plainName },
      });

      jest.spyOn(fileRepository, 'findOneBy').mockResolvedValueOnce(mockFile);

      jest
        .spyOn(fileRepository, 'findByPlainNameAndFolderId')
        .mockResolvedValueOnce(fileWithSameName);

      try {
        await service.updateFileMetaData(
          userMocked,
          mockFile.uuid,
          newFileMeta,
        );
        fail('Expected function to throw an error, but it did not.');
      } catch (error) {
        expect(error).toBeInstanceOf(ConflictException);
        expect(error.message).toBe(
          'A file with this name already exists in this location',
        );
      }
    });

    it('When file is not found (it does not exist, or the user is not the owner), then it should fail', async () => {
      const newFileMeta: UpdateFileMetaDto = { plainName: 'new-name' };
      jest.spyOn(fileRepository, 'findOneBy').mockResolvedValue(null);

      try {
        await service.updateFileMetaData(
          userMocked,
          newFile().uuid,
          newFileMeta,
        );
        fail('Expected function to throw an error, but it did not.');
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.message).toBe('File not found');
      }
    });

    it('When updateFileMetadata has bad properties, then it should fail', async () => {
      try {
        await service.updateFileMetaData(userMocked, newFile().uuid, {});
        fail('Expected function to throw an error, but it did not.');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('Filename cannot be empty');
      }

      try {
        await service.updateFileMetaData(userMocked, newFile().uuid, {
          type: '',
          plainName: '',
        });
        fail('Expected function to throw an error, but it did not.');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('Filename cannot be empty');
      }

      try {
        await service.updateFileMetaData(userMocked, newFile().uuid, {
          type: null,
          plainName: null,
        });
        fail('Expected function to throw an error, but it did not.');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('Filename cannot be empty');
      }

      try {
        await service.updateFileMetaData(userMocked, newFile().uuid, {
          type: '',
          plainName: null,
        });
        fail('Expected function to throw an error, but it did not.');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('Filename cannot be empty');
      }

      try {
        await service.updateFileMetaData(userMocked, newFile().uuid, {
          type: null,
          plainName: '',
        });
        fail('Expected function to throw an error, but it did not.');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('Filename cannot be empty');
      }
    });

    it('When the name of the file is updated successfully, then it should update and return updated file', async () => {
      const newFileMeta: UpdateFileMetaDto = { plainName: 'new-name' };
      const mockFile = newFile({ owner: userMocked });

      const encryptedName = 'encrypted-name';
      const updatedFile = newFile({
        attributes: {
          ...mockFile,
          plainName: newFileMeta.plainName,
          name: encryptedName,
        },
      });

      jest.spyOn(fileRepository, 'findOneBy').mockResolvedValueOnce(mockFile);
      jest
        .spyOn(fileRepository, 'findByPlainNameAndFolderId')
        .mockResolvedValueOnce(null);
      jest.spyOn(cryptoService, 'encryptName').mockReturnValue(encryptedName);

      const result = await service.updateFileMetaData(
        userMocked,
        mockFile.uuid,
        newFileMeta,
      );

      expect(fileRepository.findOneBy).toHaveBeenCalledWith({
        uuid: mockFile.uuid,
        userId: mockFile.userId,
        status: FileStatus.EXISTS,
      });
      expect(fileRepository.findByPlainNameAndFolderId).toHaveBeenCalledWith(
        mockFile.userId,
        newFileMeta.plainName,
        mockFile.type,
        mockFile.folderId,
        FileStatus.EXISTS,
      );
      expect(fileRepository.updateByUuidAndUserId).toHaveBeenCalledWith(
        mockFile.uuid,
        userMocked.id,
        expect.objectContaining({
          plainName: newFileMeta.plainName,
          name: encryptedName,
        }),
      );
      const {
        modificationTime: resultFileModificationTime,
        ...resultWithoutModificationTime
      } = result;
      const {
        modificationTime: updatedFileModificationTime,
        ...updatedFileWithoutModificationTime
      } = updatedFile;

      expect(resultWithoutModificationTime).toEqual(
        updatedFileWithoutModificationTime,
      );
      expect(mockFile).not.toBe(updatedFileModificationTime);
    });

    it('When the type of the file is updated successfully, then it should update and return updated file', async () => {
      const mockFile = newFile({
        owner: userMocked,
        attributes: { type: 'jpg' },
      });
      const newTypeFileMeta: UpdateFileMetaDto = { type: 'png' };

      const updatedFile = newFile({
        attributes: {
          ...mockFile,
          type: newTypeFileMeta.type,
        },
      });

      jest.spyOn(fileRepository, 'findOneBy').mockResolvedValueOnce(mockFile);
      jest
        .spyOn(fileRepository, 'findByPlainNameAndFolderId')
        .mockResolvedValueOnce(null);
      jest.spyOn(cryptoService, 'encryptName').mockReturnValue(mockFile.name);

      const result = await service.updateFileMetaData(
        userMocked,
        mockFile.uuid,
        newTypeFileMeta,
      );

      expect(fileRepository.findOneBy).toHaveBeenCalledWith({
        uuid: mockFile.uuid,
        userId: mockFile.userId,
        status: FileStatus.EXISTS,
      });
      expect(fileRepository.findByPlainNameAndFolderId).toHaveBeenCalledWith(
        mockFile.userId,
        mockFile.plainName,
        newTypeFileMeta.type,
        mockFile.folderId,
        FileStatus.EXISTS,
      );
      expect(fileRepository.updateByUuidAndUserId).toHaveBeenCalledWith(
        mockFile.uuid,
        userMocked.id,
        expect.objectContaining({
          plainName: mockFile.plainName,
          name: mockFile.name,
          type: newTypeFileMeta.type,
        }),
      );
      const {
        modificationTime: resultFileModificationTime,
        ...resultWithoutModificationTime
      } = result;
      const {
        modificationTime: updatedFileModificationTime,
        ...updatedFileWithoutModificationTime
      } = updatedFile;

      expect(resultWithoutModificationTime).toEqual(
        updatedFileWithoutModificationTime,
      );
      expect(mockFile).not.toBe(updatedFileModificationTime);
    });
  });

  describe('getWorkspaceFilesSizeSumByStatuses', () => {
    const user = newUser();
    const workspace = newWorkspace();

    it('When called with specific statuses and options, then it should use them to fetch files', async () => {
      const statuses = [FileStatus.EXISTS, FileStatus.TRASHED];
      const totalSum = 100;

      jest
        .spyOn(fileRepository, 'getSumSizeOfFilesInWorkspaceByStatuses')
        .mockResolvedValue(totalSum);

      const result = await service.getWorkspaceFilesSizeSumByStatuses(
        user.uuid,
        workspace.id,
        statuses,
      );

      expect(
        fileRepository.getSumSizeOfFilesInWorkspaceByStatuses,
      ).toHaveBeenCalledWith(user.uuid, workspace.id, statuses);
      expect(result).toEqual(totalSum);
    });
  });

  describe('get file by path', () => {
    it('When get file metadata by path is requested with a valid path, then the file is returned', async () => {
      const expectedFile = newFile();
      const rootFolder = newFolder();
      const parentFolderFile = newFolder();
      const filePath = '/test/file.png';
      jest
        .spyOn(folderUseCases, 'getFolderByUserId')
        .mockResolvedValue(rootFolder);
      jest
        .spyOn(folderUseCases, 'getFolderMetadataByPath')
        .mockResolvedValue(parentFolderFile);
      jest
        .spyOn(service, 'findByPlainNameAndFolderId')
        .mockResolvedValue(expectedFile);

      const result = await service.getFileMetadataByPath(userMocked, filePath);
      expect(result).toEqual(expectedFile);
    });

    it('When get file metadata by path is requested with a valid path but the root folder doesnt exist, then it should throw a not found error', async () => {
      const filePath = '/test/file.png';
      jest
        .spyOn(folderUseCases, 'getFolderMetadataByPath')
        .mockResolvedValue(null);

      await expect(
        service.getFileMetadataByPath(userMocked, filePath),
      ).rejects.toThrow(NotFoundException);
    });

    it('When get file metadata by path is requested with a valid path but the parent folders dont exist, then it should throw a not found error', async () => {
      const rootFolder = newFolder();
      const filePath = '/test/file.png';
      jest
        .spyOn(folderUseCases, 'getFolderByUserId')
        .mockResolvedValue(rootFolder);
      jest
        .spyOn(folderUseCases, 'getFolderMetadataByPath')
        .mockResolvedValue(null);

      await expect(
        service.getFileMetadataByPath(userMocked, filePath),
      ).rejects.toThrow(NotFoundException);
    });

    it('When get file metadata by path is requested with a valid path but the file doesnt exist, then it should return null', async () => {
      const rootFolder = newFolder();
      const parentFolderFile = newFolder();
      const filePath = '/test/file.png';
      jest
        .spyOn(folderUseCases, 'getFolderByUserId')
        .mockResolvedValue(rootFolder);
      jest
        .spyOn(folderUseCases, 'getFolderMetadataByPath')
        .mockResolvedValue(parentFolderFile);
      jest.spyOn(service, 'findByPlainNameAndFolderId').mockResolvedValue(null);

      const result = await service.getFileMetadataByPath(userMocked, filePath);
      expect(result).toBeNull();
    });
  });

  describe('getWorkspaceFilesUpdatedAfter', () => {
    const createdBy = v4();
    const workspaceId = v4();
    const updatedAfter = new Date();
    const where = { status: FileStatus.EXISTS };
    const options = {
      limit: 10,
      offset: 0,
      sort: [['updatedAt', 'ASC']] as Array<
        [SortableFileAttributes, 'ASC' | 'DESC']
      >,
    };
    const mockFiles = [newFile(), newFile()];

    it('When files are found, then it should return those files', async () => {
      jest
        .spyOn(fileRepository, 'findAllCursorWhereUpdatedAfterInWorkspace')
        .mockResolvedValueOnce(mockFiles);

      const result = await service.getWorkspaceFilesUpdatedAfter(
        createdBy,
        workspaceId,
        updatedAfter,
        where,
        options,
      );

      expect(result).toEqual(mockFiles);
      expect(
        fileRepository.findAllCursorWhereUpdatedAfterInWorkspace,
      ).toHaveBeenCalledWith(
        createdBy,
        workspaceId,
        where,
        updatedAfter,
        options.limit,
        options.offset,
        options.sort,
      );
    });

    it('When no sort options are provided, it should default to updatedAt ASC', async () => {
      const optionsWithoutSort = { limit: 10, offset: 0 };
      jest.spyOn(fileRepository, 'findAllCursorWhereUpdatedAfterInWorkspace');

      await service.getWorkspaceFilesUpdatedAfter(
        createdBy,
        workspaceId,
        updatedAfter,
        where,
        optionsWithoutSort,
      );

      expect(
        fileRepository.findAllCursorWhereUpdatedAfterInWorkspace,
      ).toHaveBeenCalledWith(
        createdBy,
        workspaceId,
        where,
        updatedAfter,
        optionsWithoutSort.limit,
        optionsWithoutSort.offset,
        [['updatedAt', 'ASC']],
      );
    });

    it('When called with no filters, it should handle empty where', async () => {
      jest.spyOn(fileRepository, 'findAllCursorWhereUpdatedAfterInWorkspace');

      await service.getWorkspaceFilesUpdatedAfter(
        createdBy,
        workspaceId,
        updatedAfter,
        {},
        options,
      );

      expect(
        fileRepository.findAllCursorWhereUpdatedAfterInWorkspace,
      ).toHaveBeenCalledWith(
        createdBy,
        workspaceId,
        {},
        updatedAfter,
        options.limit,
        options.offset,
        options.sort,
      );
    });
  });

  describe('getUserUsedStorage', () => {
    it('When called, it should return the sum of files and versions usage', async () => {
      const filesUsage = 1000;
      const versionsUsage = 500;
      jest
        .spyOn(service, 'getUserUsedStorageIncrementally')
        .mockResolvedValueOnce(filesUsage);
      jest
        .spyOn(fileVersionRepository, 'sumExistingSizesByUser')
        .mockResolvedValueOnce(versionsUsage);

      const result = await service.getUserUsedStorage(userMocked);

      expect(result).toEqual(filesUsage + versionsUsage);
      expect(service.getUserUsedStorageIncrementally).toHaveBeenCalledWith(
        userMocked,
      );
      expect(fileVersionRepository.sumExistingSizesByUser).toHaveBeenCalledWith(
        userMocked.id,
      );
    });

    it('When getUserUsedStorageIncrementally returns null, it should still include versions usage', async () => {
      const versionsUsage = 300;
      jest
        .spyOn(service, 'getUserUsedStorageIncrementally')
        .mockResolvedValueOnce(null);
      jest
        .spyOn(fileVersionRepository, 'sumExistingSizesByUser')
        .mockResolvedValueOnce(versionsUsage);

      const result = await service.getUserUsedStorage(userMocked);

      expect(result).toEqual(versionsUsage);
    });

    it('When getUserUsedStorageIncrementally returns undefined, it should still include versions usage', async () => {
      const versionsUsage = 200;
      jest
        .spyOn(service, 'getUserUsedStorageIncrementally')
        .mockResolvedValueOnce(undefined);
      jest
        .spyOn(fileVersionRepository, 'sumExistingSizesByUser')
        .mockResolvedValueOnce(versionsUsage);

      const result = await service.getUserUsedStorage(userMocked);

      expect(result).toEqual(versionsUsage);
    });

    it('When user has no versions, it should return only files usage', async () => {
      const filesUsage = 1000;
      jest
        .spyOn(service, 'getUserUsedStorageIncrementally')
        .mockResolvedValueOnce(filesUsage);
      jest
        .spyOn(fileVersionRepository, 'sumExistingSizesByUser')
        .mockResolvedValueOnce(0);

      const result = await service.getUserUsedStorage(userMocked);

      expect(result).toEqual(filesUsage);
    });

    it('When user has no files and no versions, it should return 0', async () => {
      jest
        .spyOn(service, 'getUserUsedStorageIncrementally')
        .mockResolvedValueOnce(null);
      jest
        .spyOn(fileVersionRepository, 'sumExistingSizesByUser')
        .mockResolvedValueOnce(0);

      const result = await service.getUserUsedStorage(userMocked);

      expect(result).toEqual(0);
    });
  });

  describe('deleteFilePermanently', () => {
    const mockFile = newFile({ owner: userMocked });

    it('When the file exists and is owned by the user, then it should delete the file and return its id and uuid', async () => {
      const mockFileFound = {
        ...mockFile,
        isOwnedBy: (user: User) => user.id === userMocked.id,
      } as any;
      jest.spyOn(fileRepository, 'findOneBy').mockResolvedValue(mockFileFound);

      jest
        .spyOn(sharingService, 'bulkRemoveSharings')
        .mockResolvedValue(undefined);
      jest
        .spyOn(thumbnailUseCases, 'deleteThumbnailByFileUuid')
        .mockResolvedValue(undefined);
      jest
        .spyOn(fileRepository, 'deleteFilesByUser')
        .mockResolvedValue(undefined);

      const result = await service.deleteFilePermanently(userMocked, {
        id: mockFile.id,
      });

      expect(result).toEqual({ id: mockFile.id, uuid: mockFile.uuid });
      expect(fileRepository.findOneBy).toHaveBeenCalledWith({
        id: mockFile.id,
        removed: false,
      });
      expect(sharingService.bulkRemoveSharings).toHaveBeenCalledWith(
        userMocked,
        [mockFile.uuid],
        SharingItemType.File,
      );
      expect(thumbnailUseCases.deleteThumbnailByFileUuid).toHaveBeenCalledWith(
        userMocked,
        mockFile.uuid,
      );
      expect(fileRepository.deleteFilesByUser).toHaveBeenCalledWith(
        userMocked,
        [mockFileFound],
      );
    });

    it('When the file does not exist, then it should throw a NotFoundException', async () => {
      jest.spyOn(fileRepository, 'findOneBy').mockResolvedValue(null);

      await expect(
        service.deleteFilePermanently(userMocked, { id: mockFile.id }),
      ).rejects.toThrow(NotFoundException);
    });

    it('When the file is not owned by the user, then it should throw a ForbiddenException', async () => {
      const anotherUser = newUser();

      jest.spyOn(fileRepository, 'findOneBy').mockResolvedValue({
        ...mockFile,
        userId: anotherUser.id,
        isOwnedBy: (user: User) => user.id === anotherUser.id,
      } as any);

      await expect(
        service.deleteFilePermanently(userMocked, { id: mockFile.id }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getFile', () => {
    const mockFile = newFile();

    it('When the file exists, then it should return the file', async () => {
      jest.spyOn(fileRepository, 'findOneBy').mockResolvedValueOnce(mockFile);

      const result = await service.getFile({ id: mockFile.id });

      expect(result).toEqual(mockFile);
      expect(fileRepository.findOneBy).toHaveBeenCalledWith({
        id: mockFile.id,
      });
    });

    it('When the file does not exist, then it should return null', async () => {
      jest.spyOn(fileRepository, 'findOneBy').mockResolvedValueOnce(null);

      const result = await service.getFile({ id: mockFile.id });

      expect(result).toBeNull();
      expect(fileRepository.findOneBy).toHaveBeenCalledWith({
        id: mockFile.id,
      });
    });
  });

  describe('deleteFileByFileId', () => {
    const testBucketId = 'test-bucket';
    const testFileId = 'test-file-id';
    const mockFile = newFile({
      attributes: {
        fileId: testFileId,
        name: 'encrypted-name',
        type: 'jpg',
        size: BigInt(1000),
        bucket: testBucketId,
        folderId: 4,
        encryptVersion: '1',
      },
    });

    it('when file exists in db, should delete it permanently and return fileExistedInDb=true with id and uuid', async () => {
      jest.spyOn(fileRepository, 'findOneBy').mockResolvedValue(mockFile);
      jest.spyOn(service, 'deleteFilePermanently').mockResolvedValue({
        id: mockFile.id,
        uuid: mockFile.uuid,
      });

      const result = await service.deleteFileByFileId(
        userMocked,
        testBucketId,
        testFileId,
      );

      expect(fileRepository.findOneBy).toHaveBeenCalledWith({
        fileId: testFileId,
      });
      expect(service.deleteFilePermanently).toHaveBeenCalledWith(userMocked, {
        uuid: mockFile.uuid,
      });
      expect(result).toEqual({
        fileExistedInDb: true,
        id: mockFile.id,
        uuid: mockFile.uuid,
      });
    });

    it('when file does not exist in db, should delete from network and return fileExistedInDb=false', async () => {
      jest.spyOn(fileRepository, 'findOneBy').mockResolvedValue(null);
      jest.spyOn(bridgeService, 'deleteFile').mockResolvedValue(undefined);

      const result = await service.deleteFileByFileId(
        userMocked,
        testBucketId,
        testFileId,
      );

      expect(fileRepository.findOneBy).toHaveBeenCalledWith({
        fileId: testFileId,
      });
      expect(bridgeService.deleteFile).toHaveBeenCalledWith(
        userMocked,
        testBucketId,
        testFileId,
      );
      expect(result).toEqual({
        fileExistedInDb: false,
      });
    });

    it('when file does not exist in db and network deletion fails, should throw InternalServerErrorException', async () => {
      jest.spyOn(fileRepository, 'findOneBy').mockResolvedValue(null);
      jest
        .spyOn(bridgeService, 'deleteFile')
        .mockRejectedValue(new Error('Network error'));

      await expect(
        service.deleteFileByFileId(userMocked, testBucketId, testFileId),
      ).rejects.toThrow('Error deleting file from network');
    });
  });

  describe('getFileMetadata', () => {
    it('When file exists, then it should return the file', async () => {
      const mockFile = newFile({ owner: userMocked });
      jest.spyOn(fileRepository, 'findByUuid').mockResolvedValue(mockFile);
      jest.spyOn(cryptoService, 'decryptName').mockReturnValue('');

      const result = await service.getFileMetadata(userMocked, mockFile.uuid);

      expect(result).toEqual(
        File.build({
          ...mockFile,
          name: mockFile.plainName,
        }),
      );
      expect(fileRepository.findByUuid).toHaveBeenCalledWith(
        mockFile.uuid,
        userMocked.id,
      );
    });

    it('When file does not exist, then it should throw NotFoundException', async () => {
      jest.spyOn(fileRepository, 'findByUuid').mockResolvedValue(null);

      await expect(
        service.getFileMetadata(userMocked, 'non-existent-uuid'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getFileVersions', () => {
    const mockLimits = newVersioningLimits({ retentionDays: 30 });

    it('When file exists, then it should return versions with expiresAt', async () => {
      const mockFile = newFile();
      const createdAt = new Date('2025-01-01');
      const mockVersions = [
        newFileVersion({
          attributes: {
            fileId: mockFile.uuid,
            createdAt,
          },
        }),
      ];

      jest.spyOn(fileRepository, 'findByUuid').mockResolvedValue(mockFile);
      jest
        .spyOn(fileVersionRepository, 'findAllByFileId')
        .mockResolvedValue(mockVersions);
      jest
        .spyOn(featureLimitService, 'getFileVersioningLimits')
        .mockResolvedValue(mockLimits);

      const result = await service.getFileVersions(userMocked, mockFile.uuid);

      const expectedExpiresAt = new Date(createdAt);
      expectedExpiresAt.setDate(
        expectedExpiresAt.getDate() + mockLimits.retentionDays,
      );

      expect(result[0].expiresAt).toEqual(expectedExpiresAt);
      expect(result[0].id).toEqual(mockVersions[0].id);
      expect(fileRepository.findByUuid).toHaveBeenCalledWith(
        mockFile.uuid,
        userMocked.id,
        {},
      );
      expect(fileVersionRepository.findAllByFileId).toHaveBeenCalledWith(
        mockFile.uuid,
      );
    });

    it('When file does not exist, then it should throw NotFoundException', async () => {
      jest.spyOn(fileRepository, 'findByUuid').mockResolvedValue(null);

      await expect(
        service.getFileVersions(userMocked, 'non-existent-uuid'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteFileVersion', () => {
    it('When file and version exist, then it should delete the version', async () => {
      const mockFile = newFile({ attributes: { userId: userMocked.id } });
      const versionId = v4();
      const mockVersion = newFileVersion({
        attributes: {
          id: versionId,
          fileId: mockFile.uuid,
        },
      });

      jest.spyOn(fileRepository, 'findByUuid').mockResolvedValue(mockFile);
      jest
        .spyOn(fileVersionRepository, 'findById')
        .mockResolvedValue(mockVersion);
      jest.spyOn(fileVersionRepository, 'updateStatus').mockResolvedValue();

      await service.deleteFileVersion(userMocked, mockFile.uuid, versionId);

      expect(fileVersionRepository.updateStatus).toHaveBeenCalledWith(
        versionId,
        FileVersionStatus.DELETED,
      );
    });

    it('When file does not exist, then it should throw NotFoundException', async () => {
      jest.spyOn(fileRepository, 'findByUuid').mockResolvedValue(null);

      await expect(
        service.deleteFileVersion(userMocked, 'non-existent-uuid', v4()),
      ).rejects.toThrow(NotFoundException);
    });

    it('When version does not exist, then it should throw NotFoundException', async () => {
      const mockFile = newFile({ attributes: { userId: userMocked.id } });
      jest.spyOn(fileRepository, 'findByUuid').mockResolvedValue(mockFile);
      jest.spyOn(fileVersionRepository, 'findById').mockResolvedValue(null);

      await expect(
        service.deleteFileVersion(userMocked, mockFile.uuid, v4()),
      ).rejects.toThrow(NotFoundException);
    });

    it('When version does not belong to file, then it should throw BadRequestException', async () => {
      const mockFile = newFile({ attributes: { userId: userMocked.id } });
      const mockVersion = newFileVersion({
        attributes: {
          fileId: 'different-file-uuid',
        },
      });

      jest.spyOn(fileRepository, 'findByUuid').mockResolvedValue(mockFile);
      jest
        .spyOn(fileVersionRepository, 'findById')
        .mockResolvedValue(mockVersion);

      await expect(
        service.deleteFileVersion(userMocked, mockFile.uuid, mockVersion.id),
      ).rejects.toThrow(BadRequestException);
    });

    it('When deleting a version, then file should not be modified', async () => {
      const mockFile = newFile({ attributes: { userId: userMocked.id } });
      const versionId = v4();
      const mockVersion = newFileVersion({
        attributes: {
          id: versionId,
          fileId: mockFile.uuid,
        },
      });

      jest.spyOn(fileRepository, 'findByUuid').mockResolvedValue(mockFile);
      jest
        .spyOn(fileVersionRepository, 'findById')
        .mockResolvedValue(mockVersion);
      jest.spyOn(fileVersionRepository, 'updateStatus').mockResolvedValue();
      const updateFileSpy = jest
        .spyOn(fileRepository, 'updateByUuidAndUserId')
        .mockResolvedValue();

      await service.deleteFileVersion(userMocked, mockFile.uuid, versionId);

      expect(updateFileSpy).not.toHaveBeenCalled();
    });
  });

  describe('restoreFileVersion', () => {
    it('When file and version exist, then it should restore the version', async () => {
      const mockFile = newFile({ attributes: { userId: userMocked.id } });
      const versionId = v4();
      const mockVersion = newFileVersion({
        attributes: {
          id: versionId,
          fileId: mockFile.uuid,
          networkFileId: 'old-network-id',
          size: BigInt(100),
        },
      });

      jest.spyOn(fileRepository, 'findByUuid').mockResolvedValue(mockFile);
      jest
        .spyOn(fileVersionRepository, 'findById')
        .mockResolvedValue(mockVersion);
      jest
        .spyOn(fileVersionRepository, 'findAllByFileId')
        .mockResolvedValue([mockVersion]);
      jest
        .spyOn(fileVersionRepository, 'updateStatusBatch')
        .mockResolvedValue();
      jest.spyOn(fileRepository, 'updateByUuidAndUserId').mockResolvedValue();

      const result = await service.restoreFileVersion(
        userMocked,
        mockFile.uuid,
        versionId,
      );

      expect(result.uuid).toEqual(mockFile.uuid);
      expect(result.fileId).toEqual(mockVersion.networkFileId);
      expect(result.size).toEqual(mockVersion.size);
      expect(fileVersionRepository.updateStatusBatch).toHaveBeenCalled();
      expect(fileRepository.updateByUuidAndUserId).toHaveBeenCalledWith(
        mockFile.uuid,
        userMocked.id,
        expect.objectContaining({
          fileId: mockVersion.networkFileId,
          size: mockVersion.size,
        }),
      );
    });

    it('When file does not exist, then it should throw NotFoundException', async () => {
      jest.spyOn(fileRepository, 'findByUuid').mockResolvedValue(null);

      await expect(
        service.restoreFileVersion(userMocked, 'non-existent-uuid', v4()),
      ).rejects.toThrow(NotFoundException);
    });

    it('When version does not exist, then it should throw NotFoundException', async () => {
      const mockFile = newFile({ attributes: { userId: userMocked.id } });
      jest.spyOn(fileRepository, 'findByUuid').mockResolvedValue(mockFile);
      jest.spyOn(fileVersionRepository, 'findById').mockResolvedValue(null);

      await expect(
        service.restoreFileVersion(userMocked, mockFile.uuid, v4()),
      ).rejects.toThrow(NotFoundException);
    });

    it('When version does not belong to file, then it should throw BadRequestException', async () => {
      const mockFile = newFile({ attributes: { userId: userMocked.id } });
      const mockVersion = newFileVersion({
        attributes: {
          fileId: 'different-file-uuid',
        },
      });

      jest.spyOn(fileRepository, 'findByUuid').mockResolvedValue(mockFile);
      jest
        .spyOn(fileVersionRepository, 'findById')
        .mockResolvedValue(mockVersion);

      await expect(
        service.restoreFileVersion(userMocked, mockFile.uuid, mockVersion.id),
      ).rejects.toThrow(BadRequestException);
    });

    it('When version is deleted, then it should throw BadRequestException', async () => {
      const mockFile = newFile({ attributes: { userId: userMocked.id } });
      const mockVersion = newFileVersion({
        attributes: {
          fileId: mockFile.uuid,
          status: FileVersionStatus.DELETED,
        },
      });

      jest.spyOn(fileRepository, 'findByUuid').mockResolvedValue(mockFile);
      jest
        .spyOn(fileVersionRepository, 'findById')
        .mockResolvedValue(mockVersion);

      await expect(
        service.restoreFileVersion(userMocked, mockFile.uuid, mockVersion.id),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('replaceFile', () => {
    it('When file exists, then it should replace file data and delete old file from network', async () => {
      const mockFile = newFile({
        attributes: { fileId: 'old-file-id-string', bucket: 'test-bucket' },
      });
      const replaceData = { fileId: 'new-file-id', size: BigInt(200) };

      jest.spyOn(fileRepository, 'findByUuid').mockResolvedValue(mockFile);
      jest.spyOn(fileRepository, 'updateByUuidAndUserId').mockResolvedValue();
      jest.spyOn(bridgeService, 'deleteFile').mockResolvedValue();

      const result = await service.replaceFile(
        userMocked,
        mockFile.uuid,
        replaceData,
      );

      expect(fileRepository.findByUuid).toHaveBeenCalledWith(
        mockFile.uuid,
        userMocked.id,
      );
      expect(fileRepository.updateByUuidAndUserId).toHaveBeenCalledWith(
        mockFile.uuid,
        userMocked.id,
        {
          fileId: replaceData.fileId,
          size: replaceData.size,
        },
      );
      expect(bridgeService.deleteFile).toHaveBeenCalledWith(
        userMocked,
        mockFile.bucket,
        mockFile.fileId,
      );
      expect(result).toEqual({
        ...mockFile.toJSON(),
        fileId: replaceData.fileId,
        size: replaceData.size,
      });
    });

    it('When file exists and modificationTime was passed, then it should replace file data with modificationTime', async () => {
      const mockFile = newFile({
        attributes: { fileId: 'old-file-id-string', bucket: 'test-bucket' },
      });
      const replaceData = {
        fileId: 'new-file-id',
        size: BigInt(200),
        modificationTime: new Date(),
      };

      jest.spyOn(fileRepository, 'findByUuid').mockResolvedValue(mockFile);
      jest.spyOn(fileRepository, 'updateByUuidAndUserId').mockResolvedValue();
      jest.spyOn(bridgeService, 'deleteFile').mockResolvedValue();

      const result = await service.replaceFile(
        userMocked,
        mockFile.uuid,
        replaceData,
      );

      expect(fileRepository.findByUuid).toHaveBeenCalledWith(
        mockFile.uuid,
        userMocked.id,
      );
      expect(fileRepository.updateByUuidAndUserId).toHaveBeenCalledWith(
        mockFile.uuid,
        userMocked.id,
        {
          fileId: replaceData.fileId,
          size: replaceData.size,
          modificationTime: replaceData.modificationTime,
        },
      );
      expect(bridgeService.deleteFile).toHaveBeenCalledWith(
        userMocked,
        mockFile.bucket,
        mockFile.fileId,
      );
      expect(result).toEqual({
        ...mockFile.toJSON(),
        fileId: replaceData.fileId,
        size: replaceData.size,
      });
    });

    it('When file does not exist, then it should throw NotFoundException', async () => {
      jest.spyOn(fileRepository, 'findByUuid').mockResolvedValue(null);

      await expect(
        service.replaceFile(userMocked, 'non-existent-uuid', {
          fileId: 'new-id',
          size: BigInt(100),
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('When file is versionable, then it should create versions and not delete from network', async () => {
      const mockFile = newFile({
        attributes: {
          fileId: 'old-file-id',
          bucket: 'test-bucket',
          type: 'pdf',
          size: BigInt(100),
        },
      });
      const replaceData = {
        fileId: 'new-file-id',
        size: BigInt(200),
      };

      jest.spyOn(fileRepository, 'findByUuid').mockResolvedValue(mockFile);
      jest
        .spyOn(service, 'isFileVersionable')
        .mockResolvedValue({ versionable: true, limits: null });
      const applyRetentionSpy = jest
        .spyOn(service as any, 'applyRetentionPolicy')
        .mockResolvedValue(undefined);
      const upsertSpy = jest
        .spyOn(fileVersionRepository, 'upsert')
        .mockResolvedValue({} as any);
      jest.spyOn(fileRepository, 'updateByUuidAndUserId').mockResolvedValue();
      const deleteFileSpy = jest.spyOn(bridgeService, 'deleteFile');

      const result = await service.replaceFile(
        userMocked,
        mockFile.uuid,
        replaceData,
      );

      expect(applyRetentionSpy).toHaveBeenCalledWith(
        mockFile.uuid,
        userMocked.uuid,
      );
      expect(upsertSpy).toHaveBeenCalledWith({
        fileId: mockFile.uuid,
        userId: userMocked.id,
        networkFileId: mockFile.fileId,
        size: mockFile.size,
        status: 'EXISTS',
      });
      expect(fileRepository.updateByUuidAndUserId).toHaveBeenCalled();
      expect(deleteFileSpy).not.toHaveBeenCalled();
      expect(result).toEqual({
        ...mockFile.toJSON(),
        fileId: replaceData.fileId,
        size: replaceData.size,
      });
    });

    it('When file is not versionable due to limits, then it should use standard flow', async () => {
      const mockFile = newFile({
        attributes: {
          fileId: 'old-file-id',
          bucket: 'test-bucket',
          type: 'pdf',
        },
      });
      const replaceData = {
        fileId: 'new-file-id',
        size: BigInt(200),
      };

      jest.spyOn(fileRepository, 'findByUuid').mockResolvedValue(mockFile);
      jest
        .spyOn(service, 'isFileVersionable')
        .mockResolvedValue({ versionable: false, limits: null });
      const applyRetentionSpy = jest.spyOn(
        service as any,
        'applyRetentionPolicy',
      );
      const upsertSpy = jest.spyOn(fileVersionRepository, 'upsert');
      jest.spyOn(fileRepository, 'updateByUuidAndUserId').mockResolvedValue();
      jest.spyOn(bridgeService, 'deleteFile').mockResolvedValue();

      await service.replaceFile(userMocked, mockFile.uuid, replaceData);

      expect(applyRetentionSpy).not.toHaveBeenCalled();
      expect(upsertSpy).not.toHaveBeenCalled();
      expect(bridgeService.deleteFile).toHaveBeenCalledWith(
        userMocked,
        mockFile.bucket,
        mockFile.fileId,
      );
    });

    it('When file is not versionable due to extension, then it should use standard flow', async () => {
      const mockFile = newFile({
        attributes: {
          fileId: 'old-file-id',
          bucket: 'test-bucket',
          type: 'zip',
        },
      });
      const replaceData = {
        fileId: 'new-file-id',
        size: BigInt(200),
      };

      jest.spyOn(fileRepository, 'findByUuid').mockResolvedValue(mockFile);
      jest
        .spyOn(service, 'isFileVersionable')
        .mockResolvedValue({ versionable: false, limits: null });
      const applyRetentionSpy = jest.spyOn(
        service as any,
        'applyRetentionPolicy',
      );
      const upsertSpy = jest.spyOn(fileVersionRepository, 'upsert');
      jest.spyOn(fileRepository, 'updateByUuidAndUserId').mockResolvedValue();
      jest.spyOn(bridgeService, 'deleteFile').mockResolvedValue();

      await service.replaceFile(userMocked, mockFile.uuid, replaceData);

      expect(applyRetentionSpy).not.toHaveBeenCalled();
      expect(upsertSpy).not.toHaveBeenCalled();
      expect(bridgeService.deleteFile).toHaveBeenCalledWith(
        userMocked,
        mockFile.bucket,
        mockFile.fileId,
      );
    });

    describe('Empty file replacement', () => {
      it('When replacing with empty file and limit has not been reached, then it should replace successfully and set fileId to null', async () => {
        const mockFile = newFile({
          attributes: {
            fileId: 'old-file-id',
            size: BigInt(100),
          },
        });
        const replaceData = {
          fileId: 'new-file-id',
          size: BigInt(0),
        };

        const mockLimit = newFeatureLimit({
          label: LimitLabels.MaxZeroSizeFiles,
          type: LimitTypes.Counter,
          value: '1000',
        });

        jest.spyOn(fileRepository, 'findByUuid').mockResolvedValue(mockFile);
        jest
          .spyOn(featureLimitService, 'getUserLimitByLabel')
          .mockResolvedValue(mockLimit);
        jest
          .spyOn(fileRepository, 'getZeroSizeFilesCountByUser')
          .mockResolvedValue(5);
        jest
          .spyOn(service, 'isFileVersionable')
          .mockResolvedValue({ versionable: false, limits: null });
        const updateSpy = jest
          .spyOn(fileRepository, 'updateByUuidAndUserId')
          .mockResolvedValue();
        jest.spyOn(bridgeService, 'deleteFile').mockResolvedValue();

        const result = await service.replaceFile(
          userMocked,
          mockFile.uuid,
          replaceData,
        );

        expect(result).toEqual({
          ...mockFile.toJSON(),
          fileId: null,
          size: replaceData.size,
        });

        expect(updateSpy).toHaveBeenCalledWith(
          mockFile.uuid,
          userMocked.id,
          expect.objectContaining({
            fileId: null,
            size: BigInt(0),
          }),
        );

        expect(featureLimitService.getUserLimitByLabel).toHaveBeenCalledWith(
          LimitLabels.MaxZeroSizeFiles,
          userMocked,
        );
        expect(fileRepository.getZeroSizeFilesCountByUser).toHaveBeenCalledWith(
          userMocked.id,
        );
      });

      it('When replacing with empty file and limit is reached, then it should throw', async () => {
        const mockFile = newFile({
          attributes: {
            size: BigInt(100),
          },
        });
        const replaceData = {
          fileId: 'new-file-id',
          size: BigInt(0),
        };

        const mockLimit = newFeatureLimit({
          label: LimitLabels.MaxZeroSizeFiles,
          type: LimitTypes.Counter,
          value: '1000',
        });

        jest.spyOn(fileRepository, 'findByUuid').mockResolvedValue(mockFile);
        jest
          .spyOn(featureLimitService, 'getUserLimitByLabel')
          .mockResolvedValue(mockLimit);
        jest
          .spyOn(fileRepository, 'getZeroSizeFilesCountByUser')
          .mockResolvedValue(1000);

        await expect(
          service.replaceFile(userMocked, mockFile.uuid, replaceData),
        ).rejects.toThrow(BadRequestException);

        expect(featureLimitService.getUserLimitByLabel).toHaveBeenCalledWith(
          LimitLabels.MaxZeroSizeFiles,
          userMocked,
        );
        expect(fileRepository.getZeroSizeFilesCountByUser).toHaveBeenCalledWith(
          userMocked.id,
        );
      });

      it('When replacing with empty file and limit does not exist, then it should throw', async () => {
        const mockFile = newFile({
          attributes: {
            fileId: 'old-file-id',
            bucket: 'test-bucket',
            size: BigInt(100),
          },
        });
        const replaceData = {
          fileId: 'new-file-id',
          size: BigInt(0),
        };

        jest.spyOn(fileRepository, 'findByUuid').mockResolvedValue(mockFile);
        jest
          .spyOn(featureLimitService, 'getUserLimitByLabel')
          .mockResolvedValue(null);
        jest
          .spyOn(fileRepository, 'getZeroSizeFilesCountByUser')
          .mockResolvedValue(5);

        await expect(
          service.replaceFile(userMocked, mockFile.uuid, replaceData),
        ).rejects.toThrow(PaymentRequiredException);

        expect(featureLimitService.getUserLimitByLabel).toHaveBeenCalledWith(
          LimitLabels.MaxZeroSizeFiles,
          userMocked,
        );
        expect(fileRepository.getZeroSizeFilesCountByUser).toHaveBeenCalledWith(
          userMocked.id,
        );
      });
    });
  });

  describe('addOldAttributes', () => {
    it('When file has thumbnails, then it should add old attributes to thumbnails', () => {
      const thumbnails = [
        { bucketId: 'bucket1', bucketFile: 'file1' },
        { bucketId: 'bucket2', bucketFile: 'file2' },
      ] as any;

      const mockFile = newFile({
        attributes: { thumbnails },
      });

      const result = service.addOldAttributes(mockFile);

      expect(result.thumbnails[0]).toHaveProperty('bucket_id', 'bucket1');
      expect(result.thumbnails[0]).toHaveProperty('bucket_file', 'file1');
      expect(result.thumbnails[1]).toHaveProperty('bucket_id', 'bucket2');
      expect(result.thumbnails[1]).toHaveProperty('bucket_file', 'file2');
    });

    it('When file has no thumbnails, then it should handle empty array', () => {
      const mockFile = newFile({
        attributes: { thumbnails: [] },
      });

      const result = service.addOldAttributes(mockFile);

      expect(result.thumbnails).toEqual([]);
    });
  });

  describe('getOrphanFilesCount', () => {
    it('When called, then it should return orphan files count', async () => {
      const count = 5;
      jest
        .spyOn(fileRepository, 'getFilesWhoseFolderIdDoesNotExist')
        .mockResolvedValue(count);

      const result = await service.getOrphanFilesCount(userMocked.id);

      expect(result).toBe(count);
      expect(
        fileRepository.getFilesWhoseFolderIdDoesNotExist,
      ).toHaveBeenCalledWith(userMocked.id);
    });
  });

  describe('getTrashFilesCount', () => {
    it('When called, then it should return trashed files count', async () => {
      const count = 3;
      jest.spyOn(fileRepository, 'getFilesCountWhere').mockResolvedValue(count);

      const result = await service.getTrashFilesCount(userMocked.id);

      expect(result).toBe(count);
      expect(fileRepository.getFilesCountWhere).toHaveBeenCalledWith({
        userId: userMocked.id,
        status: FileStatus.TRASHED,
      });
    });
  });

  describe('getDriveFilesCount', () => {
    it('When called, then it should return drive files count', async () => {
      const count = 10;
      jest.spyOn(fileRepository, 'getFilesCountWhere').mockResolvedValue(count);

      const result = await service.getDriveFilesCount(userMocked.id);

      expect(result).toBe(count);
      expect(fileRepository.getFilesCountWhere).toHaveBeenCalledWith({
        userId: userMocked.id,
        status: FileStatus.EXISTS,
      });
    });
  });

  describe('findByPlainNameAndFolderId', () => {
    it('When file exists, then it should return the file', async () => {
      const mockFile = newFile();
      jest
        .spyOn(fileRepository, 'findByPlainNameAndFolderId')
        .mockResolvedValue(mockFile);

      const result = await service.findByPlainNameAndFolderId(
        userMocked.id,
        'test-file.txt',
        'txt',
        mockFile.folderId,
      );

      expect(result).toEqual(mockFile);
      expect(fileRepository.findByPlainNameAndFolderId).toHaveBeenCalledWith(
        userMocked.id,
        'test-file.txt',
        'txt',
        mockFile.folderId,
        FileStatus.EXISTS,
      );
    });

    it('When file does not exist, then it should return null', async () => {
      jest
        .spyOn(fileRepository, 'findByPlainNameAndFolderId')
        .mockResolvedValue(null);

      const result = await service.findByPlainNameAndFolderId(
        userMocked.id,
        'non-existent.txt',
        'txt',
        1,
      );

      expect(result).toBeNull();
    });
  });

  describe('deleteByUser', () => {
    it('When called with files, then it should delete files by user', async () => {
      const files = [newFile(), newFile()];
      jest.spyOn(fileRepository, 'deleteFilesByUser').mockResolvedValue();

      await service.deleteByUser(userMocked, files);

      expect(fileRepository.deleteFilesByUser).toHaveBeenCalledWith(
        userMocked,
        files,
      );
    });
  });

  describe('searchFilesInFolder', () => {
    it('When called with search filters, then it should search files in folder', async () => {
      const folder = newFolder();
      const searchFilter = [{ plainName: 'test', type: 'txt' }];
      const mockFiles = [newFile()];
      jest
        .spyOn(fileRepository, 'findFilesInFolderByName')
        .mockResolvedValue(mockFiles);

      const result = await service.searchFilesInFolder(folder, searchFilter);

      expect(result).toEqual(mockFiles);
      expect(fileRepository.findFilesInFolderByName).toHaveBeenCalledWith(
        folder.uuid,
        searchFilter,
      );
    });
  });

  describe('getFilesByFolderUuid', () => {
    it('When called with folder uuid and status, then it should return files', async () => {
      const folderUuid = v4();
      const status = FileStatus.EXISTS;
      const mockFiles = [newFile()];
      jest
        .spyOn(fileRepository, 'getFilesByFolderUuid')
        .mockResolvedValue(mockFiles);

      const result = await service.getFilesByFolderUuid(folderUuid, status);

      expect(result).toEqual(mockFiles);
      expect(fileRepository.getFilesByFolderUuid).toHaveBeenCalledWith(
        folderUuid,
        status,
      );
    });
  });

  describe('hasUploadedFiles', () => {
    it('When user has uploaded files, then it should return true', async () => {
      const mockFile = newFile();
      jest.spyOn(fileRepository, 'findOneBy').mockResolvedValue(mockFile);

      const result = await service.hasUploadedFiles(userMocked);

      expect(result).toBe(true);
      expect(fileRepository.findOneBy).toHaveBeenCalledWith({
        userId: userMocked.id,
      });
    });

    it('When user has not uploaded files, then it should return false', async () => {
      jest.spyOn(fileRepository, 'findOneBy').mockResolvedValue(null);

      const result = await service.hasUploadedFiles(userMocked);

      expect(result).toBe(false);
      expect(fileRepository.findOneBy).toHaveBeenCalledWith({
        userId: userMocked.id,
      });
    });
  });

  describe('getUserUsedStorageIncrementally', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
      jest.clearAllMocks();
    });

    it('When user has no existing usage, then it should create first usage calculation', async () => {
      const mockUser = newUser();
      const today = new Date('2024-01-02T10:00:00Z');
      const firstUsageDelta = 1000;
      const deltaChangeToday = 500;
      const expectedTotal = firstUsageDelta + deltaChangeToday;

      const mockFirstUsage = newUsage({
        attributes: {
          period: new Date('2024-01-01T00:00:00Z'),
          delta: firstUsageDelta,
        },
      });

      // Set today to the next period start date according to mockUsage
      jest.setSystemTime(today);

      jest
        .spyOn(usageService, 'getMostRecentTemporalUsage')
        .mockResolvedValue(null);
      jest
        .spyOn(usageService, 'calculateFirstTemporalUsage')
        .mockResolvedValue(mockFirstUsage);
      jest
        .spyOn(fileRepository, 'sumFileSizeDeltaFromDate')
        .mockResolvedValue(deltaChangeToday);

      const result = await service.getUserUsedStorageIncrementally(mockUser);

      expect(usageService.getMostRecentTemporalUsage).toHaveBeenCalledWith(
        mockUser.uuid,
      );
      expect(usageService.calculateFirstTemporalUsage).toHaveBeenCalledWith(
        mockUser.uuid,
      );
      expect(fileRepository.sumFileSizeDeltaFromDate).toHaveBeenCalledWith(
        mockUser.id,
        mockFirstUsage.getNextPeriodStartDate(),
      );
      expect(result).toEqual(expectedTotal);
    });

    it('When user has recent usage and is up to date, then it should not create new usage', async () => {
      const mockUser = newUser();
      const today = new Date('2024-01-02T00:00:00Z');
      const aggregatedUsage = 2000;
      const deltaChangeSinceLastUsage = 300;
      const expectedTotal = aggregatedUsage + deltaChangeSinceLastUsage;

      const mockUsage = newUsage({
        attributes: { period: new Date('2024-01-01T00:00:00Z') },
      });

      // Set today to the next period start date according to mockUsage
      jest.setSystemTime(today);

      jest
        .spyOn(usageService, 'getMostRecentTemporalUsage')
        .mockResolvedValue(mockUsage);
      jest
        .spyOn(usageService, 'calculateAggregatedUsage')
        .mockResolvedValue(aggregatedUsage);
      jest
        .spyOn(fileRepository, 'sumFileSizeDeltaFromDate')
        .mockResolvedValue(deltaChangeSinceLastUsage);

      const result = await service.getUserUsedStorageIncrementally(mockUser);

      expect(usageService.getMostRecentTemporalUsage).toHaveBeenCalledWith(
        mockUser.uuid,
      );
      expect(usageService.calculateAggregatedUsage).toHaveBeenCalledWith(
        mockUser.uuid,
      );
      expect(fileRepository.sumFileSizeDeltaFromDate).toHaveBeenCalledWith(
        mockUser.id,
        mockUsage.getNextPeriodStartDate(),
      );
      expect(usageService.createDailyUsage).not.toHaveBeenCalled();
      expect(
        fileRepository.sumFileSizeDeltaBetweenDates,
      ).not.toHaveBeenCalled();
      expect(result).toEqual(expectedTotal);
    });

    it('When user has recent usage but needs update, then it should calculate gap delta and create monthly usage', async () => {
      const mockUser = newUser();
      const today = new Date('2024-01-04T10:00:00Z');
      const yesterday = Time.dateWithTimeAdded(-1, 'day', today);
      const aggregatedUsage = 3000;
      const deltaChangeSinceLastUsage = 400;
      const mockGapDelta = 500;
      const expectedTotal = aggregatedUsage + deltaChangeSinceLastUsage;

      const mockUsage = newUsage({
        attributes: { period: new Date('2024-01-01T00:00:00Z') },
      });

      // Set today to a date after the next period start date according to mockUsage
      jest.setSystemTime(today);
      jest
        .spyOn(usageService, 'getMostRecentTemporalUsage')
        .mockResolvedValue(mockUsage);
      jest
        .spyOn(usageService, 'calculateAggregatedUsage')
        .mockResolvedValue(aggregatedUsage);
      jest
        .spyOn(fileRepository, 'sumFileSizeDeltaFromDate')
        .mockResolvedValue(deltaChangeSinceLastUsage);
      jest
        .spyOn(fileRepository, 'sumFileSizeDeltaBetweenDates')
        .mockResolvedValue(mockGapDelta);
      jest.spyOn(usageService, 'createDailyUsage').mockResolvedValue(undefined);

      const result = await service.getUserUsedStorageIncrementally(mockUser);

      expect(usageService.getMostRecentTemporalUsage).toHaveBeenCalledWith(
        mockUser.uuid,
      );
      expect(usageService.calculateAggregatedUsage).toHaveBeenCalledWith(
        mockUser.uuid,
      );
      expect(fileRepository.sumFileSizeDeltaFromDate).toHaveBeenCalledWith(
        mockUser.id,
        mockUsage.getNextPeriodStartDate(),
      );
      expect(fileRepository.sumFileSizeDeltaBetweenDates).toHaveBeenCalledWith(
        mockUser.id,
        mockUsage.getNextPeriodStartDate(),
        Time.endOfDay(yesterday),
      );
      expect(usageService.createDailyUsage).toHaveBeenCalledWith(
        mockUser.uuid,
        yesterday,
        mockGapDelta,
      );
      expect(result).toEqual(expectedTotal);
    });

    it('When backfill throws an error, then it should log the error but still return the calculated usage', async () => {
      const mockUser = newUser();
      const today = new Date('2024-01-04T10:00:00Z');
      const aggregatedUsage = 3500;
      const deltaChangeSinceLastUsage = 600;
      const expectedTotal = aggregatedUsage + deltaChangeSinceLastUsage;

      const mockUsage = newUsage({
        attributes: { period: new Date('2024-01-01T00:00:00Z') },
      });

      jest.setSystemTime(today);
      jest
        .spyOn(usageService, 'getMostRecentTemporalUsage')
        .mockResolvedValue(mockUsage);
      jest
        .spyOn(usageService, 'calculateAggregatedUsage')
        .mockResolvedValue(aggregatedUsage);
      jest
        .spyOn(fileRepository, 'sumFileSizeDeltaFromDate')
        .mockResolvedValue(deltaChangeSinceLastUsage);
      jest
        .spyOn(fileRepository, 'sumFileSizeDeltaBetweenDates')
        .mockRejectedValue(new Error('Database connection error'));

      const result = await service.getUserUsedStorageIncrementally(mockUser);

      expect(result).toEqual(expectedTotal);
    });
  });

  describe('addFileReplacementDelta', () => {
    const mockUser = newUser();
    const oldFile = newFile({
      attributes: {
        fileId: v4(),
        size: BigInt(100),
      },
    });
    const newFileData = newFile({
      attributes: {
        fileId: v4(),
        size: BigInt(200),
      },
    });

    it('When lock can not be acquired due to an error, then it should set the lock to true to allow delta calculation', async () => {
      const lockError = new Error('Redis connection failed');
      jest
        .spyOn(redisService, 'tryAcquireLock')
        .mockRejectedValueOnce(lockError);
      jest
        .spyOn(usageService, 'addFileReplacementDelta')
        .mockResolvedValueOnce(null);

      const result = await service.addFileReplacementDelta(
        mockUser,
        oldFile,
        newFileData,
      );

      expect(result).toBeNull();
      expect(usageService.addFileReplacementDelta).toHaveBeenCalled();
    });

    it('When lock is acquired, then it should call the usage service', async () => {
      const mockUsage = newUsage();
      jest.spyOn(redisService, 'tryAcquireLock').mockResolvedValueOnce(true);
      jest
        .spyOn(usageService, 'addFileReplacementDelta')
        .mockResolvedValueOnce(mockUsage);

      const result = await service.addFileReplacementDelta(
        mockUser,
        oldFile,
        newFileData,
      );

      expect(result).toEqual(mockUsage);
      expect(redisService.tryAcquireLock).toHaveBeenCalledWith(
        `file-size-change:${newFileData.fileId}`,
        3000,
      );
      expect(usageService.addFileReplacementDelta).toHaveBeenCalledWith(
        mockUser,
        oldFile,
        newFileData,
      );
    });
  });

  describe('isFileVersionable', () => {
    const userUuid = 'user-uuid';
    const premiumLimits = {
      enabled: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      retentionDays: 15,
      maxVersions: 10,
    };
    const freeLimits = {
      enabled: false,
      maxFileSize: 0,
      retentionDays: 0,
      maxVersions: 0,
    };

    it('When file has valid extension and user has premium tier, then it is versionable', async () => {
      jest
        .spyOn(featureLimitService, 'getFileVersioningLimits')
        .mockResolvedValueOnce(premiumLimits);

      const result = await service.isFileVersionable(
        userUuid,
        VersionableFileExtension.PDF,
        BigInt(1024),
      );

      expect(result.versionable).toBe(true);
      expect(result.limits).toEqual(premiumLimits);
    });

    it('When file has unsupported extension, then it is not versionable', async () => {
      const result = await service.isFileVersionable(
        userUuid,
        'jpg' as any,
        BigInt(1024),
      );

      expect(result.versionable).toBe(false);
      expect(result.limits).toBeNull();
    });

    it('When user has free tier (versioning disabled), then file is not versionable', async () => {
      jest
        .spyOn(featureLimitService, 'getFileVersioningLimits')
        .mockResolvedValueOnce(freeLimits);

      const result = await service.isFileVersionable(
        userUuid,
        VersionableFileExtension.PDF,
        BigInt(1024),
      );

      expect(result.versionable).toBe(false);
      expect(result.limits).toEqual(freeLimits);
    });

    it('When file size is at tier limit, then it is versionable', async () => {
      jest
        .spyOn(featureLimitService, 'getFileVersioningLimits')
        .mockResolvedValueOnce(premiumLimits);

      const result = await service.isFileVersionable(
        userUuid,
        VersionableFileExtension.PDF,
        BigInt(10 * 1024 * 1024),
      );

      expect(result.versionable).toBe(true);
      expect(result.limits).toEqual(premiumLimits);
    });

    it('When file size exceeds tier limit, then it is not versionable', async () => {
      jest
        .spyOn(featureLimitService, 'getFileVersioningLimits')
        .mockResolvedValueOnce(premiumLimits);

      const result = await service.isFileVersionable(
        userUuid,
        VersionableFileExtension.PDF,
        BigInt(11 * 1024 * 1024),
      );

      expect(result.versionable).toBe(false);
      expect(result.limits).toEqual(premiumLimits);
    });

    it('When all conditions are valid, then file is versionable with limits', async () => {
      jest
        .spyOn(featureLimitService, 'getFileVersioningLimits')
        .mockResolvedValueOnce(premiumLimits);

      const result = await service.isFileVersionable(
        userUuid,
        VersionableFileExtension.PDF,
        BigInt(5 * 1024 * 1024),
      );

      expect(result.versionable).toBe(true);
      expect(result.limits).toEqual(premiumLimits);
    });
  });

  describe('applyRetentionPolicy', () => {
    const userUuid = 'user-uuid';
    const premiumLimits = {
      enabled: true,
      maxFileSize: 100 * 1024 * 1024,
      retentionDays: 30,
      maxVersions: 10,
    };

    it('When versioning is disabled, then it returns early', async () => {
      jest
        .spyOn(featureLimitService, 'getFileVersioningLimits')
        .mockResolvedValue({ ...premiumLimits, enabled: false });

      const findAllByFileIdSpy = jest.spyOn(
        fileVersionRepository,
        'findAllByFileId',
      );

      await service['applyRetentionPolicy']('file-uuid', userUuid);

      expect(findAllByFileIdSpy).not.toHaveBeenCalled();
    });

    it('When no versions exist, then no versions are deleted', async () => {
      jest
        .spyOn(featureLimitService, 'getFileVersioningLimits')
        .mockResolvedValue(premiumLimits);

      jest
        .spyOn(fileVersionRepository, 'findAllByFileId')
        .mockResolvedValue([]);

      const updateStatusBatchSpy = jest
        .spyOn(fileVersionRepository, 'updateStatusBatch')
        .mockResolvedValue(undefined);

      await service['applyRetentionPolicy']('file-uuid', userUuid);

      expect(updateStatusBatchSpy).not.toHaveBeenCalled();
    });

    it('When versions exist within retention period and under limit, then no versions are deleted', async () => {
      jest
        .spyOn(featureLimitService, 'getFileVersioningLimits')
        .mockResolvedValue(premiumLimits);

      const mockVersions = [
        {
          id: '1',
          createdAt: new Date(),
          status: 'EXISTS',
        },
        {
          id: '2',
          createdAt: new Date(),
          status: 'EXISTS',
        },
      ];

      jest
        .spyOn(fileVersionRepository, 'findAllByFileId')
        .mockResolvedValue(mockVersions as any);

      const updateStatusBatchSpy = jest
        .spyOn(fileVersionRepository, 'updateStatusBatch')
        .mockResolvedValue(undefined);

      await service['applyRetentionPolicy']('file-uuid', userUuid);

      expect(updateStatusBatchSpy).not.toHaveBeenCalled();
    });

    it('When limit is reached with recent versions, then oldest is deleted', async () => {
      jest
        .spyOn(featureLimitService, 'getFileVersioningLimits')
        .mockResolvedValue(premiumLimits);

      const mockVersions = Array.from({ length: 10 }, (_, i) => ({
        id: `${i + 1}`,
        createdAt: new Date(Date.now() - i * 1000),
        status: 'EXISTS',
      }));

      jest
        .spyOn(fileVersionRepository, 'findAllByFileId')
        .mockResolvedValue(mockVersions as any);

      const updateStatusBatchSpy = jest
        .spyOn(fileVersionRepository, 'updateStatusBatch')
        .mockResolvedValue(undefined);

      await service['applyRetentionPolicy']('file-uuid', userUuid);

      expect(updateStatusBatchSpy).toHaveBeenCalledWith(['10'], 'DELETED');
    });

    it('When versions exceed limit, then excess versions are deleted', async () => {
      jest
        .spyOn(featureLimitService, 'getFileVersioningLimits')
        .mockResolvedValue(premiumLimits);

      const now = new Date();
      const mockVersions = Array.from({ length: 12 }, (_, i) => ({
        id: `${i + 1}`,
        createdAt: new Date(now.getTime() - i * 24 * 60 * 60 * 1000),
        status: 'EXISTS',
      }));

      jest
        .spyOn(fileVersionRepository, 'findAllByFileId')
        .mockResolvedValue(mockVersions as any);
      const updateStatusBatchSpy = jest
        .spyOn(fileVersionRepository, 'updateStatusBatch')
        .mockResolvedValue(undefined);

      await service['applyRetentionPolicy']('file-uuid', userUuid);

      expect(updateStatusBatchSpy).toHaveBeenCalled();
    });
  });

  describe('getVersioningLimits', () => {
    it('When called with a valid user id, then the versioning limits are returned', async () => {
      const userUuid = v4();
      const expectedLimits = newVersioningLimits();

      jest
        .spyOn(featureLimitService, 'getFileVersioningLimits')
        .mockResolvedValue(expectedLimits);

      const result = await service.getVersioningLimits(userUuid);

      expect(result).toEqual(expectedLimits);
      expect(featureLimitService.getFileVersioningLimits).toHaveBeenCalledWith(
        userUuid,
      );
    });

    it('When an error occurs, then it should propagate the error', async () => {
      const userUuid = v4();
      const error = new NotFoundException('User not found');

      jest
        .spyOn(featureLimitService, 'getFileVersioningLimits')
        .mockRejectedValue(error);

      await expect(service.getVersioningLimits(userUuid)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
