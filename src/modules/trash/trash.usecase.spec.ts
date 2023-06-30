import { Test, TestingModule } from '@nestjs/testing';
import { TrashUseCases } from './trash.usecase';
import { SequelizeFileRepository } from '../file/file.repository';
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
import {
  SequelizeShareRepository,
  ShareModel,
} from '../share/share.repository';
import { BridgeModule } from '../../externals/bridge/bridge.module';
import { CryptoModule } from '../..//externals/crypto/crypto.module';
import { NotFoundException } from '@nestjs/common';
import { FileModel } from '../file/file.model';

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

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('clear trash', () => {
    it.skip('should delete orphaned folders', async () => {
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
        .mockImplementationOnce(() => Promise.resolve(3));

      await service.clearTrash(userMock);

      expect(folderUseCases.deleteOrphansFolders).toHaveBeenCalledTimes(1);
    });

    it.skip('should not try to delete orphaned folders if no folders where found in the trash', async () => {
      jest
        .spyOn(fileUseCases, 'getByFolderAndUser')
        .mockImplementationOnce(() => Promise.resolve([]));
      jest.spyOn(folderUseCases, 'getFoldersToUser').mockResolvedValueOnce([]);
      jest
        .spyOn(folderUseCases, 'deleteFolderPermanently')
        .mockImplementationOnce(() => Promise.resolve());
      jest
        .spyOn(folderUseCases, 'deleteOrphansFolders')
        .mockImplementationOnce(() => Promise.resolve(0));

      await service.clearTrash(userMock);

      expect(folderUseCases.deleteOrphansFolders).toHaveBeenCalledTimes(0);
    });

    it.skip('should delete all files and folder founded', async () => {
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
        .mockImplementationOnce(() => Promise.resolve(filesToDelete.length));

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

    it.skip('should continue deleting if a item cannot be deleted', async () => {
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
        .mockImplementation(() => Promise.resolve(filesToDelete.length));

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
    it.skip('should delete all items', async () => {
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

      await service.deleteItems(
        {} as User,
        filesIdToDelete as unknown as File[], // must be updated to be a list of files
        foldersIdToDelete as unknown as Folder[], // must be updated to be a list of folders
      );

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

    it.skip('should fail if a file is not found', async () => {
      const filesIdToDelete: Array<FileAttributes['fileId']> = [
        'bbe6d386-e215-53a0-88ef-1e4c318e6ff9',
      ];

      jest
        .spyOn(fileUseCases, 'getByFileIdAndUser')
        .mockResolvedValueOnce(null);
      jest.spyOn(fileUseCases, 'deleteFilePermanently');
      jest.spyOn(folderUseCases, 'deleteFolderPermanently');

      try {
        await service.deleteItems(
          {} as User,
          filesIdToDelete as unknown as File[], // must be updated to be a list of files
          filesIdToDelete as unknown as Folder[], // must be updated to be a list of folders );
        );
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
        await service.deleteItems(
          {} as User,
          [],
          foldersIdToDelete as unknown as Folder[], // must be updated to be a list of folders
        );
      } catch (err) {
        expect(err).toBeDefined();
      }

      expect(fileUseCases.deleteFilePermanently).not.toHaveBeenCalled();
      expect(folderUseCases.deleteFolderPermanently).not.toHaveBeenCalled();
    });

    it.skip('should try to delete all items even if a deletion fails', async () => {
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

      await service.deleteItems(
        {} as User,
        filesIdToDelete as unknown as File[], // must be updated to be a list of files
        foldersIdToDelete as unknown as Folder[], // must be updated to be a list of folders
      );

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
