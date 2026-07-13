import { Test, type TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { v4 } from 'uuid';
import { FavoriteUseCases } from './favorite.usecase';
import { SequelizeFavoriteRepository } from './favorite.repository';
import { SequelizeFileRepository } from '../file/file.repository';
import { SequelizeFolderRepository } from '../folder/folder.repository';
import { FavoriteItemType } from './favorite.domain';
import { newFavorite, newFile, newFolder, newUser } from '../../../test/fixtures';

describe('FavoriteUseCases', () => {
  let service: FavoriteUseCases;
  let favoriteRepository: SequelizeFavoriteRepository;
  let fileRepository: SequelizeFileRepository;
  let folderRepository: SequelizeFolderRepository;

  const user = newUser();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FavoriteUseCases],
    })
      .useMocker(() => createMock())
      .compile();

    service = module.get<FavoriteUseCases>(FavoriteUseCases);
    favoriteRepository = module.get<SequelizeFavoriteRepository>(
      SequelizeFavoriteRepository,
    );
    fileRepository = module.get<SequelizeFileRepository>(
      SequelizeFileRepository,
    );
    folderRepository = module.get<SequelizeFolderRepository>(
      SequelizeFolderRepository,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('markAsFavorite', () => {
    describe('when the item is a file', () => {
      it('When the file does not exist, then it throws NotFoundException', async () => {
        jest.spyOn(fileRepository, 'findOneBy').mockResolvedValueOnce(null);

        await expect(
          service.markAsFavorite(user, v4(), FavoriteItemType.File),
        ).rejects.toThrow(NotFoundException);
      });

      it('When the file is not owned by the user, then it throws ForbiddenException', async () => {
        const someoneElsesFile = newFile();
        jest
          .spyOn(fileRepository, 'findOneBy')
          .mockResolvedValueOnce(someoneElsesFile);

        await expect(
          service.markAsFavorite(user, someoneElsesFile.uuid, FavoriteItemType.File),
        ).rejects.toThrow(ForbiddenException);
      });

      it('When the file exists and is owned by the user, then it marks it as favorite', async () => {
        const ownFile = newFile({ owner: user });
        const mockFavorite = newFavorite({
          userId: user.uuid,
          itemId: ownFile.uuid,
          itemType: FavoriteItemType.File,
        });
        jest.spyOn(fileRepository, 'findOneBy').mockResolvedValueOnce(ownFile);
        jest
          .spyOn(favoriteRepository, 'create')
          .mockResolvedValueOnce(mockFavorite);

        const result = await service.markAsFavorite(
          user,
          ownFile.uuid,
          FavoriteItemType.File,
        );

        expect(fileRepository.findOneBy).toHaveBeenCalledWith({
          uuid: ownFile.uuid,
        });
        expect(favoriteRepository.create).toHaveBeenCalledWith(
          user.uuid,
          ownFile.uuid,
          FavoriteItemType.File,
        );
        expect(result).toEqual(mockFavorite);
      });
    });

    describe('when the item is a folder', () => {
      it('When the folder does not exist, then it throws NotFoundException', async () => {
        jest.spyOn(folderRepository, 'findOne').mockResolvedValueOnce(null);

        await expect(
          service.markAsFavorite(user, v4(), FavoriteItemType.Folder),
        ).rejects.toThrow(NotFoundException);
      });

      it('When the folder is not owned by the user, then it throws ForbiddenException', async () => {
        const someoneElsesFolder = newFolder();
        jest
          .spyOn(folderRepository, 'findOne')
          .mockResolvedValueOnce(someoneElsesFolder);

        await expect(
          service.markAsFavorite(
            user,
            someoneElsesFolder.uuid,
            FavoriteItemType.Folder,
          ),
        ).rejects.toThrow(ForbiddenException);
      });

      it('When the folder exists and is owned by the user, then it marks it as favorite', async () => {
        const ownFolder = newFolder({ owner: user });
        const mockFavorite = newFavorite({
          userId: user.uuid,
          itemId: ownFolder.uuid,
          itemType: FavoriteItemType.Folder,
        });
        jest
          .spyOn(folderRepository, 'findOne')
          .mockResolvedValueOnce(ownFolder);
        jest
          .spyOn(favoriteRepository, 'create')
          .mockResolvedValueOnce(mockFavorite);

        const result = await service.markAsFavorite(
          user,
          ownFolder.uuid,
          FavoriteItemType.Folder,
        );

        expect(folderRepository.findOne).toHaveBeenCalledWith({
          uuid: ownFolder.uuid,
        });
        expect(favoriteRepository.create).toHaveBeenCalledWith(
          user.uuid,
          ownFolder.uuid,
          FavoriteItemType.Folder,
        );
        expect(result).toEqual(mockFavorite);
      });
    });
  });

  describe('unmarkAsFavorite', () => {
    it('When called, then it deletes the favorite for that user and item', async () => {
      const itemId = v4();
      jest.spyOn(favoriteRepository, 'delete').mockResolvedValueOnce();

      await service.unmarkAsFavorite(user, itemId, FavoriteItemType.File);

      expect(favoriteRepository.delete).toHaveBeenCalledWith(
        user.uuid,
        itemId,
        FavoriteItemType.File,
      );
    });

    it('When the item was not favorited, then it does not throw', async () => {
      jest.spyOn(favoriteRepository, 'delete').mockResolvedValueOnce();

      await expect(
        service.unmarkAsFavorite(user, v4(), FavoriteItemType.Folder),
      ).resolves.not.toThrow();
    });
  });

  describe('bulkRemoveFavorites', () => {
    it('When called with item ids, then it bulk deletes the favorites for that user and type', async () => {
      const itemIds = [v4(), v4()];
      jest.spyOn(favoriteRepository, 'bulkDelete').mockResolvedValueOnce();

      await service.bulkRemoveFavorites(user, itemIds, FavoriteItemType.File);

      expect(favoriteRepository.bulkDelete).toHaveBeenCalledWith(
        user.uuid,
        itemIds,
        FavoriteItemType.File,
      );
    });

    it('When called with an empty list, then it does not call the repository', async () => {
      jest.spyOn(favoriteRepository, 'bulkDelete');

      await service.bulkRemoveFavorites(user, [], FavoriteItemType.Folder);

      expect(favoriteRepository.bulkDelete).not.toHaveBeenCalled();
    });
  });
});
