import { User } from '../user/user.domain';
import { FolderDto } from './dto/folder.dto';
import { FolderAttributes } from './folder.attributes';

export type SortableFolderAttributes = keyof Pick<
  FolderAttributes,
  'id' | 'name' | 'plainName' | 'updatedAt'
>;

export interface FolderOptions {
  deleted: FolderAttributes['deleted'];
  removed?: FolderAttributes['removed'];
}

export class Folder implements FolderAttributes {
  id: number;
  parentId: number;
  parent: Folder;
  type: string;
  name: string;
  bucket: string;
  userId: number;
  user?: User;
  uuid: string;
  plainName: string;
  encryptVersion: FolderAttributes['encryptVersion'];
  deleted: boolean;
  removed: boolean;
  removedAt: Date;
  deletedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  size: number;
  private constructor({
    id,
    uuid,
    parentId,
    parent,
    name,
    bucket,
    userId,
    user,
    plainName,
    encryptVersion,
    deleted,
    deletedAt,
    createdAt,
    updatedAt,
    removed,
    removedAt,
  }: FolderAttributes) {
    this.type = 'folder';
    this.id = id;
    this.parentId = parentId;
    this.name = name;
    this.setParent(parent);
    this.bucket = bucket;
    this.userId = userId;
    this.setUser(user);
    this.encryptVersion = encryptVersion;
    this.deleted = deleted;
    this.deletedAt = deletedAt;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.uuid = uuid;
    this.plainName = plainName;
    this.size = 0;
    this.removed = removed;
    this.removedAt = removedAt;
  }

  static build(file: FolderAttributes): Folder {
    return new Folder(file);
  }

  isRootFolder(): boolean {
    return this.parentId === null;
  }

  moveToTrash() {
    this.deleted = true;
    this.deletedAt = new Date();
  }

  removeFromTrash() {
    this.deleted = false;
    this.deletedAt = null;
  }
  setParent(parent) {
    if (parent && !(parent instanceof Folder)) {
      throw Error('parent folder invalid');
    }
    this.parent = parent;
  }

  isOwnedBy(user: User): boolean {
    return this.userId === user.id;
  }

  isTrashed(): boolean {
    if (this.removed) {
      return false;
    }
    return this.deleted;
  }

  isRemoved(): boolean {
    return this.removed;
  }

  setUser(user) {
    if (user && !(user instanceof User)) {
      throw Error('user invalid');
    }
    this.user = user;
  }

  toJSON(): FolderDto {
    return {
      id: this.id,
      parent: this.parent,
      uuid: this.uuid,
      name: this.name,
      bucket: this.bucket,
      userId: this.userId,
      encryptVersion: this.encryptVersion,
      plainName: this.plainName,
      size: this.size,
      deleted: this.deleted,
      removed: this.removed,
      removedAt: this.removedAt,
      deletedAt: this.deletedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
export { FolderAttributes };
