import { Folder } from '../folder/folder.domain';
import { User } from '../user/user.domain';
import { FileDto } from './dto/file.dto';

export interface FileAttributes {
  id: number;
  uuid: string;
  fileId: string;
  name: string;
  type: string;
  size: bigint;
  bucket: string;
  folderId: number;
  folder?: any;
  folderUuid: string;
  encryptVersion: string;
  deleted: boolean;
  deletedAt: Date;
  userId: number;
  user?: any;
  modificationTime: Date;
  plainName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FileOptions {
  deleted: FileAttributes['deleted'];
  page?: number;
  perPage?: number;
}

export class File implements FileAttributes {
  id: number;
  uuid: string;
  fileId: string;
  name: string;
  type: string;
  size: bigint;
  bucket: string;
  folderId: number;
  folder: Folder;
  folderUuid: string;
  encryptVersion: string;
  deleted: boolean;
  deletedAt: Date;
  userId: number;
  user: User;
  modificationTime: Date;
  createdAt: Date;
  updatedAt: Date;
  plainName: string;

  private constructor({
    id,
    fileId,
    name,
    type,
    size,
    bucket,
    folderId,
    folder,
    folderUuid,
    encryptVersion,
    deleted,
    deletedAt,
    userId,
    user,
    modificationTime,
    createdAt,
    updatedAt,
    uuid,
    plainName,
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
    this.folderUuid = folderUuid;
    this.uuid = uuid;
    this.plainName = plainName;
  }

  static build(file: FileAttributes): File {
    return new File(file);
  }

  isOwnedBy(user: User): boolean {
    return this.userId === user.id;
  }

  isChildrenOf(folder: Folder): boolean {
    return this.folderId === folder.id;
  }

  get networkId(): string {
    return this.fileId;
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
      folderUuid: this.folderUuid,
      encryptVersion: this.encryptVersion,
      deleted: this.deleted,
      deletedAt: this.deletedAt,
      userId: this.userId,
      modificationTime: this.modificationTime,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      plainName: this.plainName,
    };
  }
}
