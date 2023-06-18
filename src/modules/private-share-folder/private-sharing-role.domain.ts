export interface PrivateSharingRoleAttributes {
  id: string;
  role: string;
}

export class PrivateSharingRole implements PrivateSharingRoleAttributes {
  id: string;
  role: string;

  constructor(attributes: PrivateSharingRoleAttributes) {
    this.id = attributes.id;
    this.role = attributes.role;
  }

  static build(
    privateSharingRole: PrivateSharingRoleAttributes,
  ): PrivateSharingRole {
    return new PrivateSharingRole(privateSharingRole);
  }

  toJSON(): PrivateSharingRoleAttributes {
    return {
      id: this.id,
      role: this.role,
    };
  }
}
