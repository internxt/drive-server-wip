export interface PrivateSharingPermissionAttributes {
  id: string;
  roleId: string;
  type: string;
  createdAt: Date;
  updatedAt: Date;
}

export class PrivateSharingPermission
  implements PrivateSharingPermissionAttributes
{
  id: string;
  roleId: string;
  type: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(attributes: PrivateSharingPermissionAttributes) {
    this.id = attributes.id;
    this.roleId = attributes.roleId;
    this.type = attributes.type;
    this.createdAt = attributes.createdAt;
    this.updatedAt = attributes.updatedAt;
  }

  static build(
    privateSharingPermission: PrivateSharingPermissionAttributes,
  ): PrivateSharingPermission {
    return new PrivateSharingPermission(privateSharingPermission);
  }

  toJSON(): PrivateSharingPermissionAttributes {
    return {
      id: this.id,
      roleId: this.roleId,
      type: this.type,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
