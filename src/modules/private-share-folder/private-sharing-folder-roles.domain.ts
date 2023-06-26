export interface PrivateSharingFolderRolesAttributes {
  id: string;
  folderUuid: string;
  userUuid: string;
  roleId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class PrivateSharingFolderRole
  implements PrivateSharingFolderRolesAttributes
{
  id: string;
  folderUuid: string;
  userUuid: string;
  roleId: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(attributes: PrivateSharingFolderRolesAttributes) {
    this.id = attributes.id;
    this.folderUuid = attributes.folderUuid;
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
      folderUuid: this.folderUuid,
      userUuid: this.userUuid,
      roleId: this.roleId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
