import { User } from '../user/user.domain';
import { Folder } from '../folder/folder.domain';
import { PrivateSharingRole as Role } from './private-sharing-role.domain';

export interface PrivateSharingFolderRolesAttributes {
  id: string;
  folderId: Folder['uuid'];
  userId: User['uuid'];
  roleId: Role['id'];
  createdAt: Date;
  updatedAt: Date;
}

export class PrivateSharingFolderRole
  implements PrivateSharingFolderRolesAttributes
{
  id: string;
  folderId: Folder['uuid'];
  userId: User['uuid'];
  roleId: Role['id'];
  createdAt: Date;
  updatedAt: Date;

  constructor(attributes: PrivateSharingFolderRolesAttributes) {
    this.id = attributes.id;
    this.folderId = attributes.folderId;
    this.userId = attributes.userId;
    this.roleId = attributes.roleId;
    this.createdAt = attributes.createdAt;
    this.updatedAt = attributes.updatedAt;
  }

  static build(
    privateSharingFolderRole: PrivateSharingFolderRolesAttributes,
  ): PrivateSharingFolderRole {
    return new PrivateSharingFolderRole(privateSharingFolderRole);
  }

  toJSON(): PrivateSharingFolderRolesAttributes {
    return {
      id: this.id,
      folderId: this.folderId,
      userId: this.userId,
      roleId: this.roleId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
