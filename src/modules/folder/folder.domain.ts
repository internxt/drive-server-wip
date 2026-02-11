import type { Sharing } from '../sharing/sharing.domain';
import { User } from '../user/user.domain';
import type { FolderDto } from './dto/folder.dto';
import type { FolderAttributes } from './folder.attributes';

export type SortableFolderAttributes = keyof Pick<
  FolderAttributes,
  'id' | 'plainName' | 'updatedAt' | 'uuid'
>;

export enum FolderStatus {
  EXISTS = 'EXISTS',
  TRASHED = 'TRASHED',
  DELETED = 'DELETED',
}

export const FOLDER_STATUS_QUERY_VALUES = [
  'ALL',
  ...Object.values(FolderStatus),
] as const;
export type FolderStatusQuery = (typeof FOLDER_STATUS_QUERY_VALUES)[number];

export interface FolderOptions {
  deleted: FolderAttributes['deleted'];
  removed?: FolderAttributes['removed'];
}

export class Folder implements FolderAttributes {
  id: number;
  parentId: number | null;
  parentUuid: string | null;
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
  creationTime: Date;
  modificationTime: Date;
  sharings?: Sharing[];
  status: FolderStatus;

  private constructor({
    id,
    uuid,
    parentId,
    parentUuid,
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
    sharings,
    creationTime,
    modificationTime,
  }: FolderAttributes) {
    this.type = 'folder';
    this.id = id;
    this.parentId = parentId;
    this.parentUuid = parentUuid;
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
    this.sharings = sharings;
    this.creationTime = creationTime;
    this.modificationTime = modificationTime;
    this.status = this.getFolderStatus();
  }

  static build(folder: FolderAttributes): Folder {
    return new Folder(folder);
  }

  isRootFolder(): boolean {
    return this.parentId === null;
  }

  moveToTrash() {
    this.deleted = true;
    this.deletedAt = new Date();
  }

  getFolderStatus() {
    let folderStatus = FolderStatus.EXISTS;

    if (this.removed) {
      folderStatus = FolderStatus.DELETED;
    } else if (this.deleted) {
      folderStatus = FolderStatus.TRASHED;
    }

    return folderStatus;
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

  isRoot(): boolean {
    return this.bucket && this.parentId === null;
  }

  isBackup(driveRootFolder: Folder): boolean {
    return this.isRoot() && driveRootFolder.bucket !== this.bucket;
  }

  setUser(user) {
    if (user && !(user instanceof User)) {
      throw Error('user invalid');
    }
    this.user = user;
  }

  static getFilterByStatus(
    status: FolderStatus,
  ): Partial<Pick<FolderOptions, 'deleted' | 'removed'>> {
    switch (status) {
      case FolderStatus.EXISTS:
        return {
          deleted: false,
          removed: false,
        };
      case FolderStatus.TRASHED:
        return {
          deleted: true,
          removed: false,
        };
      case FolderStatus.DELETED:
        return {
          removed: true,
        };
      default:
        return {};
    }
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
      sharings: this.sharings,
    };
  }
}
export { FolderAttributes };
