import { createMock } from '@golevelup/ts-jest';
import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { newFile, newFolder, newUser } from '../../../test/fixtures';
import { FavoriteController } from './favorite.controller';
import { FavoriteUseCases } from './favorite.usecase';
import { FavoriteItemType } from './favorite.domain';
import { FileUseCases } from '../file/file.usecase';
import { FolderUseCases } from '../folder/folder.usecase';
import { SortOrder } from '../../common/order.type';
import { type GetFavoritesDto } from './dto/get-favorites.dto';

describe('FavoriteController', () => {
  let favoriteController: FavoriteController;
  let favoriteUseCases: FavoriteUseCases;
  let fileUseCases: FileUseCases;
  let folderUseCases: FolderUseCases;

  const userMocked = newUser();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FavoriteController],
      providers: [
        { provide: FavoriteUseCases, useValue: createMock() },
        { provide: FileUseCases, useValue: createMock() },
        { provide: FolderUseCases, useValue: createMock() },
      ],
    })
      .useMocker(createMock)
      .compile();

    favoriteController = module.get<FavoriteController>(FavoriteController);
    favoriteUseCases = module.get<FavoriteUseCases>(FavoriteUseCases);
    fileUseCases = module.get<FileUseCases>(FileUseCases);
    folderUseCases = module.get<FolderUseCases>(FolderUseCases);
  });

  describe('markItemAsFavorite', () => {
    it('When a valid file uuid is provided, then it marks the file as favorite', async () => {
      const file = newFile();
      jest.spyOn(favoriteUseCases, 'markAsFavorite').mockResolvedValueOnce({
        id: 'favorite-id',
        userId: userMocked.uuid,
        itemId: file.uuid,
        itemType: FavoriteItemType.File,
        createdAt: new Date(),
      } as any);

      const result = await favoriteController.markItemAsFavorite(
        userMocked,
        FavoriteItemType.File,
        file.uuid,
      );

      expect(favoriteUseCases.markAsFavorite).toHaveBeenCalledWith(
        userMocked,
        file.uuid,
        FavoriteItemType.File,
      );
      expect(result).toEqual({ favorited: true });
    });

    it('When a valid folder uuid is provided, then it marks the folder as favorite', async () => {
      const folder = newFolder();
      jest.spyOn(favoriteUseCases, 'markAsFavorite').mockResolvedValueOnce({
        id: 'favorite-id',
        userId: userMocked.uuid,
        itemId: folder.uuid,
        itemType: FavoriteItemType.Folder,
        createdAt: new Date(),
      } as any);

      const result = await favoriteController.markItemAsFavorite(
        userMocked,
        FavoriteItemType.Folder,
        folder.uuid,
      );

      expect(favoriteUseCases.markAsFavorite).toHaveBeenCalledWith(
        userMocked,
        folder.uuid,
        FavoriteItemType.Folder,
      );
      expect(result).toEqual({ favorited: true });
    });

    it('When the item does not exist, then it should throw', async () => {
      const file = newFile();
      jest
        .spyOn(favoriteUseCases, 'markAsFavorite')
        .mockRejectedValueOnce(new NotFoundException());

      await expect(
        favoriteController.markItemAsFavorite(
          userMocked,
          FavoriteItemType.File,
          file.uuid,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('unmarkItemAsFavorite', () => {
    it('When a valid file uuid is provided, then it unmarks the file as favorite', async () => {
      const file = newFile();
      jest
        .spyOn(favoriteUseCases, 'unmarkAsFavorite')
        .mockResolvedValueOnce(undefined);

      const result = await favoriteController.unmarkItemAsFavorite(
        userMocked,
        FavoriteItemType.File,
        file.uuid,
      );

      expect(favoriteUseCases.unmarkAsFavorite).toHaveBeenCalledWith(
        userMocked,
        file.uuid,
        FavoriteItemType.File,
      );
      expect(result).toEqual({ favorited: false });
    });

    it('When a valid folder uuid is provided, then it unmarks the folder as favorite', async () => {
      const folder = newFolder();
      jest
        .spyOn(favoriteUseCases, 'unmarkAsFavorite')
        .mockResolvedValueOnce(undefined);

      const result = await favoriteController.unmarkItemAsFavorite(
        userMocked,
        FavoriteItemType.Folder,
        folder.uuid,
      );

      expect(favoriteUseCases.unmarkAsFavorite).toHaveBeenCalledWith(
        userMocked,
        folder.uuid,
        FavoriteItemType.Folder,
      );
      expect(result).toEqual({ favorited: false });
    });
  });

  describe('getFavorites', () => {
    it('When called with type file, then it returns the favorite files from the use case', async () => {
      const mockFiles = [newFile(), newFile()];
      jest
        .spyOn(fileUseCases, 'getFavoriteFiles')
        .mockResolvedValueOnce(mockFiles as any);

      const queryParams: GetFavoritesDto = {
        type: FavoriteItemType.File,
        limit: 50,
        offset: 0,
        sort: 'plainName',
        order: SortOrder.ASC,
      };

      const result = await favoriteController.getFavorites(
        userMocked,
        queryParams,
      );

      expect(result).toEqual(mockFiles);
      expect(fileUseCases.getFavoriteFiles).toHaveBeenCalledWith(userMocked, {
        limit: 50,
        offset: 0,
        sort: [['plainName', 'ASC']],
      });
      expect(folderUseCases.getFavoriteFolders).not.toHaveBeenCalled();
    });

    it('When called with type folder, then it returns the favorite folders from the use case', async () => {
      const mockFolders = [newFolder(), newFolder()];
      jest
        .spyOn(folderUseCases, 'getFavoriteFolders')
        .mockResolvedValueOnce(mockFolders);
      jest
        .spyOn(folderUseCases, 'decryptFolderName')
        .mockImplementation((f) => f);

      const queryParams: GetFavoritesDto = {
        type: FavoriteItemType.Folder,
        limit: 50,
        offset: 0,
        sort: 'plainName',
        order: SortOrder.ASC,
      };

      const result = await favoriteController.getFavorites(
        userMocked,
        queryParams,
      );

      expect(result).toEqual(
        mockFolders.map((f) => ({ ...f, status: f.getFolderStatus() })),
      );
      expect(folderUseCases.getFavoriteFolders).toHaveBeenCalledWith(
        userMocked,
        {
          limit: 50,
          offset: 0,
          sort: [['plainName', 'ASC']],
        },
      );
      expect(fileUseCases.getFavoriteFiles).not.toHaveBeenCalled();
    });
  });
});
