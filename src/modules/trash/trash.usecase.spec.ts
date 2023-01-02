import { Test, TestingModule } from '@nestjs/testing';
import { TrashUseCases } from './trash.usecase';
import { FileModel, SequelizeFileRepository } from '../file/file.repository';
import { File, FileAttributes } from '../file/file.domain';
import {
  FolderModel,
  SequelizeFolderRepository,
} from '../folder/folder.repository';
import { getModelToken } from '@nestjs/sequelize';
import { User } from '../user/user.domain';
import { SequelizeUserRepository, UserModel } from '../user/user.repository';
import {
  Folder,
  FolderAttributes,
  FolderOptions,
} from '../folder/folder.domain';
import { FileUseCases } from '../file/file.usecase';
import { FolderUseCases } from '../folder/folder.usecase';
import { ShareUseCases } from '../share/share.usecase';
import {
  SequelizeShareRepository,
  ShareModel,
} from '../share/share.repository';
import { BridgeModule } from '../../externals/bridge/bridge.module';
import { CryptoModule } from '../..//externals/crypto/crypto.module';
import { NotFoundException } from '@nestjs/common';

describe('Trash Use Cases', () => {
  let service: TrashUseCases,
    fileUseCases: FileUseCases,
    folderUseCases: FolderUseCases;
  const userMock = User.build({
    id: 2,
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
    tempKey: '',
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [BridgeModule, CryptoModule],
      providers: [
        TrashUseCases,
        FileUseCases,
        SequelizeFileRepository,
        {
          provide: getModelToken(FileModel),
          useValue: jest.fn(),
        },
        FolderUseCases,
        SequelizeFolderRepository,
        {
          provide: getModelToken(FolderModel),
          useValue: jest.fn(),
        },
        ShareUseCases,
        SequelizeShareRepository,
        {
          provide: getModelToken(ShareModel),
          useValue: jest.fn(),
        },
        SequelizeUserRepository,
        {
          provide: getModelToken(UserModel),
          useValue: jest.fn(),
        },
      ],
    }).compile();

    service = module.get<TrashUseCases>(TrashUseCases);
    fileUseCases = module.get<FileUseCases>(FileUseCases);
    folderUseCases = module.get<FolderUseCases>(FolderUseCases);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('clear trash', () => {
    it('should delete orphaned folders', async () => {
      jest
        .spyOn(fileUseCases, 'getByFolderAndUser')
        .mockImplementationOnce(() => Promise.resolve([]));
      jest
        .spyOn(folderUseCases, 'getFoldersToUser')
        .mockResolvedValueOnce([{} as Folder]);
      jest
        .spyOn(folderUseCases, 'deleteFolderPermanently')
        .mockImplementationOnce(() => Promise.resolve());
      jest
        .spyOn(folderUseCases, 'deleteOrphansFolders')
        .mockImplementationOnce(() => Promise.resolve());

      await service.clearTrash(userMock);

      expect(folderUseCases.deleteOrphansFolders).toHaveBeenCalledTimes(1);
    });

    it('should not try to delete orphaned folders if no folders where found in the trash', async () => {
      jest
        .spyOn(fileUseCases, 'getByFolderAndUser')
        .mockImplementationOnce(() => Promise.resolve([]));
      jest.spyOn(folderUseCases, 'getFoldersToUser').mockResolvedValueOnce([]);
      jest
        .spyOn(folderUseCases, 'deleteFolderPermanently')
        .mockImplementationOnce(() => Promise.resolve());
      jest
        .spyOn(folderUseCases, 'deleteOrphansFolders')
        .mockImplementationOnce(() => Promise.resolve());

      await service.clearTrash(userMock);

      expect(folderUseCases.deleteOrphansFolders).toHaveBeenCalledTimes(0);
    });

    it('should delete all files and folder founded', async () => {
      const filesToDelete: Array<File> = Array(32).fill({} as File);
      const foldersToDelete: Array<Folder> = Array(26).fill({} as Folder);

      jest
        .spyOn(fileUseCases, 'getByUserExceptParents')
        .mockResolvedValueOnce(filesToDelete);
      jest
        .spyOn(fileUseCases, 'deleteFilePermanently')
        .mockImplementation(() => Promise.resolve());
      jest
        .spyOn(folderUseCases, 'getFoldersToUser')
        .mockResolvedValueOnce(foldersToDelete);
      jest
        .spyOn(folderUseCases, 'deleteFolderPermanently')
        .mockImplementation(() => Promise.resolve());
      jest
        .spyOn(folderUseCases, 'deleteOrphansFolders')
        .mockImplementationOnce(() => Promise.resolve());

      await service.clearTrash(userMock);

      expect(fileUseCases.getByUserExceptParents).toHaveBeenCalledTimes(1);
      expect(fileUseCases.deleteFilePermanently).toHaveBeenCalledTimes(
        filesToDelete.length,
      );
      expect(folderUseCases.getFoldersToUser).toHaveBeenCalledTimes(1);
      expect(folderUseCases.deleteFolderPermanently).toHaveBeenCalledTimes(
        foldersToDelete.length,
      );
      expect(folderUseCases.deleteOrphansFolders).toHaveBeenCalledTimes(1);
    });

    it('should continue deleting if a item cannot be deleted', async () => {
      const errorToBeThrown = new Error('an error');
      const foldersToDelete: Array<Folder> = Array(3).fill({} as Folder);
      const filesToDelete: Array<File> = Array(6).fill({} as File);

      jest
        .spyOn(fileUseCases, 'getByUserExceptParents')
        .mockResolvedValueOnce(filesToDelete);
      jest
        .spyOn(fileUseCases, 'deleteFilePermanently')
        .mockImplementationOnce(() => Promise.reject(errorToBeThrown))
        .mockImplementation(() => Promise.resolve());
      jest
        .spyOn(folderUseCases, 'getFoldersToUser')
        .mockResolvedValueOnce(foldersToDelete);
      jest
        .spyOn(folderUseCases, 'deleteFolderPermanently')
        .mockImplementation(() => Promise.resolve())
        .mockImplementationOnce(() => Promise.reject(errorToBeThrown));
      jest
        .spyOn(folderUseCases, 'deleteOrphansFolders')
        .mockImplementation(() => Promise.resolve());

      await service.clearTrash(userMock);

      expect(fileUseCases.getByUserExceptParents).toHaveBeenCalledTimes(1);
      expect(fileUseCases.deleteFilePermanently).toHaveBeenCalledTimes(
        filesToDelete.length,
      );
      expect(folderUseCases.getFoldersToUser).toHaveBeenCalledTimes(1);
      expect(folderUseCases.deleteFolderPermanently).toHaveBeenCalledTimes(
        foldersToDelete.length,
      );
      expect(folderUseCases.deleteOrphansFolders).toHaveBeenCalledTimes(1);
    });
  });

  describe('delete items', () => {
    it('should delete all items', async () => {
      const filesIdToDelete: Array<FileAttributes['fileId']> = [
        'bbe6d386-e215-53a0-88ef-1e4c318e6ff9',
        'ca6b473d-221f-5832-a95e-8dd11f2af268',
        'fda03f0d-3006-5a86-b54b-8216da471fb0',
      ];

      const foldersIdToDelete: Array<FolderAttributes['id']> = [
        2176796544, 505779655, 724413021,
      ];

      jest
        .spyOn(fileUseCases, 'getByFileIdAndUser')
        .mockResolvedValue({} as File);
      jest.spyOn(folderUseCases, 'getFolder').mockResolvedValue({} as Folder);
      jest
        .spyOn(fileUseCases, 'deleteFilePermanently')
        .mockImplementation(() => Promise.resolve());
      jest
        .spyOn(folderUseCases, 'deleteFolderPermanently')
        .mockImplementation(() => Promise.resolve());

      await service.deleteItems(filesIdToDelete, foldersIdToDelete, {} as User);

      expect(fileUseCases.getByFileIdAndUser).toHaveBeenCalledTimes(
        filesIdToDelete.length,
      );
      expect(fileUseCases.deleteFilePermanently).toHaveBeenCalledTimes(
        filesIdToDelete.length,
      );
      expect(folderUseCases.getFolder).toHaveBeenCalledTimes(
        foldersIdToDelete.length,
      );
      expect(folderUseCases.deleteFolderPermanently).toHaveBeenCalledTimes(
        foldersIdToDelete.length,
      );
    });

    it('should fail if a file is not found', async () => {
      const filesIdToDelete: Array<FileAttributes['fileId']> = [
        'bbe6d386-e215-53a0-88ef-1e4c318e6ff9',
      ];

      jest
        .spyOn(fileUseCases, 'getByFileIdAndUser')
        .mockResolvedValueOnce(null);
      jest.spyOn(fileUseCases, 'deleteFilePermanently');
      jest.spyOn(folderUseCases, 'deleteFolderPermanently');

      try {
        await service.deleteItems(filesIdToDelete, [], {} as User);
      } catch (err) {
        expect(err).toBeInstanceOf(NotFoundException);
        expect(err.message).toBe(
          `file with id bbe6d386-e215-53a0-88ef-1e4c318e6ff9 not found`,
        );
      }

      expect(fileUseCases.deleteFilePermanently).not.toHaveBeenCalled();
      expect(folderUseCases.deleteFolderPermanently).not.toHaveBeenCalled();
    });

    it('shoul fail if a folder is not found', async () => {
      const error = Error('random error');
      const foldersIdToDelete: Array<FolderAttributes['id']> = [
        2176796544, 505779655, 724413021,
      ];

      jest.spyOn(fileUseCases, 'getByFileIdAndUser');
      jest
        .spyOn(folderUseCases, 'getFolder')
        .mockImplementationOnce(() => Promise.resolve({} as Folder))
        .mockImplementationOnce(() => Promise.reject(error))
        .mockImplementationOnce(() => Promise.resolve({} as Folder));
      jest.spyOn(fileUseCases, 'deleteFilePermanently');
      jest.spyOn(folderUseCases, 'deleteFolderPermanently');

      try {
        await service.deleteItems([], foldersIdToDelete, {} as User);
      } catch (err) {
        expect(err).toBeDefined();
      }

      expect(fileUseCases.deleteFilePermanently).not.toHaveBeenCalled();
      expect(folderUseCases.deleteFolderPermanently).not.toHaveBeenCalled();
    });

    it('should try to delete all items even if a deletion fails', async () => {
      const error = new Error('unkown test error');
      const filesIdToDelete: Array<FileAttributes['fileId']> = [
        'bbe6d386-e215-53a0-88ef-1e4c318e6ff9',
        'ca6b473d-221f-5832-a95e-8dd11f2af268',
        'fda03f0d-3006-5a86-b54b-8216da471fb0',
        '38473164-6261-51af-8eb3-223c334986ce',
        '5e98661c-9b06-5b3f-ac3d-64e16caa1001',
      ];

      const foldersIdToDelete: Array<FolderAttributes['id']> = [
        2176796544, 505779655, 724413021, 2751197087, 3468856620,
      ];

      jest
        .spyOn(fileUseCases, 'getByFileIdAndUser')
        .mockResolvedValue({} as File);
      jest.spyOn(folderUseCases, 'getFolder').mockResolvedValue({} as Folder);
      jest
        .spyOn(fileUseCases, 'deleteFilePermanently')
        .mockImplementationOnce(() => Promise.resolve())
        .mockImplementationOnce(() => Promise.reject(error))
        .mockImplementationOnce(() => Promise.reject(error))
        .mockImplementationOnce(() => Promise.resolve())
        .mockImplementationOnce(() => Promise.reject(error));
      jest
        .spyOn(folderUseCases, 'deleteFolderPermanently')
        .mockImplementationOnce(() => Promise.reject(error))
        .mockImplementationOnce(() => Promise.resolve())
        .mockImplementationOnce(() => Promise.reject(error))
        .mockImplementationOnce(() => Promise.resolve())
        .mockImplementationOnce(() => Promise.reject(error));

      await service.deleteItems(filesIdToDelete, foldersIdToDelete, {} as User);

      expect(fileUseCases.getByFileIdAndUser).toHaveBeenCalledTimes(
        filesIdToDelete.length,
      );
      expect(fileUseCases.deleteFilePermanently).toHaveBeenCalledTimes(
        filesIdToDelete.length,
      );
      expect(folderUseCases.getFolder).toHaveBeenCalledTimes(
        foldersIdToDelete.length,
      );
      expect(folderUseCases.deleteFolderPermanently).toHaveBeenCalledTimes(
        foldersIdToDelete.length,
      );
    });
  });
  describe('Update Trashed Items Parent Folder', () => {
    const file1 = File.build({
      id: 1303581,
      fileId: '',
      name: '',
      type: '',
      size: null,
      bucket: '',
      folderId: 350627,
      encryptVersion: '',
      deleted: false,
      deletedAt: new Date(),
      userId: 1,
      modificationTime: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const file2 = File.build({
      id: 11159,
      fileId: '',
      name: '',
      type: '',
      size: null,
      bucket: '',
      folderId: 82815,
      encryptVersion: '',
      deleted: true,
      deletedAt: new Date(),
      userId: 1,
      modificationTime: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const file3 = File.build({
      id: 14270,
      fileId: '',
      name: '',
      type: '',
      size: null,
      bucket: '',
      folderId: 578977,
      encryptVersion: '',
      deleted: false,
      deletedAt: new Date(),
      userId: 1,
      modificationTime: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const folderA = Folder.build({
      id: 90,
      parentId: 543966,
      name: 'name',
      bucket: 'bucket',
      userId: 1,
      encryptVersion: '03-aes',
      deleted: true,
      deletedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const folderB = Folder.build({
      id: 63491,
      parentId: 18075,
      name: 'name',
      bucket: 'bucket',
      userId: 1,
      encryptVersion: '03-aes',
      deleted: false,
      deletedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    let getFileByFildeId: jest.SpyInstance<Promise<File>, [fileId: string]>;
    let getFolder: jest.SpyInstance<Promise<Folder>, [number, FolderOptions?]>;
    let updateFolderUpdatedAt: jest.SpyInstance<
      Promise<void>,
      [folderId: number]
    >;

    beforeEach(() => {
      getFileByFildeId = jest.spyOn(fileUseCases, 'getFileByFildeId');
      getFolder = jest.spyOn(folderUseCases, 'getFolder');
      updateFolderUpdatedAt = jest.spyOn(
        folderUseCases,
        'updateFolderUpdatedAt',
      );
    });

    afterEach(() => {
      jest.resetAllMocks();
    });

    it('updates all the folders from the files', async () => {
      const filesIds = [file1, file2, file3].map((file) => file.fileId);

      getFileByFildeId
        .mockImplementationOnce(() => Promise.resolve(file1))
        .mockImplementationOnce(() => Promise.resolve(file2))
        .mockImplementationOnce(() => Promise.resolve(file3));

      await service.updateTrashedItemsParentFolder(filesIds, []);

      expect(getFolder).not.toBeCalled();
      expect(updateFolderUpdatedAt).toHaveBeenCalledTimes(3);
      expect(updateFolderUpdatedAt).toHaveBeenCalledWith(file1.folderId);
      expect(updateFolderUpdatedAt).toHaveBeenCalledWith(file2.folderId);
      expect(updateFolderUpdatedAt).toHaveBeenCalledWith(file3.folderId);
    });

    it('updates all the folders parents from folders', async () => {
      const folderIds = [folderA, folderB].map((folder) => folder.id);

      getFolder
        .mockImplementationOnce(() => Promise.resolve(folderA))
        .mockImplementationOnce(() => Promise.resolve(folderB));

      await service.updateTrashedItemsParentFolder([], folderIds);

      expect(getFileByFildeId).not.toBeCalled();
      expect(updateFolderUpdatedAt).toHaveBeenCalledTimes(2);
      expect(updateFolderUpdatedAt).toHaveBeenCalledWith(folderA.parentId);
      expect(updateFolderUpdatedAt).toHaveBeenCalledWith(folderB.parentId);
    });

    it('updates all the folder for files and folders', async () => {
      const filesIds = [file1, file2, file3].map((file) => file.fileId);
      const foldersIdS = [folderA, folderB].map((folder) => folder.id);

      getFileByFildeId
        .mockImplementationOnce(() => Promise.resolve(file1))
        .mockImplementationOnce(() => Promise.resolve(file2))
        .mockImplementationOnce(() => Promise.resolve(file3));

      getFolder
        .mockImplementationOnce(() => Promise.resolve(folderA))
        .mockImplementationOnce(() => Promise.resolve(folderB));

      await service.updateTrashedItemsParentFolder(filesIds, foldersIdS);

      expect(updateFolderUpdatedAt).toHaveBeenCalledWith(folderA.parentId);
      expect(updateFolderUpdatedAt).toHaveBeenCalledWith(folderB.parentId);
      expect(updateFolderUpdatedAt).toHaveBeenCalledWith(file1.folderId);
      expect(updateFolderUpdatedAt).toHaveBeenCalledWith(file2.folderId);
      expect(updateFolderUpdatedAt).toHaveBeenCalledWith(file3.folderId);
    });

    it('does not fails when a file is not found', async () => {
      getFileByFildeId.mockImplementationOnce(() => Promise.reject());

      try {
        await service.updateTrashedItemsParentFolder([file1.fileId], []);
      } catch (error) {
        expect(error).not.toBeDefined();
      }

      expect(updateFolderUpdatedAt).not.toBeCalled();
    });

    it('does not fails when a folder is not found', async () => {
      getFolder.mockImplementationOnce(() => Promise.reject());

      try {
        await service.updateTrashedItemsParentFolder([], [folderA.id]);
      } catch (error) {
        expect(error).not.toBeDefined();
      }

      expect(updateFolderUpdatedAt).not.toBeCalled();
    });

    it('does not fail if a folder could not be updated', async () => {
      const filesId = [file3, file2].map((file) => file.fileId);
      const foldersId = [folderA, folderB].map((folder) => folder.id);

      getFileByFildeId
        .mockImplementationOnce(() => Promise.resolve(file2))
        .mockImplementationOnce(() => Promise.resolve(file3));

      getFolder
        .mockImplementationOnce(() => Promise.resolve(folderA))
        .mockImplementationOnce(() => Promise.resolve(folderB));

      updateFolderUpdatedAt.mockImplementation(() => Promise.reject());

      try {
        await service.updateTrashedItemsParentFolder(filesId, foldersId);
      } catch (error) {
        expect(error).not.toBeDefined();
      }
    });
  });
});
