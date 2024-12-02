import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { FileUseCases } from './file.usecase';
import { SequelizeFileRepository, FileRepository } from './file.repository';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
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

  describe('delete file use case', () => {
    const incrementalUserId = 15494;
    const userMock = User.build({
      id: incrementalUserId,
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

    it.skip('should be able to delete a trashed file', async () => {
      const fileId = '6f10f732-59b1-525c-a2d0-ff538f687903';
      const file = {
        id: 1,
        fileId,
        deleted: true,
        userId: incrementalUserId,
      } as File;

      jest
        .spyOn(fileRepository, 'deleteByFileId')
        .mockImplementationOnce(() => Promise.resolve());

      jest
        .spyOn(bridgeService, 'deleteFile')
        .mockImplementationOnce(() => Promise.resolve());

      await service.deleteFilePermanently(file, userMock);

      expect(fileRepository.deleteByFileId).toHaveBeenCalledWith(fileId);
    });

    it.skip('should fail when the folder trying to delete has not been trashed', async () => {
      const fileId = 2618494108;
      const file = File.build({
        id: fileId,
        fileId: '6f10f732-59b1-525c-a2d0-ff538f687903',
        name: '',
        type: '',
        size: null,
        bucket: '',
        folderId: 4,
        encryptVersion: '',
        deleted: false,
        deletedAt: new Date(),
        userId: incrementalUserId,
        creationTime: new Date(),
        modificationTime: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        uuid: '',
        folderUuid: '',
        removed: false,
        removedAt: undefined,
        plainName: '',
        status: FileStatus.EXISTS,
      });

      jest.spyOn(fileRepository, 'deleteByFileId');

      expect(service.deleteFilePermanently(file, userMock)).rejects.toThrow(
        new UnprocessableEntityException(
          `file with id ${fileId} cannot be permanently deleted`,
        ),
      );
      expect(fileRepository.deleteByFileId).not.toHaveBeenCalled();
    });

    it.skip('should fail when the folder trying to delete is not owned by the user', async () => {
      const file = {
        userId: incrementalUserId + 1,
        deleted: true,
      } as File;

      jest.spyOn(bridgeService, 'deleteFile');
      jest.spyOn(fileRepository, 'deleteByFileId');

      expect(service.deleteFilePermanently(file, userMock)).rejects.toThrow(
        new ForbiddenException(`You are not owner of this share`),
      );
      expect(bridgeService.deleteFile).not.toHaveBeenCalled();
      expect(fileRepository.deleteByFileId).not.toHaveBeenCalled();
    });

    it.skip('should not delete a file from storage if delete shares fails', async () => {
      const fileId = 2618494108;
      const file = File.build({
        id: fileId,
        fileId: '6f10f732-59b1-525c-a2d0-ff538f687903',
        name: '',
        type: '',
        size: null,
        bucket: '',
        folderId: 4,
        encryptVersion: '',
        deleted: true,
        deletedAt: new Date(),
        userId: incrementalUserId,
        creationTime: new Date(),
        modificationTime: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        uuid: '',
        folderUuid: '',
        removed: false,
        removedAt: undefined,
        plainName: '',
        status: FileStatus.EXISTS,
      });

      const errorReason = new Error('reason');

      jest
        .spyOn(fileRepository, 'deleteByFileId')
        .mockImplementationOnce(() => Promise.resolve());
      jest.spyOn(bridgeService, 'deleteFile');

      expect.assertions(3);
      try {
        await service.deleteFilePermanently(file, userMock);
      } catch (err) {
        expect(err).toBe(errorReason);
      }

      expect(bridgeService.deleteFile).not.toHaveBeenCalled();
      expect(fileRepository.deleteByFileId).not.toHaveBeenCalled();
    });

    it.skip('should not delete a file from databse if could not be deleted from storage', async () => {
      const fileId = 2618494108;
      const file = File.build({
        id: fileId,
        fileId: '6f10f732-59b1-525c-a2d0-ff538f687903',
        name: '',
        type: '',
        size: null,
        bucket: '',
        folderId: 4,
        encryptVersion: '',
        deleted: true,
        deletedAt: new Date(),
        userId: incrementalUserId,
        creationTime: new Date(),
        modificationTime: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        user: userMock,
        uuid: '',
        folderUuid: '',
        removed: false,
        removedAt: undefined,
        plainName: '',
        status: FileStatus.EXISTS,
      });

      const errorReason = new Error('reason');

      jest
        .spyOn(fileRepository, 'deleteByFileId')
        .mockImplementationOnce(() => Promise.resolve());

      jest
        .spyOn(bridgeService, 'deleteFile')
        .mockImplementationOnce(() => Promise.reject(errorReason));

      expect.assertions(2);
      try {
        await service.deleteFilePermanently(file, userMock);
      } catch (err) {
        expect(err).toBe(errorReason);
      }

      expect(fileRepository.deleteByFileId).not.toHaveBeenCalled();
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

      const file = File.build({
        ...fileAttributes,
        name: encryptedName,
        folderId,
      });

      delete fileAttributes['user'];

      const result = service.decrypFileName(file);

      expect(result).toStrictEqual({
        ...fileAttributes,
        shares: undefined,
        thumbnails: undefined,
        sharings: undefined,
        folderId,
      });
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
        .spyOn(folderUseCases, 'getFolderByUuidAndUser')
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
        .spyOn(folderUseCases, 'getFolderByUuidAndUser')
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
      jest
        .spyOn(folderUseCases, 'getFolderByUuidAndUser')
        .mockResolvedValueOnce(null);
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
});
