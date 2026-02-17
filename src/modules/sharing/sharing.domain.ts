import type { File } from '../file/file.domain';
import type { Folder } from '../folder/folder.domain';
import type { User } from '../user/user.domain';
import type { WorkspaceTeam } from '../workspaces/domains/workspace-team.domain';

export type Item = File | Folder;
type ItemId = File['uuid'] | Folder['uuid'];
type AddTimeStamps<T> = T & {
  createdAt: Date;
  updatedAt: Date;
};

export enum SharingType {
  Public = 'public',
  Private = 'private',
}

export enum SharingItemType {
  File = 'file',
  Folder = 'folder',
}

export enum SharedWithType {
  Individual = 'individual',
  WorkspaceTeam = 'workspace_team',
}

export enum SharingActionName {
  UploadFile = 'UPLOAD_FILE',
  RenameItems = 'RENAME_ITEMS',
  ViewDetails = 'VIEW_DETAILS',
}

export interface SharingAttributes {
  id: string;
  itemId: ItemId;
  itemType: 'file' | 'folder';
  ownerId: User['uuid'];
  sharedWith: User['uuid'] | WorkspaceTeam['id'];
  sharedWithType?: SharedWithType;
  encryptedCode?: string;
  encryptedPassword?: string;
  encryptionKey: string;
  encryptionAlgorithm: string;
  type: SharingType;
  createdAt: Date;
  updatedAt: Date;
}

export interface SharingRoleAttributes {
  id: string;
  sharingId: SharingAttributes['id'];
  roleId: RoleAttributes['id'];
  createdAt: Date;
  updatedAt: Date;
}

export interface RoleAttributes {
  id: string;
  name: string;
}

export interface PermissionAttributes {
  id: string;
  roleId: RoleAttributes['id'];
  name: SharingActionName;
}

export interface SharingInviteAttributes extends Omit<
  SharingAttributes,
  'ownerId' | 'type' | 'sharedWithType'
> {
  id: string;
  type: 'SELF' | 'OWNER';
  roleId: RoleAttributes['id'];
  expirationAt?: Date;
}

export class Sharing implements SharingAttributes {
  id: string;
  itemId: ItemId;
  itemType: 'file' | 'folder';
  ownerId: User['uuid'];
  sharedWith: User['uuid'];
  sharedWithType?: SharedWithType;
  encryptionKey: string;
  encryptionAlgorithm: string;
  createdAt: Date;
  updatedAt: Date;
  encryptedCode?: string;
  encryptedPassword?: string;
  type: SharingType;

  folder?: Folder;
  file?: File;
  role?: Role;

  constructor(
    attributes: SharingAttributes & {
      folder?: Folder;
      file?: File;
      role?: Role;
    },
  ) {
    this.id = attributes.id;
    this.itemId = attributes.itemId;
    this.itemType = attributes.itemType;
    this.ownerId = attributes.ownerId;
    this.sharedWith = attributes.sharedWith;
    this.sharedWithType =
      attributes.sharedWithType ?? SharedWithType.Individual;

    this.encryptionKey = attributes.encryptionKey;
    this.encryptionAlgorithm = attributes.encryptionAlgorithm;
    this.encryptedCode = attributes.encryptedCode;
    this.encryptedPassword = attributes.encryptedPassword;
    this.createdAt = attributes.createdAt;
    this.updatedAt = attributes.updatedAt;

    this.folder = attributes.folder;
    this.file = attributes.file;
    this.type = attributes.type;
  }

  static build(sharing: SharingAttributes): Sharing {
    return new Sharing(sharing);
  }

  isOwnedBy(user: User): boolean {
    return this.ownerId === user.uuid;
  }

  isSharedWith(user: User): boolean {
    return this.sharedWith === user.uuid;
  }

  isPublic(): boolean {
    return this.type === SharingType.Public;
  }

  isHybrid(): boolean {
    return this.encryptionAlgorithm === 'hybrid';
  }

  isProtected(): boolean {
    return this.encryptedPassword !== null;
  }
}

export class SharingRole implements SharingRoleAttributes {
  id: string;
  sharingId: SharingAttributes['id'];
  roleId: RoleAttributes['id'];
  createdAt: Date;
  updatedAt: Date;
  role?: Role;

  constructor(attributes: SharingRoleAttributes & { role?: Role }) {
    this.id = attributes.id;
    this.sharingId = attributes.sharingId;
    this.roleId = attributes.roleId;
    this.createdAt = attributes.createdAt;
    this.updatedAt = attributes.updatedAt;
    this.role = attributes.role;
  }

  static build(
    privateSharingRole: SharingRoleAttributes & { role?: Role },
  ): SharingRole {
    return new SharingRole(privateSharingRole);
  }

  toJSON(): SharingRoleAttributes {
    return {
      id: this.id,
      sharingId: this.sharingId,
      roleId: this.roleId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

type RoleWithTimeStamps = AddTimeStamps<RoleAttributes>;
export class Role implements RoleWithTimeStamps {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(attributes: RoleWithTimeStamps) {
    this.id = attributes.id;
    this.name = attributes.name;
    this.createdAt = attributes.createdAt;
    this.updatedAt = attributes.updatedAt;
  }

  static build(role: RoleWithTimeStamps): Role {
    return new Role(role);
  }

  toJSON(): RoleWithTimeStamps {
    return {
      id: this.id,
      name: this.name,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

export class Permission implements PermissionAttributes {
  id: string;
  roleId: RoleAttributes['id'];
  name: SharingActionName;

  constructor(attributes: PermissionAttributes) {
    this.id = attributes.id;
    this.roleId = attributes.roleId;
    this.name = attributes.name;
  }

  static build(permission: PermissionAttributes): Permission {
    return new Permission(permission);
  }

  toJSON(): PermissionAttributes {
    return {
      id: this.id,
      roleId: this.roleId,
      name: this.name,
    };
  }
}

export class SharingInvite implements SharingInviteAttributes {
  id: string;
  itemId: ItemId;
  itemType: 'file' | 'folder';
  sharedWith: User['uuid'];
  encryptionKey: string;
  encryptionAlgorithm: string;
  type: 'SELF' | 'OWNER';
  roleId: string;
  createdAt: Date;
  updatedAt: Date;
  expirationAt: Date;

  constructor(attributes: SharingInviteAttributes) {
    this.id = attributes.id;
    this.itemId = attributes.itemId;
    this.itemType = attributes.itemType;
    this.sharedWith = attributes.sharedWith;
    this.encryptionKey = attributes.encryptionKey;
    this.encryptionAlgorithm = attributes.encryptionAlgorithm;
    this.type = attributes.type;
    this.roleId = attributes.roleId;
    this.createdAt = attributes.createdAt;
    this.updatedAt = attributes.updatedAt;
    this.expirationAt = attributes.expirationAt;
  }

  static build(sharingInvite: SharingInviteAttributes): SharingInvite {
    return new SharingInvite(sharingInvite);
  }

  isARequest(): boolean {
    return this.type === 'SELF';
  }

  isSharedWith(user: User): boolean {
    return user.uuid === this.sharedWith;
  }

  isHybrid(): boolean {
    return this.encryptionAlgorithm === 'hybrid';
  }

  toJSON(): SharingInviteAttributes {
    return {
      id: this.id,
      itemId: this.itemId,
      itemType: this.itemType,
      sharedWith: this.sharedWith,
      encryptionKey: this.encryptionKey,
      encryptionAlgorithm: this.encryptionAlgorithm,
      type: this.type,
      roleId: this.roleId,
      updatedAt: this.updatedAt,
      createdAt: this.createdAt,
    };
  }
}
