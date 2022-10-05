import { Test, TestingModule } from '@nestjs/testing';
import { FolderUseCases } from './folder.usecase';
import {
  SequelizeFolderRepository,
  FolderRepository,
} from './folder.repository';
import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { Folder, FolderAttributes } from './folder.domain';
import { FolderModel } from './folder.repository';
import { FileUseCases } from '../file/file.usecase';
import { FileModel, SequelizeFileRepository } from '../file/file.repository';
import {
  SequelizeShareRepository,
  ShareModel,
} from '../share/share.repository';
import { ShareUseCases } from '../share/share.usecase';
import { SequelizeUserRepository, UserModel } from '../user/user.repository';
import { BridgeModule } from '../../externals/bridge/bridge.module';
import { CryptoModule } from '../../externals/crypto/crypto.module';
import { CryptoService } from '../../externals/crypto/crypto.service';

const folderId = 4;
const userId = 1;
describe('FolderUseCases', () => {
  let service: FolderUseCases;
  let folderRepository: FolderRepository;
  let cryptoService: CryptoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [BridgeModule, CryptoModule],
      providers: [
        FolderUseCases,
        FileUseCases,
        SequelizeFileRepository,
        SequelizeFolderRepository,
        {
          provide: getModelToken(FolderModel),
          useValue: jest.fn(),
        },
        {
          provide: getModelToken(FileModel),
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

    service = module.get<FolderUseCases>(FolderUseCases);
    folderRepository = module.get<FolderRepository>(SequelizeFolderRepository);
    cryptoService = module.get<CryptoService>(CryptoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('move folder to trash use case', () => {
    it('calls moveFolderToTrash and return file', async () => {
      const mockFolder = Folder.build({
        id: 1,
        parentId: null,
        name: 'name',
        bucket: 'bucket',
        userId: 1,
        encryptVersion: '03-aes',
        deleted: true,
        deletedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      jest
        .spyOn(folderRepository, 'updateByFolderId')
        .mockResolvedValue(mockFolder);
      const result = await service.moveFolderToTrash(folderId);
      expect(result).toEqual(mockFolder);
    });

    it('throws an error if the folder is not found', async () => {
      jest
        .spyOn(folderRepository, 'updateByFolderId')
        .mockRejectedValue(new NotFoundException());
      expect(service.moveFolderToTrash(folderId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('get folder use case', () => {
    it('calls getFolder and return folder', async () => {
      const mockFolder = Folder.build({
        id: 1,
        parentId: null,
        name: 'name',
        bucket: 'bucket',
        userId: 1,
        encryptVersion: '03-aes',
        deleted: true,
        deletedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        user: null,
        parent: null,
      });
      jest.spyOn(folderRepository, 'findById').mockResolvedValue(mockFolder);
      const result = await service.getFolder(folderId);
      expect(result).toMatchObject({
        id: 1,
        bucket: 'bucket',
        userId: 1,
        encryptVersion: '03-aes',
        deleted: true,
        parent: null,
      });
      expect(folderRepository.findById).toHaveBeenNthCalledWith(1, folderId);
    });

    it('throws an error if the folder is not found', async () => {
      jest.spyOn(folderRepository, 'findById').mockResolvedValue(null);
      expect(service.getFolder(folderId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getChildrenFoldersToUser', () => {
    it('calls getChildrenFoldersToUser and return empty folders', async () => {
      const mockFolders = [];
      jest
        .spyOn(folderRepository, 'findAllByParentIdAndUserId')
        .mockResolvedValue(mockFolders);
      const result = await service.getChildrenFoldersToUser(
        folderId,
        userId,
        false,
      );
      expect(result).toEqual(mockFolders);
      expect(
        folderRepository.findAllByParentIdAndUserId,
      ).toHaveBeenNthCalledWith(1, folderId, userId, false);
    });

    it('calls getChildrenFoldersToUser and return folders', async () => {
      const nameEncrypted =
        'ONzgORtJ77qI28jDnr+GjwJn6xELsAEqsn3FKlKNYbHR7Z129AD/WOMkAChEKx6rm7hOER2drdmXmC296dvSXtE5y5os0XCS554YYc+dcCMIkot/v6Wu6rlBC5MPlngR+CkmvA==';
      const mockFolders = [
        Folder.build({
          id: 4,
          parentId: 1,
          name: nameEncrypted,
          bucket: 'bucket',
          userId: 1,
          encryptVersion: '03-aes',
          deleted: true,
          deletedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ];
      jest
        .spyOn(folderRepository, 'findAllByParentIdAndUserId')
        .mockResolvedValue(mockFolders);
      const result = await service.getChildrenFoldersToUser(
        folderId,
        userId,
        false,
      );
      expect(result).toMatchObject([
        {
          id: 4,
          parentId: 1,
          name: nameEncrypted,
          bucket: 'bucket',
          userId: 1,
          encryptVersion: '03-aes',
          deleted: true,
        },
      ]);
      expect(
        folderRepository.findAllByParentIdAndUserId,
      ).toHaveBeenNthCalledWith(1, folderId, userId, false);
    });
  });

  describe('delete folder use case', () => {
    it('should be able to delete a trashed folder', async () => {
      const folderId = 2713105696;
      const folder = Folder.build({
        id: folderId,
        parentId: 3388762609,
        name: 'name',
        bucket: 'bucket',
        userId: 1,
        encryptVersion: '03-aes',
        deleted: true,
        deletedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        user: null,
        parent: null,
      });

      jest
        .spyOn(folderRepository, 'deleteById')
        .mockImplementationOnce(() => Promise.resolve());

      await service.deleteFolderPermanently(folder);

      expect(folderRepository.deleteById).toHaveBeenCalledWith(folderId);
    });

    it('should fail when the folder trying to delete has not been trashed', async () => {
      const folderId = 2713105696;
      const folder = Folder.build({
        id: folderId,
        parentId: 3388762609,
        name: 'name',
        bucket: 'bucket',
        userId: 1,
        encryptVersion: '03-aes',
        deleted: false,
        deletedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        user: null,
        parent: null,
      });

      jest
        .spyOn(folderRepository, 'deleteById')
        .mockImplementationOnce(() => Promise.resolve());

      expect(service.deleteFolderPermanently(folder)).rejects.toThrow(
        new UnprocessableEntityException(
          `folder with id ${folderId} cannot be permanently deleted`,
        ),
      );
      expect(folderRepository.deleteById).toHaveBeenCalledTimes(0);
    });

    it('should fail when the folder trying to delete is a root folder', async () => {
      const folderId = 2713105696;
      const folder = Folder.build({
        id: folderId,
        parentId: null,
        name: 'name',
        bucket: 'bucket',
        userId: 1,
        encryptVersion: '03-aes',
        deleted: false,
        deletedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        user: null,
        parent: null,
      });

      jest
        .spyOn(folderRepository, 'deleteById')
        .mockImplementationOnce(() => Promise.resolve());

      expect(service.deleteFolderPermanently(folder)).rejects.toThrow(
        new UnprocessableEntityException(
          `folder with id ${folderId} is a root folder`,
        ),
      );
      expect(folderRepository.deleteById).toHaveBeenCalledTimes(0);
    });
  });

  describe('delete Orphaned folders', () => {
    const userId = 3135417944;
    it('should delete orphan folders until there are none', async () => {
      jest
        .spyOn(folderRepository, 'clearOrphansFolders')
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(39)
        .mockResolvedValueOnce(4)
        .mockResolvedValueOnce(0);

      jest.spyOn(service, 'deleteOrphansFolders');

      await service.deleteOrphansFolders(userId);

      expect(service.deleteOrphansFolders).toBeCalledTimes(4);
    });

    it('should avoid recursion if not needed', async () => {
      jest
        .spyOn(folderRepository, 'clearOrphansFolders')
        .mockResolvedValueOnce(0);

      jest.spyOn(service, 'deleteOrphansFolders');

      await service.deleteOrphansFolders(userId);

      expect(service.deleteOrphansFolders).toBeCalledTimes(1);
    });
  });

  describe('decrypt folder name', () => {
    const folderAtributes: FolderAttributes = {
      id: 1,
      parentId: null,
      parent: null,
      name: 'name',
      bucket: 'bucket',
      userId: 1,
      encryptVersion: '03-aes',
      deleted: true,
      deletedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('returns folder json data with the name decrypted', () => {
      const name = 'Macedonia';
      const parentId = 3385750628;

      const encriptedName = cryptoService.encryptName(name, parentId);

      const folder = Folder.build({
        ...folderAtributes,
        name: encriptedName,
        parentId,
      });

      const result = service.decryptFolderName(folder);

      const expectedResult = {
        ...folderAtributes,
        name,
        size: 0,
      };
      delete expectedResult.parentId;

      expect(result).toStrictEqual(expectedResult);
    });

    it('fails when the folder name is not encrypted', () => {
      const name = 'not encrypted name';
      const parentId = 2192829271;

      const folder = Folder.build({ ...folderAtributes, name, parentId });

      try {
        service.decryptFolderName(folder);
      } catch (err: any) {
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe('Unable to decrypt folder name');
      }
    });
  });
});
