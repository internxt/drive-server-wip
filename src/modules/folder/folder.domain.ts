import { User } from '../user/user.domain';
import { FolderDto } from './dto/folder.dto';
import { FolderAttributes } from './folder.attributes';

export interface FolderOptions {
  deleted: FolderAttributes['deleted'];
}

export class Folder implements FolderAttributes {
  id: number;
  parentId: number;
  parent: Folder;
  type: string;
  name: string;
  plain_name: string;
  bucket: string;
  userId: number;
  user?: User;
  uuid: string;
  encryptVersion: FolderAttributes['encryptVersion'];
  deleted: boolean;
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
    plain_name,
    bucket,
    userId,
    user,
    encryptVersion,
    deleted,
    deletedAt,
    createdAt,
    updatedAt,
  }: FolderAttributes) {
    this.type = 'folder';
    this.id = id;
    this.parentId = parentId;
    this.name = name;
    this.plain_name = plain_name;
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
    this.size = 0;
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
      plain_name: this.plain_name,
      bucket: this.bucket,
      userId: this.userId,
      encryptVersion: this.encryptVersion,
      size: this.size,
      deleted: this.deleted,
      deletedAt: this.deletedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
