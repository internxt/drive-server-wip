import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { SequelizeFavoriteRepository } from './favorite.repository';
import { Favorite, FavoriteItemType } from './favorite.domain';
import { type User } from '../user/user.domain';
import { SequelizeFileRepository } from '../file/file.repository';
import { SequelizeFolderRepository } from '../folder/folder.repository';

@Injectable()
export class FavoriteUseCases {
  constructor(
    private readonly favoriteRepository: SequelizeFavoriteRepository,
    private readonly fileRepository: SequelizeFileRepository,
    private readonly folderRepository: SequelizeFolderRepository,
  ) {}

  async markAsFavorite(
    user: User,
    itemId: Favorite['itemId'],
    itemType: FavoriteItemType,
  ): Promise<Favorite> {
    const item =
      itemType === FavoriteItemType.File
        ? await this.fileRepository.findOneBy({ uuid: itemId })
        : await this.folderRepository.findOne({ uuid: itemId });

    if (!item) {
      throw new NotFoundException(`${itemType} not found`);
    }

    if (!item.isOwnedBy(user)) {
      throw new ForbiddenException(`This ${itemType} is not yours`);
    }

    return this.favoriteRepository.create(user.uuid, itemId, itemType);
  }

  async unmarkAsFavorite(
    user: User,
    itemId: Favorite['itemId'],
    itemType: FavoriteItemType,
  ): Promise<void> {
    await this.favoriteRepository.delete(user.uuid, itemId, itemType);
  }

  async bulkRemoveFavorites(
    user: User,
    itemIds: Favorite['itemId'][],
    itemType: FavoriteItemType,
  ): Promise<void> {
    if (itemIds.length === 0) {
      return;
    }

    await this.favoriteRepository.bulkDelete(user.uuid, itemIds, itemType);
  }
}
