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
import { Folder } from './folder.domain';
import { FolderModel } from './folder.repository';
import { FileUseCases } from '../file/file.usecase';
import { FileModel, SequelizeFileRepository } from '../file/file.repository';

const folderId = 4;
const userId = 1;
describe('FolderUseCases', () => {
  let service: FolderUseCases;
  let folderRepository: FolderRepository;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
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
      ],
    }).compile();

    service = module.get<FolderUseCases>(FolderUseCases);
    folderRepository = module.get<FolderRepository>(SequelizeFolderRepository);
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
        encryptVersion: '2',
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
        encryptVersion: '2',
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
        encryptVersion: '2',
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
          encryptVersion: '2',
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
          name: null,
          bucket: 'bucket',
          userId: 1,
          encryptVersion: '2',
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
        encryptVersion: '2',
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
        encryptVersion: '2',
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
        encryptVersion: '2',
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
});
