export interface PrivateSharingRoleAttributes {
  id: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

export class PrivateSharingRole implements PrivateSharingRoleAttributes {
  id: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(attributes: PrivateSharingRoleAttributes) {
    this.id = attributes.id;
    this.role = attributes.role;
    this.createdAt = attributes.createdAt;
    this.updatedAt = attributes.updatedAt;
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
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
