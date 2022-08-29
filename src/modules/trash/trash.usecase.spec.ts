import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
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
import { Folder, FolderAttributes } from '../folder/folder.domain';
import { FileUseCases } from '../file/file.usecase';
import { FolderUseCases } from '../folder/folder.usecase';
import { ShareUseCases } from '../share/share.usecase';
import { BridgeModule } from '../../externals/bridge/bridge.module';
import { FileModule } from '../file/file.module';
import { FolderModule } from '../folder/folder.module';
import { UserModule } from '../user/user.module';
import {
  SequelizeShareRepository,
  ShareModel,
} from '../share/share.repository';
import { BridgeModule } from '../../externals/bridge/bridge.module';

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
      imports: [FileModule, FolderModule, UserModule, BridgeModule],
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

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('clear trash', () => {
    it('should delete orphaned folders', async () => {
      jest
        .spyOn(fileUseCases, 'getByFolderAndUser')
        .mockImplementationOnce(() => Promise.resolve([]));
      jest
        .spyOn(folderUseCases, 'getChildrenFoldersToUser')
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
      jest
        .spyOn(folderUseCases, 'getChildrenFoldersToUser')
        .mockResolvedValueOnce([]);
      jest
        .spyOn(folderUseCases, 'deleteFolderPermanently')
        .mockImplementationOnce(() => Promise.resolve());
      jest
        .spyOn(folderUseCases, 'deleteOrphansFolders')
        .mockImplementationOnce(() => Promise.resolve());

      await service.clearTrash(userMock);

      expect(folderUseCases.deleteOrphansFolders).toHaveBeenCalledTimes(0);
    });

    it('should delete all files and folder found', async () => {
      const folder = Folder.build({
        id: 2725517497,
        parentId: 3388762609,
        name: 'name',
        bucket: 'bucket',
        userId: 1,
        encryptVersion: '2',
        deleted: true,
        deletedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        user: null,
        parent: null,
      });

      await service.clearTrash(userMock);

      expect(folderUseCases.deleteOrphansFolders).toHaveBeenCalledTimes(0);
    });

    it('should delete all files and folder founded', async () => {
      const filesToDelete: Array<File> = Array(32).fill({} as File);
      const foldersToDelete: Array<Folder> = Array(26).fill({} as Folder);

      jest
        .spyOn(fileUseCases, 'getByFolderAndUser')
        .mockResolvedValueOnce(filesToDelete);
      jest
        .spyOn(fileUseCases, 'deleteFilePermanently')
        .mockImplementation(() => Promise.resolve());
      jest
        .spyOn(folderUseCases, 'getChildrenFoldersToUser')
        .mockResolvedValueOnce(foldersToDelete);
      jest
        .spyOn(folderUseCases, 'deleteFolderPermanently')
        .mockImplementation(() => Promise.resolve());
      jest
        .spyOn(folderUseCases, 'deleteOrphansFolders')
        .mockImplementationOnce(() => Promise.resolve());

      await service.clearTrash(userMock);

      expect(fileUseCases.getByFolderAndUser).toHaveBeenCalledTimes(1);
      expect(fileUseCases.deleteFilePermanently).toHaveBeenCalledTimes(
        filesToDelete.length,
      );
      expect(folderUseCases.getChildrenFoldersToUser).toHaveBeenCalledTimes(1);
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
        .spyOn(fileUseCases, 'getByFolderAndUser')
        .mockResolvedValueOnce(filesToDelete);
      jest
        .spyOn(fileUseCases, 'deleteFilePermanently')
        .mockImplementationOnce(() => Promise.reject(errorToBeThrown))
        .mockImplementation(() => Promise.resolve());
      jest
        .spyOn(folderUseCases, 'getChildrenFoldersToUser')
        .mockResolvedValueOnce(foldersToDelete);
      jest
        .spyOn(folderUseCases, 'deleteFolderPermanently')
        .mockImplementation(() => Promise.resolve())
        .mockImplementationOnce(() => Promise.reject(errorToBeThrown));
      jest
        .spyOn(folderUseCases, 'deleteOrphansFolders')
        .mockImplementation(() => Promise.resolve());

      await service.clearTrash(userMock);

      expect(fileUseCases.getByFolderAndUser).toHaveBeenCalledTimes(1);
      expect(fileUseCases.deleteFilePermanently).toHaveBeenCalledTimes(
        filesToDelete.length,
      );
      expect(folderUseCases.getChildrenFoldersToUser).toHaveBeenCalledTimes(1);
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
});
