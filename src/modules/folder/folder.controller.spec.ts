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
import { InvalidParentFolderException } from './exception/invalid-parent-folder';

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
    })
      .useMocker(createMock)
      .compile();

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
    const clientId = 'drive-web';

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
      );
      expect(result).toEqual(expectedFolder);
    });

    it('When move folder is requested with invalid params, then it should throw an error', () => {
      expect(
        folderController.moveFolder(
          userMocked,
          'invaliduuid',
          {
            destinationFolder: v4(),
          },
          clientId,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(
        folderController.moveFolder(
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

      expect(result).toEqual({ existentFolders: mockFolders });
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
      ).rejects.toThrow(InvalidParentFolderException);
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
});
