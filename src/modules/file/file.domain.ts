import { Folder } from '../folder/folder.domain';
import { User } from '../user/user.domain';
import { FileDto } from './dto/file.dto';

export interface FileAttributes {
  id: number;
  fileId: string;
  name: string;
  type: string;
  size: bigint;
  bucket: string;
  folderId: number;
  folder?: any;
  encryptVersion: string;
  deleted: boolean;
  deletedAt: Date;
  userId: number;
  user?: any;
  modificationTime: Date;
  createdAt: Date;
  updatedAt: Date;
}
export class File implements FileAttributes {
  id: number;
  fileId: string;
  name: string;
  type: string;
  size: bigint;
  bucket: string;
  folderId: number;
  folder: Folder;
  encryptVersion: string;
  deleted: boolean;
  deletedAt: Date;
  userId: number;
  user: User;
  modificationTime: Date;
  createdAt: Date;
  updatedAt: Date;
  private constructor({
    id,
    fileId,
    name,
    type,
    size,
    bucket,
    folderId,
    folder,
    encryptVersion,
    deleted,
    deletedAt,
    userId,
    user,
    modificationTime,
    createdAt,
    updatedAt,
  }: FileAttributes) {
    this.id = id;
    this.fileId = fileId;
    this.folderId = folderId;
    this.setFolder(folder);
    this.name = name;
    this.type = type;
    this.size = size;
    this.bucket = bucket;
    this.encryptVersion = encryptVersion;
    this.deleted = deleted;
    this.deletedAt = deletedAt;
    this.userId = userId;
    this.setUser(user);
    this.modificationTime = modificationTime;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  static build(file: FileAttributes): File {
    return new File(file);
  }

  setFolder(folder) {
    if (folder && !(folder instanceof Folder)) {
      throw Error('folder invalid');
    }
    this.folder = folder;
  }
  setUser(user) {
    if (user && !(user instanceof User)) {
      throw Error('user invalid');
    }
    this.user = user;
  }
  moveToTrash() {
    this.deleted = true;
    this.deletedAt = new Date();
  }

  removeFromTrash() {
    this.deleted = false;
    this.deletedAt = null;
  }

  toJSON(): FileDto {
    return {
      id: this.id,
      fileId: this.fileId,
      name: this.name,
      type: this.type,
      size: this.size,
      bucket: this.bucket,
      folderId: this.folderId,
      folder: this.folder,
      encryptVersion: this.encryptVersion,
      deleted: this.deleted,
      deletedAt: this.deletedAt,
      userId: this.userId,
      modificationTime: this.modificationTime,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
