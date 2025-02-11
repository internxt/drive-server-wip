import { Folder } from '../folder/folder.domain';
import { Share } from '../share/share.domain';
import { Sharing } from '../sharing/sharing.domain';
import { Thumbnail } from '../thumbnail/thumbnail.domain';
import { User } from '../user/user.domain';
import { FileDto } from './dto/file.dto';
import { isStringEmpty } from '../../lib/validators';
import { ApiProperty } from '@nestjs/swagger';

export type SortableFileAttributes = keyof Pick<
  FileAttributes,
  'updatedAt' | 'size' | 'id' | 'plainName' | 'name'
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
  deleted: boolean;
  deletedAt: Date;
  removed: boolean;
  removedAt: Date;
  userId: number;
  user?: any;
  creationTime: Date;
  modificationTime: Date;
  plainName: string;
  createdAt: Date;
  updatedAt: Date;
  status: FileStatus;
  shares?: Share[];
  thumbnails?: Thumbnail[];
  sharings?: Sharing[];
}

export interface FileOptions {
  deleted: FileAttributes['deleted'];
  removed?: FileAttributes['removed'];
  page?: number;
  perPage?: number;
}

export class File implements FileAttributes {
  @ApiProperty()
  id: number;
  @ApiProperty()
  uuid: string;
  @ApiProperty()
  fileId: string;
  @ApiProperty()
  name: string;
  @ApiProperty()
  type: string;
  @ApiProperty()
  size: bigint;
  @ApiProperty()
  bucket: string;
  @ApiProperty()
  folderId: number;
  @ApiProperty()
  folder: Folder;
  @ApiProperty()
  folderUuid: string;
  @ApiProperty()
  encryptVersion: string;
  @ApiProperty()
  deleted: boolean;
  @ApiProperty()
  removed: boolean;
  @ApiProperty()
  deletedAt: Date;
  @ApiProperty()
  userId: number;
  @ApiProperty()
  user: User;
  @ApiProperty()
  creationTime: Date;
  @ApiProperty()
  modificationTime: Date;
  @ApiProperty()
  createdAt: Date;
  @ApiProperty()
  updatedAt: Date;
  @ApiProperty()
  removedAt: Date;
  @ApiProperty()
  plainName: string;
  @ApiProperty({ enum: FileStatus })
  status: FileStatus;
  @ApiProperty()
  shares?: Share[];
  @ApiProperty()
  sharings?: Sharing[];
  @ApiProperty()
  thumbnails?: Thumbnail[];

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
    creationTime,
    modificationTime,
    createdAt,
    updatedAt,
    uuid,
    plainName,
    removed,
    removedAt,
    status,
    shares,
    thumbnails,
    sharings,
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
    this.deleted = deleted;
    this.deletedAt = deletedAt;
    this.userId = userId;
    this.setUser(user);
    this.creationTime = creationTime;
    this.modificationTime = modificationTime;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.folderUuid = folderUuid;
    this.uuid = uuid;
    this.setPlainName(plainName);
    this.removed = removed;
    this.removedAt = removedAt;
    this.status = status;
    this.shares = shares;
    this.thumbnails = thumbnails;
    this.sharings = sharings;
    if (!this.isFilenameValid()) {
      throw new Error('Filename cannot be empty');
    }
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
      shares: this.shares,
      thumbnails: this.thumbnails,
      sharings: this.sharings,
    };
  }
}
