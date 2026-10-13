import { Folder } from '../folder/folder.domain';
import { type Sharing } from '../sharing/sharing.domain';
import { type Thumbnail } from '../thumbnail/thumbnail.domain';
import { User } from '../user/user.domain';
import { isStringEmpty } from '../../lib/validators';
import type { FileDto } from './dto/file.dto';

export type SortableFileAttributes = keyof Pick<
  FileAttributes,
  'updatedAt' | 'size' | 'id' | 'plainName' | 'uuid'
>;

export enum FileStatus {
  EXISTS = 'EXISTS',
  TRASHED = 'TRASHED',
  DELETED = 'DELETED',
}

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
  userId: number;
  user?: any;
  creationTime: Date;
  modificationTime: Date;
  plainName: string;
  createdAt: Date;
  updatedAt: Date;
  status: FileStatus;
  thumbnails?: Thumbnail[];
  sharings?: Sharing[];
  isFavorite?: boolean;
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
  userId: number;
  user: User;
  creationTime: Date;
  modificationTime: Date;
  createdAt: Date;
  updatedAt: Date;
  plainName: string;
  status: FileStatus;
  sharings?: Sharing[];
  thumbnails?: Thumbnail[];
  isFavorite?: boolean;
  // Legacy response fields derived from status, still consumed by older clients
  deleted: boolean;
  deletedAt: Date | null;
  removed: boolean;
  removedAt: Date | null;

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
    userId,
    user,
    creationTime,
    modificationTime,
    createdAt,
    updatedAt,
    uuid,
    plainName,
    status,
    thumbnails,
    sharings,
    isFavorite,
  }: FileAttributes) {
    this.id = id;
    this.fileId = fileId;
    this.folderId = folderId;
    this.setFolder(folder);
    this.name = name;
    this.setType(type);
    this.size = size;
    this.bucket = bucket;
    this.encryptVersion = encryptVersion;
    this.userId = userId;
    this.setUser(user);
    this.creationTime = creationTime;
    this.modificationTime = modificationTime;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.folderUuid = folderUuid;
    this.uuid = uuid;
    this.setPlainName(plainName);
    this.status = status;
    this.thumbnails = thumbnails;
    this.sharings = sharings;
    this.isFavorite = isFavorite;
    this.setLegacyStatusFields();
  }

  static build(file: FileAttributes): File {
    return new File(file);
  }

  isOwnedBy(user: User): boolean {
    return this.userId === user.id;
  }

  isDeleted(): boolean {
    return this.status === FileStatus.DELETED;
  }

  isEmpty(): boolean {
    return BigInt(this.size) === BigInt(0);
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

  setPlainName(newPlainName?: string) {
    if (isStringEmpty(newPlainName)) {
      newPlainName = '';
    }
    this.plainName = newPlainName;
  }

  setType(newType?: string) {
    if (isStringEmpty(newType)) {
      newType = null;
    }
    this.type = newType;
  }

  isFilenameValid(): boolean {
    return !(isStringEmpty(this.plainName) && isStringEmpty(this.type));
  }

  private setLegacyStatusFields() {
    this.deleted = this.status !== FileStatus.EXISTS;
    this.deletedAt = this.deleted ? this.updatedAt : null;
    this.removed = this.status === FileStatus.DELETED;
    this.removedAt = this.removed ? this.updatedAt : null;
  }

  toJSON(): FileDto {
    return {
      id: this.id,
      uuid: this.uuid,
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
      creationTime: this.creationTime,
      modificationTime: this.modificationTime,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      plainName: this.plainName,
      removed: this.removed,
      removedAt: this.removedAt,
      status: this.status,
      thumbnails: this.thumbnails,
      sharings: this.sharings,
      isFavorite: this.isFavorite,
    };
  }
}
