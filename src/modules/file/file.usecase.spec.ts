import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { FileUseCases } from './file.usecase';
import { SequelizeFileRepository, FileRepository } from './file.repository';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  File,
  FileAttributes,
  FileStatus,
  SortableFileAttributes,
} from './file.domain';
import { User } from '../user/user.domain';
import { BridgeModule } from '../../externals/bridge/bridge.module';
import { CryptoModule } from '../../externals/crypto/crypto.module';
import { CryptoService } from '../../externals/crypto/crypto.service';
import { BridgeService } from '../../externals/bridge/bridge.service';
import {
  FolderRepository,
  SequelizeFolderRepository,
} from '../folder/folder.repository';
import {
  newFile,
  newFolder,
  newUser,
  newWorkspace,
} from '../../../test/fixtures';
import { FolderUseCases } from '../folder/folder.usecase';
import { v4 } from 'uuid';
import { SharingService } from '../sharing/sharing.service';
import { SharingItemType } from '../sharing/sharing.domain';
import { CreateFileDto } from './dto/create-file.dto';
import { UpdateFileMetaDto } from './dto/update-file-meta.dto';
import { ThumbnailUseCases } from '../thumbnail/thumbnail.usecase';

const fileId = '6295c99a241bb000083f1c6a';
const userId = 1;
const folderId = 4;
describe('FileUseCases', () => {
  let service: FileUseCases;
  let folderUseCases: FolderUseCases;
  let fileRepository: FileRepository;
  let folderRepository: FolderRepository;
  let sharingService: SharingService;
  let bridgeService: BridgeService;
  let cryptoService: CryptoService;
  let thumbnailUseCases: ThumbnailUseCases;

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
      imports: [BridgeModule, CryptoModule],
      providers: [FileUseCases, FolderUseCases, SharingService],
    })
      .useMocker(() => createMock())
      .compile();

    service = module.get<FileUseCases>(FileUseCases);
    fileRepository = module.get<FileRepository>(SequelizeFileRepository);
    folderRepository = module.get<FolderRepository>(SequelizeFolderRepository);
    folderUseCases = module.get<FolderUseCases>(FolderUseCases);
    bridgeService = module.get<BridgeService>(BridgeService);
    cryptoService = module.get<CryptoService>(CryptoService);
    sharingService = module.get<SharingService>(SharingService);
    thumbnailUseCases = module.get<ThumbnailUseCases>(ThumbnailUseCases);
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
      jest.spyOn(fileRepository, 'updateFilesStatusToTrashed');
      jest.spyOn(fileRepository, 'updateFilesStatusToTrashedByUuid');
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
    });

    it('When you try to trash files, then it stops sharing those files', async () => {
      const files = [newFile(), newFile(), newFile()];
      const fileUuids = ['656a3abb-36ab-47ee-8303-6e4198f2a32a'];
      const fileIds = [fileId];

      jest.spyOn(sharingService, 'bulkRemoveSharings');
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

    it('When file is not found then, thow NotFoundException', () => {
      jest.spyOn(fileRepository, 'findOneBy').mockResolvedValueOnce(undefined);

      expect(
        service.deleteFilePermanently(mockUser, { uuid: v4() }),
      ).rejects.toThrow(NotFoundException);
    });

    it('When user is not owner of the file, then throw ForbiddenException', () => {
      const unownedFile = newFile();
      jest
        .spyOn(fileRepository, 'findOneBy')
        .mockResolvedValueOnce(unownedFile);

      expect(
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

      const result = await service.moveFile(
        userMocked,
        file.uuid,
        destinationFolder.uuid,
      );

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
        },
      );
    });

    it('When file is moved but it is removed, then an error is thrown', () => {
      const mockFile = newFile({
        attributes: { userId: userMocked.id, removed: true },
      });

      jest.spyOn(fileRepository, 'findByUuid').mockResolvedValueOnce(mockFile);

      expect(
        service.moveFile(userMocked, file.uuid, destinationFolder.uuid),
      ).rejects.toThrow(`File ${file.uuid} can not be moved`);
    });

    it('When file is moved but the destination folder is removed, then an error is thrown', () => {
      const mockDestinationFolder = newFolder({
        attributes: { userId: userMocked.id, removed: true },
      });

      jest.spyOn(fileRepository, 'findByUuid').mockResolvedValueOnce(file);
      jest
        .spyOn(folderUseCases, 'getFolderByUuid')
        .mockResolvedValueOnce(mockDestinationFolder);

      expect(
        service.moveFile(userMocked, file.uuid, destinationFolder.uuid),
      ).rejects.toThrow(`File can not be moved to ${destinationFolder.uuid}`);
    });

    it('When a non existent file is moved to a folder, then it should throw a not found error', () => {
      jest.spyOn(fileRepository, 'findByUuid').mockResolvedValueOnce(null);
      expect(
        service.moveFile(userMocked, file.uuid, destinationFolder.uuid),
      ).rejects.toThrow(`File ${file.uuid} can not be moved`);
    });

    it('When a file is moved to a non existent folder, then it should throw a not found error', () => {
      jest.spyOn(fileRepository, 'findByUuid').mockResolvedValueOnce(file);
      jest.spyOn(folderUseCases, 'getFolderByUuid').mockResolvedValueOnce(null);
      expect(
        service.moveFile(userMocked, file.uuid, destinationFolder.uuid),
      ).rejects.toThrow(`File can not be moved to ${destinationFolder.uuid}`);
    });

    it('When file is moved to a folder that has been already moved to, then it should throw a conflict error', () => {
      jest.spyOn(fileRepository, 'findByUuid').mockResolvedValueOnce(file);
      jest
        .spyOn(folderRepository, 'findByUuid')
        .mockResolvedValueOnce(destinationFolder);
      jest.spyOn(cryptoService, 'encryptName').mockReturnValueOnce(file.name);
      jest
        .spyOn(fileRepository, 'findByPlainNameAndFolderId')
        .mockResolvedValueOnce(file);

      expect(
        service.moveFile(userMocked, file.uuid, destinationFolder.uuid),
      ).rejects.toThrow(`File ${file.uuid} was already moved to that location`);
    });

    it('When file is moved to a folder that has already a file with the same name, then it should throw a conflict error', () => {
      const conflictFile = newFile({
        attributes: {
          ...file,
          uuid: v4(),
        },
      });
      jest.spyOn(fileRepository, 'findByUuid').mockResolvedValueOnce(file);
      jest
        .spyOn(folderRepository, 'findByUuid')
        .mockResolvedValueOnce(destinationFolder);
      jest.spyOn(cryptoService, 'encryptName').mockReturnValueOnce(file.name);
      jest
        .spyOn(fileRepository, 'findByPlainNameAndFolderId')
        .mockResolvedValueOnce(conflictFile);

      expect(
        service.moveFile(userMocked, file.uuid, destinationFolder.uuid),
      ).rejects.toThrow(
        'A file with the same name already exists in destination folder',
      );
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

    it('When file is created successfully, then it should return the new file', async () => {
      const folder = newFolder({ attributes: { userId: userMocked.id } });

      jest.spyOn(folderUseCases, 'getByUuid').mockResolvedValueOnce(folder);
      jest
        .spyOn(fileRepository, 'findByPlainNameAndFolderId')
        .mockResolvedValueOnce(null);

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
      jest.spyOn(folderUseCases, 'getFolderByUserId').mockResolvedValue(null);

      expect(
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

      expect(
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
    it('When called, it should return the user total used space', async () => {
      const totalUsage = 1000;
      jest
        .spyOn(fileRepository, 'sumExistentFileSizes')
        .mockResolvedValueOnce(totalUsage);

      const result = await service.getUserUsedStorage(userMocked);
      expect(result).toEqual(totalUsage);
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

      expect(result).toEqual(mockFile);
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
});
