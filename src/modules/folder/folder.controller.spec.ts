import { createMock } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { v4 } from 'uuid';
import {
  newFile,
  newFolder,
  newUser,
  newWorkspace,
} from '../../../test/fixtures';
import { FileUseCases } from '../file/file.usecase';
import { FolderController } from './folder.controller';
import { Folder, FolderStatus } from './folder.domain';
import { FolderUseCases } from './folder.usecase';
import { CalculateFolderSizeTimeoutException } from './exception/calculate-folder-size-timeout.exception';
import { User } from '../user/user.domain';
import { FileStatus } from '../file/file.domain';
import { StorageNotificationService } from './../../externals/notifications/storage.notifications.service';
import { ClientEnum } from '../../common/enums/platform.enum';
import { SortOrder } from '../../common/order.type';

const requester = newUser();

describe('FolderController', () => {
  let folderController: FolderController;
  let folderUseCases: FolderUseCases;
  let fileUseCases: FileUseCases;
  let folder: Folder;
  let storageNotificationService: StorageNotificationService;

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
    })
      .useMocker(createMock)
      .compile();

    folderController = module.get<FolderController>(FolderController);
    folderUseCases = module.get<FolderUseCases>(FolderUseCases);
    fileUseCases = module.get<FileUseCases>(FileUseCases);
    storageNotificationService = module.get<StorageNotificationService>(
      StorageNotificationService,
    );
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

  describe('getFolderTree', () => {
    it('When folder tree is requested, then it should return the tree', async () => {
      const user = newUser();
      const folder = newFolder();
      const mockFolderTree = {
        ...folder,
        children: [
          {
            ...newFolder({
              attributes: { parentUuid: folder.uuid, parentId: folder.id },
            }),
          },
        ],
        files: [],
      };

      jest
        .spyOn(folderUseCases, 'getFolderTree')
        .mockResolvedValue(mockFolderTree);

      const result = await folderController.getFolderTree(user, folder.uuid);
      expect(result).toEqual({ tree: mockFolderTree });
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
        { limit: 50, offset: 0, sort: 'id', order: SortOrder.ASC },
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
        { limit: 50, offset: 0, sort: 'id', order: SortOrder.ASC },
      );

      expect(result).toEqual({ folders: mappedSubfolders });
    });
  });

  describe('move folder', () => {
    const clientId = ClientEnum.Web;

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
        clientId,
        requester,
      );
      expect(result).toEqual({
        ...expectedFolder,
        status: expectedFolder.getFolderStatus(),
      });
    });
  });

  describe('getFolderContent', () => {
    it('When folde content is requested and the current folder is not found, then it should throw', async () => {
      jest.spyOn(folderUseCases, 'getFolderByUuid').mockResolvedValue(null);

      expect(
        folderController.getFolderContent(userMocked, v4(), {
          limit: 10,
          offset: 20,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('When folder content is requested, then children folders and files should be returned', async () => {
      const currentFolder = newFolder();

      const expectedSubfiles = [
        newFile({ attributes: { folderUuid: currentFolder.uuid } }),
        newFile({ attributes: { folderUuid: currentFolder.uuid } }),
        newFile({ attributes: { folderUuid: currentFolder.uuid } }),
      ];

      const expectedSubfolders = [
        newFolder({ attributes: { parentUuid: currentFolder.uuid } }),
        newFolder({ attributes: { parentUuid: currentFolder.uuid } }),
        newFolder({ attributes: { parentUuid: currentFolder.uuid } }),
      ];

      const mappedSubfolders = expectedSubfolders.map((f) => ({
        ...f,
        status: f.getFolderStatus(),
      }));

      jest
        .spyOn(folderUseCases, 'getFolderByUuid')
        .mockResolvedValue(currentFolder);

      jest
        .spyOn(folderUseCases, 'getFolders')
        .mockResolvedValue(expectedSubfolders);

      jest.spyOn(fileUseCases, 'getFiles').mockResolvedValue(expectedSubfiles);

      const result = await folderController.getFolderContent(userMocked, v4(), {
        limit: 10,
        offset: 20,
      });

      expect(result).toEqual({
        ...currentFolder,
        status: currentFolder.getFolderStatus(),
        children: mappedSubfolders,
        files: expectedSubfiles,
      });
    });
  });

  describe('checkFoldersExistenceInFolderOld', () => {
    const user = newUser();
    const folderUuid = v4();
    const plainNames = ['Documents', 'Photos'];

    it('When valid folderUuid and plainNames are provided, then it should return existent folders', async () => {
      const mockFolders = [
        newFolder({ attributes: { plainName: 'Documents', userId: user.id } }),
        newFolder({ attributes: { plainName: 'Photos', userId: user.id } }),
      ];

      jest
        .spyOn(folderUseCases, 'searchFoldersInFolder')
        .mockResolvedValue(mockFolders);

      const result = await folderController.checkFoldersExistenceInFolderOld(
        user,
        folderUuid,
        { plainName: plainNames },
      );

      expect(result).toEqual({ existentFolders: mockFolders });
      expect(folderUseCases.searchFoldersInFolder).toHaveBeenCalledWith(
        user,
        folderUuid,
        { plainNames },
      );
    });

    it('When folders are not found, then it should return an empty array', async () => {
      jest.spyOn(folderUseCases, 'searchFoldersInFolder').mockResolvedValue([]);

      const result = await folderController.checkFoldersExistenceInFolderOld(
        user,
        folderUuid,
        { plainName: plainNames },
      );

      expect(result).toEqual({ existentFolders: [] });
      expect(folderUseCases.searchFoldersInFolder).toHaveBeenCalledWith(
        user,
        folderUuid,
        { plainNames },
      );
    });
  });

  describe('checkFoldersExistenceInFolder', () => {
    const user = newUser();
    const folderUuid = v4();
    const plainNames = ['Documents', 'Photos'];

    it('When valid folderUuid and plainNames are provided, then it should return existent folders', async () => {
      const mockFolders = [
        newFolder({ attributes: { plainName: 'Documents', userId: user.id } }),
        newFolder({ attributes: { plainName: 'Photos', userId: user.id } }),
      ];

      jest
        .spyOn(folderUseCases, 'searchFoldersInFolder')
        .mockResolvedValue(mockFolders);

      const result = await folderController.checkFoldersExistenceInFolder(
        user,
        folderUuid,
        { plainNames: plainNames },
      );

      expect(result).toEqual({
        existentFolders: mockFolders.map((folder) => ({
          ...folder,
          status: FolderStatus.EXISTS,
        })),
      });
      expect(folderUseCases.searchFoldersInFolder).toHaveBeenCalledWith(
        user,
        folderUuid,
        { plainNames },
      );
    });

    it('When folders are not found, then it should return an empty array', async () => {
      jest.spyOn(folderUseCases, 'searchFoldersInFolder').mockResolvedValue([]);

      const result = await folderController.checkFoldersExistenceInFolder(
        user,
        folderUuid,
        { plainNames: plainNames },
      );

      expect(result).toEqual({ existentFolders: [] });
      expect(folderUseCases.searchFoldersInFolder).toHaveBeenCalledWith(
        user,
        folderUuid,
        { plainNames },
      );
    });
  });

  describe('checkFilesExistenceInFolder', () => {
    const user = newUser();
    const folderUuid = v4();
    const plainName = 'Report.pdf';
    const type = 'document';
    const query = { files: [{ plainName, type }] };

    it('When files exist matching the criteria, then it should return the files', async () => {
      const parentFolder = newFolder({ attributes: { uuid: folderUuid } });
      const mockFiles = [
        newFile({ attributes: { plainName: 'Report.pdf', type: 'document' } }),
        newFile({ attributes: { plainName: 'Image.png', type: 'image' } }),
      ];

      jest
        .spyOn(folderUseCases, 'getFolderByUuid')
        .mockResolvedValue(parentFolder);
      jest
        .spyOn(fileUseCases, 'searchFilesInFolder')
        .mockResolvedValue(mockFiles);

      const result = await folderController.checkFilesExistenceInFolder(
        user,
        folderUuid,
        query,
      );

      expect(result).toEqual({ existentFiles: mockFiles });
    });

    it('When no files match the criteria, then it should return an empty array', async () => {
      const parentFolder = newFolder({ attributes: { uuid: folderUuid } });

      jest
        .spyOn(folderUseCases, 'getFolderByUuid')
        .mockResolvedValue(parentFolder);
      jest.spyOn(fileUseCases, 'searchFilesInFolder').mockResolvedValue([]);

      const result = await folderController.checkFilesExistenceInFolder(
        user,
        folderUuid,
        query,
      );

      expect(result).toEqual({ existentFiles: [] });
    });

    it('When the parent folder does not exist, then it should throw', async () => {
      jest.spyOn(folderUseCases, 'getFolderByUuid').mockResolvedValue(null);

      await expect(
        folderController.checkFilesExistenceInFolder(user, folderUuid, query),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getgetFolderAncestors', () => {
    it('When get folder ancestors is requested with workspace as undefined, then it should return the ancestors', async () => {
      const user = newUser();
      const folder = newFolder({ owner: user });
      const workspace = undefined;
      const mockAncestors = [
        newFolder({
          attributes: { parentUuid: folder.parentUuid },
          owner: user,
        }),
        newFolder({
          attributes: { parentUuid: folder.parentUuid },
          owner: user,
        }),
      ];

      jest
        .spyOn(folderUseCases, 'getFolderAncestors')
        .mockResolvedValue(mockAncestors);

      const result = await folderController.getFolderAncestors(
        user,
        workspace,
        folder.uuid,
      );
      expect(result).toEqual(mockAncestors);
      expect(folderUseCases.getFolderAncestors).toHaveBeenCalledWith(
        user,
        folder.uuid,
      );
    });

    it('When get folder ancestors is requested with a workspace, then it should return the ancestors', async () => {
      const user = newUser();
      const folder = newFolder({ owner: user });
      const workspace = newWorkspace({ owner: user });
      const mockAncestors = [
        newFolder({
          attributes: { parentUuid: folder.parentUuid },
          owner: user,
        }),
        newFolder({
          attributes: { parentUuid: folder.parentUuid },
          owner: user,
        }),
      ];

      jest
        .spyOn(folderUseCases, 'getFolderAncestorsInWorkspace')
        .mockResolvedValue(mockAncestors);

      const result = await folderController.getFolderAncestors(
        user,
        workspace,
        folder.uuid,
      );
      expect(result).toEqual(mockAncestors);
      expect(folderUseCases.getFolderAncestorsInWorkspace).toHaveBeenCalledWith(
        user,
        folder.uuid,
      );
    });
  });

  describe('get folder by path', () => {
    it('When get folder metadata by path is requested with a valid path, then the folder is returned', async () => {
      const expectedFolder = newFolder();
      const folderPath = '/folder1/folder2';
      jest
        .spyOn(folderUseCases, 'getFolderMetadataByPath')
        .mockResolvedValue(expectedFolder);

      const result = await folderController.getFolderMetaByPath(
        userMocked,
        folderPath,
      );
      expect(result).toEqual(expectedFolder);
    });

    it('When get folder metadata by path is requested with a valid path that not exists, then it should throw a not found error', async () => {
      const folderPath = '/folder1/folder2';
      jest
        .spyOn(folderUseCases, 'getFolderMetadataByPath')
        .mockResolvedValue(null);

      expect(
        folderController.getFolderMetaByPath(userMocked, folderPath),
      ).rejects.toThrow(NotFoundException);
    });

    it('When get file metadata by path is requested with an invalid path, then it should throw an error', () => {
      expect(
        folderController.getFolderMetaByPath(userMocked, 'invalidpath'),
      ).rejects.toThrow(BadRequestException);

      expect(
        folderController.getFolderMetaByPath(userMocked, ''),
      ).rejects.toThrow(BadRequestException);
    });

    it('When get folder metadata by path is requested with a path deep > 20, then it should throw an error', () => {
      const longPath =
        '/' + Array.from({ length: 22 }, (_, i) => `folder${i}`).join('/');

      expect(
        folderController.getFolderMetaByPath(userMocked, longPath),
      ).rejects.toThrow('Path is too deep');
    });
  });

  describe('deleteFolder', () => {
    const folderUuidToDelete = 'uuid-to-delete';
    const userMocked = newUser();
    const folder = newFolder({
      attributes: { id: 1, uuid: folderUuidToDelete, userId: userMocked.id },
    });

    it('When a valid folderUuid is provided, then it should delete the folder and send a notification', async () => {
      jest
        .spyOn(folderUseCases, 'getFolderByUuidAndUser')
        .mockResolvedValue(folder);
      jest.spyOn(folderUseCases, 'deleteByUser').mockResolvedValue(undefined);
      jest
        .spyOn(storageNotificationService, 'folderDeleted')
        .mockImplementation(() => {});

      const result = await folderController.deleteFolder(
        userMocked,
        folderUuidToDelete,
        'clientId',
      );

      expect(result).toBeUndefined();
      expect(folderUseCases.getFolderByUuidAndUser).toHaveBeenCalledWith(
        folderUuidToDelete,
        userMocked,
      );
      expect(folderUseCases.deleteNotRootFolderByUser).toHaveBeenCalledWith(
        userMocked,
        [folder],
      );
      expect(storageNotificationService.folderDeleted).toHaveBeenCalledWith({
        payload: {
          id: folder.id,
          uuid: folderUuidToDelete,
          userId: userMocked.id,
        },
        user: userMocked,
        clientId: 'clientId',
      });
    });

    it('When a non-existent folderUuid is provided, then it should throw an error', async () => {
      jest
        .spyOn(folderUseCases, 'getFolderByUuidAndUser')
        .mockRejectedValue(new NotFoundException());

      await expect(
        folderController.deleteFolder(
          userMocked,
          folderUuidToDelete,
          'clientId',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('When an error occurs during deletion, then it should throw an error', async () => {
      jest
        .spyOn(folderUseCases, 'getFolderByUuidAndUser')
        .mockResolvedValue(folder);
      jest
        .spyOn(folderUseCases, 'deleteNotRootFolderByUser')
        .mockRejectedValue(new Error('Deletion failed'));

      await expect(
        folderController.deleteFolder(
          userMocked,
          folderUuidToDelete,
          'clientId',
        ),
      ).rejects.toThrow('Deletion failed');
    });
  });

  describe('createFolder', () => {
    const clientId = 'test-client';
    const requester = newUser();
    const createFolderDto = {
      plainName: 'New Folder',
      parentFolderUuid: v4(),
    };

    it('When creating a folder with valid data, then it should create and return the folder', async () => {
      const createdFolder = newFolder({
        attributes: { plainName: createFolderDto.plainName },
      });

      jest
        .spyOn(folderUseCases, 'createFolder')
        .mockResolvedValue(createdFolder);
      jest
        .spyOn(storageNotificationService, 'folderCreated')
        .mockImplementation(() => {});

      const result = await folderController.createFolder(
        userMocked,
        createFolderDto,
        clientId,
        requester,
      );

      expect(result).toEqual({
        ...createdFolder,
        status: createdFolder.getFolderStatus(),
      });
      expect(folderUseCases.createFolder).toHaveBeenCalledWith(
        userMocked,
        createFolderDto,
      );
      expect(storageNotificationService.folderCreated).toHaveBeenCalledWith({
        payload: { ...createdFolder, status: createdFolder.getFolderStatus() },
        user: requester,
        clientId,
      });
    });

    it('When folder creation fails, then it should throw an error', async () => {
      jest
        .spyOn(folderUseCases, 'createFolder')
        .mockRejectedValue(new BadRequestException('Invalid folder name'));

      await expect(
        folderController.createFolder(
          userMocked,
          createFolderDto,
          clientId,
          requester,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getFolderCount', () => {
    it('When getting folder count without status, then it should return drive folders count', async () => {
      const expectedCount = 25;
      jest
        .spyOn(folderUseCases, 'getDriveFoldersCount')
        .mockResolvedValue(expectedCount);

      const result = await folderController.getFolderCount(userMocked);

      expect(result).toEqual({ count: expectedCount });
      expect(folderUseCases.getDriveFoldersCount).toHaveBeenCalledWith(
        userMocked.id,
      );
    });

    it('When getting orphan folder count, then it should return orphan folders count', async () => {
      const expectedCount = 5;
      jest
        .spyOn(folderUseCases, 'getOrphanFoldersCount')
        .mockResolvedValue(expectedCount);

      const result = await folderController.getFolderCount(
        userMocked,
        'orphan',
      );

      expect(result).toEqual({ count: expectedCount });
      expect(folderUseCases.getOrphanFoldersCount).toHaveBeenCalledWith(
        userMocked.id,
      );
    });

    it('When getting trashed folder count, then it should return trashed folders count', async () => {
      const expectedCount = 10;
      jest
        .spyOn(folderUseCases, 'getTrashFoldersCount')
        .mockResolvedValue(expectedCount);

      const result = await folderController.getFolderCount(
        userMocked,
        'trashed',
      );

      expect(result).toEqual({ count: expectedCount });
      expect(folderUseCases.getTrashFoldersCount).toHaveBeenCalledWith(
        userMocked.id,
      );
    });

    it('When getting folder count with invalid status, then it should throw an error', async () => {
      await expect(
        folderController.getFolderCount(userMocked, 'invalid' as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteFolders', () => {
    it('When deleting orphan folders, then it should return deleted count', async () => {
      const deletedCount = 8;
      jest
        .spyOn(folderUseCases, 'deleteOrphansFolders')
        .mockResolvedValue(deletedCount);

      const result = await folderController.deleteFolders(userMocked, 'orphan');

      expect(result).toEqual({ deletedCount });
      expect(folderUseCases.deleteOrphansFolders).toHaveBeenCalledWith(
        userMocked.id,
      );
    });

    it('When trying to delete trashed folders, then it should throw NotImplementedException', async () => {
      await expect(
        folderController.deleteFolders(userMocked, 'trashed'),
      ).rejects.toThrow('Not Implemented');
    });

    it('When no status is provided, then it should throw BadRequestException', async () => {
      await expect(
        folderController.deleteFolders(userMocked, undefined as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('When invalid status is provided, then it should throw BadRequestException', async () => {
      await expect(
        folderController.deleteFolders(userMocked, 'invalid' as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getFolderFiles', () => {
    const folderId = 123;
    const limit = 20;
    const offset = 0;

    it('When getting folder files, then it should return files', async () => {
      const mockFiles = [
        newFile({ attributes: { folderId } }),
        newFile({ attributes: { folderId } }),
      ];
      jest.spyOn(fileUseCases, 'getFiles').mockResolvedValue(mockFiles);

      const result = await folderController.getFolderFiles(
        userMocked,
        folderId,
        { limit, offset, sort: 'plainName', order: SortOrder.ASC },
      );

      expect(result).toEqual({ result: mockFiles });
      expect(fileUseCases.getFiles).toHaveBeenCalledWith(
        userMocked.id,
        { folderId, status: FileStatus.EXISTS },
        { limit, offset, sort: [['plainName', 'ASC']] },
      );
    });
  });

  describe('checkFileExistence', () => {
    const folderId = 123;
    const fileName = 'test.pdf';
    const fileType = 'document';

    it('When checking file existence and file exists, then it should return the file', async () => {
      const mockFile = newFile({
        attributes: { folderId, plainName: fileName, type: fileType },
      });
      jest.spyOn(fileUseCases, 'getFiles').mockResolvedValue([mockFile]);

      const result = await folderController.checkFileExistence(
        userMocked,
        folderId,
        fileName,
        fileType,
      );

      expect(result).toEqual(mockFile);
      expect(fileUseCases.getFiles).toHaveBeenCalledWith(
        userMocked.id,
        {
          folderId,
          status: FileStatus.EXISTS,
          plainName: fileName,
          type: fileType,
        },
        { limit: 1, offset: 0 },
      );
    });

    it('When checking file existence and file does not exist, then it should throw NotFoundException', async () => {
      jest.spyOn(fileUseCases, 'getFiles').mockResolvedValue([]);

      await expect(
        folderController.checkFileExistence(
          userMocked,
          folderId,
          fileName,
          fileType,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getFolderFolders', () => {
    const folderId = 123;
    const limit = 20;
    const offset = 0;

    it('When getting folder subfolders with valid params, then it should return folders', async () => {
      const mockFolders = [
        newFolder({ attributes: { parentId: folderId } }),
        newFolder({ attributes: { parentId: folderId } }),
      ];
      jest.spyOn(folderUseCases, 'getFolders').mockResolvedValue(mockFolders);

      const result = await folderController.getFolderFolders(
        userMocked,
        folderId,
        { limit, offset, order: SortOrder.ASC, sort: 'plainName' },
      );

      expect(result).toEqual({
        result: mockFolders.map((f) => ({ ...f, status: f.getFolderStatus() })),
      });
      expect(folderUseCases.getFolders).toHaveBeenCalledWith(
        userMocked.id,
        { parentId: folderId, deleted: false, removed: false },
        { limit, offset, sort: [['plainName', 'ASC']] },
      );
    });
  });

  describe('getFolders', () => {
    const limit = 20;
    const offset = 0;

    it('When getting folders with EXISTS status, then it should return non-deleted folders', async () => {
      const mockFolders = [newFolder(), newFolder()];
      jest
        .spyOn(folderUseCases, 'getNotTrashedFoldersUpdatedAfter')
        .mockResolvedValue(mockFolders);
      jest
        .spyOn(folderUseCases, 'decryptFolderName')
        .mockImplementation((f) => f);

      const result = await folderController.getFolders(userMocked, {
        limit,
        offset,
        status: FolderStatus.EXISTS,
      });

      expect(result).toEqual(
        mockFolders.map((f) => ({ ...f, status: f.getFolderStatus() })),
      );
      expect(
        folderUseCases.getNotTrashedFoldersUpdatedAfter,
      ).toHaveBeenCalledWith(userMocked.id, new Date(1), {
        limit,
        offset,
        sort: undefined,
      });
    });

    it('When getting folders with TRASHED status, then it should return deleted folders', async () => {
      const mockFolders = [newFolder({ attributes: { deleted: true } })];
      jest
        .spyOn(folderUseCases, 'getTrashedFoldersUpdatedAfter')
        .mockResolvedValue(mockFolders);
      jest
        .spyOn(folderUseCases, 'decryptFolderName')
        .mockImplementation((f) => f);

      const result = await folderController.getFolders(userMocked, {
        limit,
        offset,
        status: FolderStatus.TRASHED,
      });

      expect(result).toEqual(
        mockFolders.map((f) => ({ ...f, status: f.getFolderStatus() })),
      );
      expect(folderUseCases.getTrashedFoldersUpdatedAfter).toHaveBeenCalledWith(
        userMocked.id,
        new Date(1),
        { limit, offset, sort: undefined },
      );
    });

    it('When getting folders with updatedAt filter, then it should apply the date filter', async () => {
      const updatedAt = '2023-01-01T00:00:00Z';
      const mockFolders = [newFolder()];
      jest
        .spyOn(folderUseCases, 'getNotTrashedFoldersUpdatedAfter')
        .mockResolvedValue(mockFolders);
      jest
        .spyOn(folderUseCases, 'decryptFolderName')
        .mockImplementation((f) => f);

      const result = await folderController.getFolders(userMocked, {
        limit,
        offset,
        status: FolderStatus.EXISTS,
        updatedAt,
      });

      expect(result).toEqual(
        mockFolders.map((f) => ({ ...f, status: f.getFolderStatus() })),
      );
      expect(
        folderUseCases.getNotTrashedFoldersUpdatedAfter,
      ).toHaveBeenCalledWith(userMocked.id, new Date(updatedAt), {
        limit,
        offset,
        sort: undefined,
      });
    });
  });

  describe('getFolder', () => {
    const folderUuid = v4();

    it('When getting folder by uuid, then it should return the folder', async () => {
      const mockFolder = newFolder({ attributes: { uuid: folderUuid } });
      jest
        .spyOn(folderUseCases, 'getFolderByUuidAndUser')
        .mockResolvedValue(mockFolder);

      const result = await folderController.getFolder(userMocked, folderUuid);

      expect(result).toEqual({
        ...mockFolder,
        status: mockFolder.getFolderStatus(),
      });
      expect(folderUseCases.getFolderByUuidAndUser).toHaveBeenCalledWith(
        folderUuid,
        userMocked,
      );
    });

    it('When folder is not found, then it should throw NotFoundException', async () => {
      jest
        .spyOn(folderUseCases, 'getFolderByUuidAndUser')
        .mockResolvedValue(null);

      await expect(
        folderController.getFolder(userMocked, folderUuid),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getFolderById', () => {
    const folderId = 123;

    it('When getting folder by id, then it should return the folder', async () => {
      const mockFolder = newFolder({ attributes: { id: folderId } });
      jest
        .spyOn(folderUseCases, 'getFolderByUserId')
        .mockResolvedValue(mockFolder);

      const result = await folderController.getFolderById(userMocked, folderId);

      expect(result).toEqual({
        ...mockFolder,
        status: mockFolder.getFolderStatus(),
      });
      expect(folderUseCases.getFolderByUserId).toHaveBeenCalledWith(
        folderId,
        userMocked.id,
      );
    });

    it('When folder is not found, then it should throw NotFoundException', async () => {
      jest.spyOn(folderUseCases, 'getFolderByUserId').mockResolvedValue(null);

      await expect(
        folderController.getFolderById(userMocked, folderId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateFolderMetadata', () => {
    const folderUuid = v4();
    const clientId = 'test-client';
    const requester = newUser();
    const updateDto = { plainName: 'Updated Name' };

    it('When updating folder metadata with valid data, then it should return updated folder', async () => {
      const updatedFolder = newFolder({
        attributes: { uuid: folderUuid, plainName: updateDto.plainName },
      });
      jest
        .spyOn(folderUseCases, 'updateFolderMetaData')
        .mockResolvedValue(updatedFolder);
      jest
        .spyOn(storageNotificationService, 'folderUpdated')
        .mockImplementation(() => {});

      const result = await folderController.updateFolderMetadata(
        folderUuid,
        userMocked,
        updateDto,
        clientId,
        requester,
      );

      expect(result).toEqual({
        ...updatedFolder,
        status: updatedFolder.getFolderStatus(),
      });
      expect(folderUseCases.updateFolderMetaData).toHaveBeenCalledWith(
        userMocked,
        folderUuid,
        updateDto,
      );
      expect(storageNotificationService.folderUpdated).toHaveBeenCalledWith({
        payload: result,
        user: requester,
        clientId,
      });
    });

    it('When updating folder metadata with invalid data, then it should throw an error', async () => {
      jest
        .spyOn(folderUseCases, 'updateFolderMetaData')
        .mockRejectedValue(new BadRequestException('Invalid folder name'));

      await expect(
        folderController.updateFolderMetadata(
          folderUuid,
          userMocked,
          updateDto,
          clientId,
          requester,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('get folder stats', () => {
    it('When folder belongs to user, then return folder statistics', async () => {
      const folderUuid = v4();
      const mockStats = {
        fileCount: 500,
        isFileCountExact: true,
        totalSize: 5000000,
        isTotalSizeExact: true,
      };

      jest
        .spyOn(folderUseCases, 'getFolderStats')
        .mockResolvedValueOnce(mockStats);

      const result = await folderController.getFolderStats(
        userMocked,
        folderUuid,
      );

      expect(folderUseCases.getFolderStats).toHaveBeenCalledWith(
        userMocked,
        folderUuid,
      );
      expect(result).toEqual(mockStats);
    });

    it('When folder does not exist, then it should throw a not found error', async () => {
      const folderUuid = v4();

      jest
        .spyOn(folderUseCases, 'getFolderStats')
        .mockRejectedValueOnce(new NotFoundException());

      await expect(
        folderController.getFolderStats(userMocked, folderUuid),
      ).rejects.toThrow(NotFoundException);
    });

    it('When folder does not belong to user, then it should throw a not found error', async () => {
      const folderUuid = v4();

      jest
        .spyOn(folderUseCases, 'getFolderStats')
        .mockRejectedValueOnce(new NotFoundException());

      await expect(
        folderController.getFolderStats(userMocked, folderUuid),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
