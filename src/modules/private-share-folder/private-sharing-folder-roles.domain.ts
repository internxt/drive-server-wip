export interface PrivateSharingFolderRolesAttributes {
  id: string;
  folderId: number;
  folderUuid: string;
  userId: number;
  userUuid: string;
  roleId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class PrivateSharingFolderRole
  implements PrivateSharingFolderRolesAttributes
{
  id: string;
  folderId: number;
  folderUuid: string;
  userId: number;
  userUuid: string;
  roleId: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(attributes: PrivateSharingFolderRolesAttributes) {
    this.id = attributes.id;
    this.folderId = attributes.folderId;
    this.folderUuid = attributes.folderUuid;
    this.userId = attributes.userId;
    this.userUuid = attributes.userUuid;
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
      folderUuid: this.folderUuid,
      userId: this.userId,
      userUuid: this.userUuid,
      roleId: this.roleId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
