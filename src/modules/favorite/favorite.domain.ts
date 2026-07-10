import { type User } from '../user/user.domain';

export enum FavoriteItemType {
  File = 'file',
  Folder = 'folder',
}

export interface FavoriteAttributes {
  id: string;
  userId: User['uuid'];
  itemId: string;
  itemType: FavoriteItemType;
  createdAt: Date;
}

export class Favorite implements FavoriteAttributes {
  id: string;
  userId: User['uuid'];
  itemId: string;
  itemType: FavoriteItemType;
  createdAt: Date;

  constructor({ id, userId, itemId, itemType, createdAt }: FavoriteAttributes) {
    this.id = id;
    this.userId = userId;
    this.itemId = itemId;
    this.itemType = itemType;
    this.createdAt = createdAt;
  }

  static build(attributes: FavoriteAttributes): Favorite {
    return new Favorite(attributes);
  }

  isOwnedBy(user: User): boolean {
    return this.userId === user.uuid;
  }

  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      itemId: this.itemId,
      itemType: this.itemType,
      createdAt: this.createdAt,
    };
  }
}
