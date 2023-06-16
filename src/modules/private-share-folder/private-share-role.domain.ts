export interface PrivateShareFolderRolesAttributes {
  id: string;
  folderId: string;
  userId: string;
  roleId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class PrivateShareFolderRole
  implements PrivateShareFolderRolesAttributes
{
  id: string;
  folderId: string;
  userId: string;
  roleId: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(attributes: PrivateShareFolderRolesAttributes) {
    this.id = attributes.id;
    this.folderId = attributes.folderId;
    this.roleId = attributes.roleId;
    this.createdAt = attributes.createdAt;
    this.updatedAt = attributes.updatedAt;
  }

  static build(
    privateShareFolderRole: PrivateShareFolderRolesAttributes,
  ): PrivateShareFolderRole {
    return new PrivateShareFolderRole(privateShareFolderRole);
  }

  toJSON(): PrivateShareFolderRolesAttributes {
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
