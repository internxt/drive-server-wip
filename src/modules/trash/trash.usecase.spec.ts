import { Test, TestingModule } from '@nestjs/testing';
import { TrashUseCases } from './trash.usecase';
import { FileModel, SequelizeFileRepository } from '../file/file.repository';
import { File } from '../file/file.domain';
import {
  FolderModel,
  SequelizeFolderRepository,
} from '../folder/folder.repository';
import { getModelToken } from '@nestjs/sequelize';
import { User } from '../user/user.domain';
import { SequelizeUserRepository, UserModel } from '../user/user.repository';
import { Folder } from '../folder/folder.domain';
import { FileUseCases } from '../file/file.usecase';
import { FolderUseCases } from '../folder/folder.usecase';
import { ShareUseCases } from '../share/share.usecase';
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
      imports: [BridgeModule],
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
});
