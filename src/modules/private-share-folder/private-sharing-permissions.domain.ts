export interface PrivateSharingPermissionAttributes {
  id: string;
  roleId: string;
  type: string;
}

export class PrivateSharingPermission
  implements PrivateSharingPermissionAttributes
{
  id: string;
  roleId: string;
  type: string;

  constructor(attributes: PrivateSharingPermissionAttributes) {
    this.id = attributes.id;
    this.roleId = attributes.roleId;
    this.type = attributes.type;
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
    };
  }
}
