import { File } from '../file/file.domain';
import { Folder } from '../folder/folder.domain';
import { User } from '../user/user.domain';

type ItemId = File['uuid'] | Folder['uuid'];

export interface SharingAttributes {
  id: string;
  itemId: ItemId;
  itemType: 'file' | 'folder';
  ownerId: User['uuid'];
  sharedWith: User['uuid'];
  encryptionKey: string;
  encryptionAlgorithm: string;
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
  name: string;
}

export interface SharingInviteAttributes
  extends Omit<SharingAttributes, 'ownerId'> {
  id: string;
  type: 'SELF' | 'OWNER';
  roleId: RoleAttributes['id'];
}

export class Sharing implements SharingAttributes {
  id: string;
  itemId: ItemId;
  itemType: 'file' | 'folder';
  ownerId: User['uuid'];
  sharedWith: User['uuid'];
  encryptionKey: string;
  encryptionAlgorithm: string;

  constructor(attributes: SharingAttributes) {
    this.id = attributes.id;
    this.itemId = attributes.itemId;
    this.itemType = attributes.itemType;
    this.ownerId = attributes.ownerId;
    this.sharedWith = attributes.sharedWith;
    this.encryptionKey = attributes.encryptionKey;
    this.encryptionAlgorithm = attributes.encryptionAlgorithm;
  }

  static build(sharing: SharingAttributes): Sharing {
    return new Sharing(sharing);
  }

  isOwnedBy(user: User): boolean {
    return this.ownerId === user.uuid;
  }

  toJSON(): SharingAttributes {
    return {
      id: this.id,
      itemId: this.itemId,
      itemType: this.itemType,
      ownerId: this.ownerId,
      sharedWith: this.sharedWith,
      encryptionKey: this.encryptionKey,
      encryptionAlgorithm: this.encryptionAlgorithm,
    };
  }
}

export class SharingRole implements SharingRoleAttributes {
  id: string;
  sharingId: SharingAttributes['id'];
  roleId: RoleAttributes['id'];
  createdAt: Date;
  updatedAt: Date;

  constructor(attributes: SharingRoleAttributes) {
    this.id = attributes.id;
    this.sharingId = attributes.sharingId;
    this.roleId = attributes.roleId;
    this.createdAt = attributes.createdAt;
    this.updatedAt = attributes.updatedAt;
  }

  static build(privateSharingRole: SharingRoleAttributes): SharingRole {
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

export class Role implements RoleAttributes {
  id: string;
  name: string;

  constructor(attributes: RoleAttributes) {
    this.id = attributes.id;
    this.name = attributes.name;
  }

  static build(role: RoleAttributes): Role {
    return new Role(role);
  }

  toJSON(): RoleAttributes {
    return {
      id: this.id,
      name: this.name,
    };
  }
}

export class Permission implements PermissionAttributes {
  id: string;
  roleId: RoleAttributes['id'];
  name: string;

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

  constructor(attributes: SharingInviteAttributes) {
    this.id = attributes.id;
    this.itemId = attributes.itemId;
    this.itemType = attributes.itemType;
    this.sharedWith = attributes.sharedWith;
    this.encryptionKey = attributes.encryptionKey;
    this.encryptionAlgorithm = attributes.encryptionAlgorithm;
    this.type = attributes.type;
    this.roleId = attributes.roleId;
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
    };
  }
}
