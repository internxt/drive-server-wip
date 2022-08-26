import { Test, TestingModule } from '@nestjs/testing';
import { Sequelize } from 'sequelize-typescript';
import { TrashUseCases } from './trash.usecase';
import { FileModel, SequelizeFileRepository } from '../file/file.repository';
import { File } from '../file/file.domain';
import {
  FolderModel,
  SequelizeFolderRepository,
} from '../folder/folder.repository';
import { getModelToken } from '@nestjs/sequelize';
import { User } from '../user/user.domain';
import { UserModel } from '../user/user.repository';
import { Folder } from '../folder/folder.domain';
import { FileUseCases } from '../file/file.usecase';
import { FolderUseCases } from '../folder/folder.usecase';
import { ShareUseCases } from '../share/share.usecase';
import { SequelizeShareRepository } from '../share/share.repository';
import { FileModule } from '../file/file.module';
import { FolderModule } from '../folder/folder.module';
import { UserModule } from '../user/user.module';

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
      imports: [FileModule, FolderModule, UserModule],
      providers: [
        TrashUseCases,
        FileUseCases,
        FolderUseCases,
        SequelizeFileRepository,
        SequelizeFolderRepository,
        ShareUseCases,
        SequelizeShareRepository,
        {
          provide: Sequelize,
          useValue: jest.fn(),
        },
        {
          provide: getModelToken(FileModel),
          useValue: jest.fn(),
        },
        {
          provide: getModelToken(FolderModel),
          useValue: jest.fn(),
        },
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
      jest
        .spyOn(fileUseCases, 'getByFolderAndUser')
        .mockImplementationOnce(() => Promise.resolve([]));
      jest
        .spyOn(folderUseCases, 'getChildrenFoldersToUser')
        .mockResolvedValueOnce([folder]);
      jest
        .spyOn(folderUseCases, 'deleteFolderPermanently')
        .mockImplementationOnce(() => Promise.resolve());
      jest
        .spyOn(folderUseCases, 'deleteOrphansFolders')
        .mockImplementationOnce(() => Promise.resolve());

      await service.clearTrash(userMock);

      expect(folderUseCases.deleteOrphansFolders).toHaveBeenCalledTimes(1);
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

      const file = File.build({
        id: 1,
        fileId: 'd666933f-0b1a-52c6-92d2-7ac1fc6d27fa',
        name: '',
        type: '',
        size: null,
        bucket: '',
        folderId: 4,
        encryptVersion: '',
        deleted: true,
        deletedAt: new Date(),
        userId: 1,
        modificationTime: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      jest
        .spyOn(fileUseCases, 'getByFolderAndUser')
        .mockResolvedValueOnce([file, file, file]);
      jest
        .spyOn(fileUseCases, 'deleteFilePermanently')
        .mockImplementation(() => Promise.resolve());
      jest
        .spyOn(folderUseCases, 'getChildrenFoldersToUser')
        .mockResolvedValueOnce([folder, folder]);
      jest
        .spyOn(folderUseCases, 'deleteFolderPermanently')
        .mockImplementation(() => Promise.resolve());
      jest
        .spyOn(folderUseCases, 'deleteOrphansFolders')
        .mockImplementationOnce(() => Promise.resolve());

      await service.clearTrash(userMock);

      expect(fileUseCases.getByFolderAndUser).toHaveBeenCalledTimes(1);
      expect(fileUseCases.deleteFilePermanently).toHaveBeenCalledTimes(3);
      expect(folderUseCases.getChildrenFoldersToUser).toHaveBeenCalledTimes(1);
      expect(folderUseCases.deleteFolderPermanently).toHaveBeenCalledTimes(2);
      expect(folderUseCases.deleteOrphansFolders).toHaveBeenCalledTimes(1);
    });

    it('should continue deleting if a item cannot be deleted', async () => {
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
      const file = File.build({
        id: 1,
        fileId: 'd666933f-0b1a-52c6-92d2-7ac1fc6d27fa',
        name: '',
        type: '',
        size: null,
        bucket: '',
        folderId: 4,
        encryptVersion: '',
        deleted: true,
        deletedAt: new Date(),
        userId: 1,
        modificationTime: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      jest
        .spyOn(fileUseCases, 'getByFolderAndUser')
        .mockResolvedValueOnce([
          file,
          File.build({ ...file, deleted: false }),
          file,
        ]);
      jest
        .spyOn(fileUseCases, 'deleteFilePermanently')
        .mockImplementation(() => Promise.resolve());
      jest
        .spyOn(folderUseCases, 'getChildrenFoldersToUser')
        .mockResolvedValueOnce([
          Folder.build({
            ...folder,
            deleted: false,
          }),
          folder,
          Folder.build({ ...folder, parentId: null }),
        ]);
      jest
        .spyOn(folderUseCases, 'deleteFolderPermanently')
        .mockImplementation(() => Promise.resolve());
      jest
        .spyOn(folderUseCases, 'deleteOrphansFolders')
        .mockImplementation(() => Promise.resolve());

      // jest.spyOn(service, 'deleteFilePermanently');

      await service.clearTrash(userMock);

      expect(fileUseCases.getByFolderAndUser).toHaveBeenCalledTimes(1);
      expect(fileUseCases.deleteFilePermanently).toHaveBeenCalledTimes(2);
      expect(folderUseCases.getChildrenFoldersToUser).toHaveBeenCalledTimes(1);
      expect(folderUseCases.deleteFolderPermanently).toHaveBeenCalledTimes(1);
      expect(folderUseCases.deleteOrphansFolders).toHaveBeenCalledTimes(1);
    });
  });
});
