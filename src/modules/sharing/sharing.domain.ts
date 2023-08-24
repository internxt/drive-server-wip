import { File } from '../file/file.domain';
import { Folder } from '../folder/folder.domain';
import { User } from '../user/user.domain';

type ItemId = File['uuid'] | Folder['uuid'];

export interface SharingKeyAttributes {
  id: string;
  key: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SharingAttributes {
  id: string;
  itemId: ItemId;
  itemType: 'file' | 'folder';
  ownerId: User['uuid'];
  sharedWith: User['uuid'];
  sharingKeyId: SharingKeyAttributes['id'];
}

export interface SharingRoleAttributes {
  id: string;
  role: string;
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

export interface SharingInviteAttributes {
  id: string;
  itemId: ItemId;
  itemType: 'file' | 'folder';
  sharedWith: User['uuid'];
  encryptionKey: string;
  encryptionAlgorithm: string;
  type: 'SELF' | 'OWNER';
}

export class SharingKey implements SharingKeyAttributes {
  id: string;
  key: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(attributes: SharingKeyAttributes) {
    this.id = attributes.id;
    this.key = attributes.key;
    this.createdAt = attributes.createdAt;
    this.updatedAt = attributes.updatedAt;
  }

  static build(sharingKey: SharingKeyAttributes): SharingKey {
    return new SharingKey(sharingKey);
  }

  toJSON(): SharingKeyAttributes {
    return {
      id: this.id,
      key: this.key,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

export class Sharing implements SharingAttributes {
  id: string;
  itemId: ItemId;
  itemType: 'file' | 'folder';
  ownerId: User['uuid'];
  sharedWith: User['uuid'];
  sharingKeyId: SharingKeyAttributes['id'];

  constructor(attributes: SharingAttributes) {
    this.id = attributes.id;
    this.itemId = attributes.itemId;
    this.itemType = attributes.itemType;
    this.ownerId = attributes.ownerId;
    this.sharedWith = attributes.sharedWith;
    this.sharingKeyId = attributes.sharingKeyId;
  }

  static build(sharing: SharingAttributes): Sharing {
    return new Sharing(sharing);
  }

  toJSON(): SharingAttributes {
    return {
      id: this.id,
      itemId: this.itemId,
      itemType: this.itemType,
      ownerId: this.ownerId,
      sharedWith: this.sharedWith,
      sharingKeyId: this.sharingKeyId,
    };
  }
}

export class SharingRole implements SharingRoleAttributes {
  id: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(attributes: SharingRoleAttributes) {
    this.id = attributes.id;
    this.role = attributes.role;
    this.createdAt = attributes.createdAt;
    this.updatedAt = attributes.updatedAt;
  }

  static build(privateSharingRole: SharingRoleAttributes): SharingRole {
    return new SharingRole(privateSharingRole);
  }

  toJSON(): SharingRoleAttributes {
    return {
      id: this.id,
      role: this.role,
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

  constructor(attributes: SharingInviteAttributes) {
    this.id = attributes.id;
    this.itemId = attributes.itemId;
    this.itemType = attributes.itemType;
    this.sharedWith = attributes.sharedWith;
    this.encryptionKey = attributes.encryptionKey;
    this.encryptionAlgorithm = attributes.encryptionAlgorithm;
    this.type = attributes.type;
  }

  static build(sharingInvite: SharingInviteAttributes): SharingInvite {
    return new SharingInvite(sharingInvite);
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
    };
  }
}
