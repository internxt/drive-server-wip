import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { FileUseCases } from './file.usecase';
import { SequelizeFileRepository, FileRepository } from './file.repository';
import {
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { File, FileAttributes, FileStatus } from './file.domain';
import { User } from '../user/user.domain';
import { BridgeModule } from '../../externals/bridge/bridge.module';
import { BridgeService } from '../../externals/bridge/bridge.service';
import { CryptoService } from '../../externals/crypto/crypto.service';
import {
  FolderRepository,
  SequelizeFolderRepository,
} from '../folder/folder.repository';
import { newFile, newFolder } from '../../../test/fixtures';
import { FolderUseCases } from '../folder/folder.usecase';
import { v4 } from 'uuid';
import { SharingService } from '../sharing/sharing.service';
import { SharingItemType } from '../sharing/sharing.domain';

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
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [BridgeModule],
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
      type: '',
      size: null,
      bucket: '',
      folderId: 4,
      encryptVersion: '',
      deleted: false,
      deletedAt: new Date(),
      userId: 1,
      modificationTime: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      uuid: '723274e5-ca2a-4e61-bf17-d9fba3b8d430',
      folderUuid: '',
      removed: false,
      removedAt: undefined,
      plainName: '',
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
        type: '',
        size: null,
        bucket: '',
        folderId: 4,
        encryptVersion: '',
        deleted: false,
        deletedAt: new Date(),
        userId: 1,
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
        .spyOn(cryptoService, 'decryptName')
        .mockReturnValueOnce(file.plainName);

      jest
        .spyOn(cryptoService, 'encryptName')
        .mockReturnValueOnce(expectedFile.name);

      jest
        .spyOn(fileRepository, 'findByNameAndFolderUuid')
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
      jest
        .spyOn(cryptoService, 'decryptName')
        .mockReturnValueOnce(file.plainName);
      jest.spyOn(cryptoService, 'encryptName').mockReturnValueOnce(file.name);
      jest
        .spyOn(fileRepository, 'findByNameAndFolderUuid')
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
      jest
        .spyOn(cryptoService, 'decryptName')
        .mockReturnValueOnce(file.plainName);
      jest.spyOn(cryptoService, 'encryptName').mockReturnValueOnce(file.name);
      jest
        .spyOn(fileRepository, 'findByNameAndFolderUuid')
        .mockResolvedValueOnce(conflictFile);

      expect(
        service.moveFile(userMocked, file.uuid, destinationFolder.uuid),
      ).rejects.toThrow(
        'A file with the same name already exists in destination folder',
      );
    });
  });

  describe('file path operations', () => {
    it('When get depth from path is requested, then it is returned', async () => {
      expect(service.getPathDepth('/folder')).toStrictEqual(0);
      expect(service.getPathDepth('folder')).toStrictEqual(0);
      expect(service.getPathDepth('/')).toStrictEqual(0);
      expect(service.getPathDepth('/file.png')).toStrictEqual(0);
      expect(service.getPathDepth('/subfolder/file.png')).toStrictEqual(1);
      expect(service.getPathDepth('subfolder/file.png')).toStrictEqual(1);
      expect(
        service.getPathDepth('/subfolder/other/test/file.png'),
      ).toStrictEqual(3);
    });

    it('When get last folder name from path is requested, then it is returned', async () => {
      expect(service.getPathLastFolder('/folder')).toStrictEqual('');
      expect(service.getPathLastFolder('folder')).toStrictEqual('');
      expect(service.getPathLastFolder('/')).toStrictEqual('');
      expect(service.getPathLastFolder('/file.png')).toStrictEqual('');
      expect(service.getPathLastFolder('/subfolder/file.png')).toStrictEqual(
        'subfolder',
      );
      expect(service.getPathLastFolder('subfolder/file.png')).toStrictEqual(
        'subfolder',
      );
      expect(
        service.getPathLastFolder('/subfolder/other/test/file.png'),
      ).toStrictEqual('test');
    });

    it('When get first folder name from path is requested, then it is returned', async () => {
      expect(service.getPathFirstFolder('/folder')).toStrictEqual('');
      expect(service.getPathFirstFolder('folder')).toStrictEqual('');
      expect(service.getPathFirstFolder('/')).toStrictEqual('');
      expect(service.getPathFirstFolder('/file.png')).toStrictEqual('');
      expect(service.getPathFirstFolder('/subfolder/file.png')).toStrictEqual(
        'subfolder',
      );
      expect(service.getPathFirstFolder('subfolder/file.png')).toStrictEqual(
        'subfolder',
      );
      expect(
        service.getPathFirstFolder('/subfolder/other/test/file.png'),
      ).toStrictEqual('subfolder');
    });

    it('When get file data from path is requested, then it is returned', async () => {
      expect(service.getPathFileData('/file.png')).toStrictEqual({
        fileName: 'file',
        fileType: 'png',
      });
      expect(service.getPathFileData('test/file.png')).toStrictEqual({
        fileName: 'file',
        fileType: 'png',
      });
      expect(service.getPathFileData('file.png')).toStrictEqual({
        fileName: 'file',
        fileType: 'png',
      });
      expect(
        service.getPathFileData('/subfolder/other/test/file.png'),
      ).toStrictEqual({ fileName: 'file', fileType: 'png' });
      expect(service.getPathFileData('/file')).toStrictEqual({
        fileName: 'file',
        fileType: '',
      });
      expect(service.getPathFileData('folder')).toStrictEqual({
        fileName: 'folder',
        fileType: '',
      });
    });

    it('When get files from path and user is requested, then they are returned', async () => {
      const firstAncestorFolder1 = newFolder({
        attributes: {
          name: 'test',
          plainName: 'test',
        },
      });
      const firstAncestorFolder2 = newFolder({
        attributes: {
          name: 'test2',
          plainName: 'test2',
        },
      });
      const possibleFolder1 = newFolder({
        attributes: {
          name: 'folder',
          plainName: 'folder',
          parent: firstAncestorFolder1,
          parentId: firstAncestorFolder1.id,
          parentUuid: firstAncestorFolder1.uuid,
        },
      });
      const possibleFolder2 = newFolder({
        attributes: {
          name: 'folder',
          plainName: 'folder',
          parent: firstAncestorFolder2,
          parentId: firstAncestorFolder2.id,
          parentUuid: firstAncestorFolder2.uuid,
        },
      });
      const possibleFile1 = newFile({
        attributes: {
          name: 'file',
          type: 'png',
          folder: possibleFolder1,
          folderId: possibleFolder1.id,
          folderUuid: possibleFolder1.uuid,
        },
      });
      const possibleFile2 = newFile({
        attributes: {
          name: 'file',
          type: 'png',
          folder: possibleFolder2,
          folderId: possibleFolder2.id,
          folderUuid: possibleFolder2.uuid,
        },
      });
      const completePath = `/${firstAncestorFolder1.name}/${possibleFolder1.name}/${possibleFile1.name}.${possibleFile1.type}`;
      const filePath = Buffer.from(completePath, 'utf-8').toString('base64');

      jest.spyOn(service, 'getPathDepth').mockReturnValue(2);
      jest
        .spyOn(service, 'getPathLastFolder')
        .mockReturnValue(possibleFolder1.name);
      jest.spyOn(service, 'getPathFileData').mockReturnValue({
        fileName: possibleFile1.name,
        fileType: possibleFile1.type,
      });
      jest
        .spyOn(folderUseCases, 'getFoldersByDepthAndName')
        .mockResolvedValue([possibleFolder1, possibleFolder2]);

      jest
        .spyOn(service, 'getFileByFolderAndName')
        .mockResolvedValueOnce(possibleFile1)
        .mockResolvedValueOnce(possibleFile2);

      const result = await service.getFilesByPathAndUser(
        filePath,
        userMocked.id,
      );
      expect(result).toEqual([possibleFile1, possibleFile2]);
    });
  });
});
