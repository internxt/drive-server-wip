import { File } from '../file/file.domain';
import { Folder } from '../folder/folder.domain';
import { User } from '../user/user.domain';

export type Item = File | Folder;
type ItemId = File['uuid'] | Folder['uuid'];
type AddTimeStamps<T> = T & {
  createdAt: Date;
  updatedAt: Date;
};

export interface SharingAttributes {
  id: string;
  itemId: ItemId;
  itemType: 'file' | 'folder';
  ownerId: User['uuid'];
  sharedWith: User['uuid'];
  encryptionKey: string;
  encryptionAlgorithm: string;
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
  createdAt: Date;
  updatedAt: Date;

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
    this.encryptionKey = attributes.encryptionKey;
    this.encryptionAlgorithm = attributes.encryptionAlgorithm;
    this.createdAt = attributes.createdAt;
    this.updatedAt = attributes.updatedAt;

    this.folder = attributes.folder;
    this.file = attributes.file;
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
  createdAt: Date;
  updatedAt: Date;

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
      updatedAt: this.updatedAt,
      createdAt: this.createdAt,
    };
  }
}

export class SharingInviteWithItemAndUser extends SharingInvite {
  item: File | Folder;
  user: User;

  constructor(
    attributes: SharingInviteAttributes & { item: File | Folder; user: User },
  ) {
    super(attributes);

    this.item = attributes.item;
    this.user = attributes.user;
  }

  static build(
    sharingInvite: SharingInviteAttributes & {
      item: File | Folder;
      user: User;
    },
  ): SharingInvite {
    return new SharingInviteWithItemAndUser(sharingInvite);
  }

  toJSON(): SharingInviteAttributes & { item: File | Folder; user: User } {
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
      item: this.item,
      user: this.user,
    };
  }
}
