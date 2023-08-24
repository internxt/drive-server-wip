import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  NotNull,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import {
  PermissionAttributes,
  RoleAttributes,
  SharingAttributes,
  SharingInviteAttributes,
  SharingKeyAttributes,
  SharingRoleAttributes,
} from '../sharing.domain';
import { UserModel } from '../../user/user.model';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'permissions',
})
export class PermissionModel extends Model implements PermissionAttributes {
  @PrimaryKey
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4 })
  id: string;

  @ForeignKey(() => RoleModel)
  @Column({ type: DataType.UUID })
  roleId: string;

  @Column
  @NotNull
  name: string;

  @Column
  createdAt: Date;

  @Column
  updatedAt: Date;
}

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'roles',
})
export class RoleModel extends Model implements RoleAttributes {
  @PrimaryKey
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4 })
  id: string;

  @Column
  @NotNull
  name: string;

  @Column
  createdAt: Date;

  @Column
  updatedAt: Date;
}

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'sharing_roles',
})
export class SharingRolesModel extends Model implements SharingRoleAttributes {
  @PrimaryKey
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4 })
  id: SharingRoleAttributes['id'];

  @ForeignKey(() => SharingModel)
  @Column
  sharingId: SharingRoleAttributes['sharingId'];

  @ForeignKey(() => RoleModel)
  @Column
  roleId: SharingRoleAttributes['roleId'];

  @BelongsTo(() => RoleModel)
  role: RoleModel;

  @Column
  createdAt: Date;

  @Column
  updatedAt: Date;
}

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'sharings',
})
export class SharingModel extends Model implements SharingAttributes {
  @PrimaryKey
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4 })
  id: string;

  @Column
  itemId: SharingAttributes['itemId'];

  @Column
  itemType: SharingAttributes['itemType'];

  @ForeignKey(() => UserModel)
  @Column
  ownerId: SharingAttributes['ownerId'];

  @ForeignKey(() => UserModel)
  @Column
  sharedWith: SharingAttributes['sharedWith'];

  @ForeignKey(() => SharingKeyModel)
  @Column
  sharingKeyId: SharingAttributes['sharingKeyId'];

  @Column
  createdAt: Date;

  @Column
  updatedAt: Date;
}

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'sharing_keys',
})
export class SharingKeyModel extends Model implements SharingKeyAttributes {
  @PrimaryKey
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4 })
  id: SharingAttributes['id'];

  @Column
  key: SharingKeyAttributes['key'];

  @Column
  createdAt: Date;

  @Column
  updatedAt: Date;
}

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'sharing_invites',
})
export class SharingInviteModel
  extends Model
  implements SharingInviteAttributes
{
  @PrimaryKey
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4 })
  id: string;

  @Column
  itemId: SharingInviteAttributes['itemId'];

  @Column
  itemType: SharingInviteAttributes['itemType'];

  @ForeignKey(() => UserModel)
  @Column
  sharedWith: SharingInviteAttributes['sharedWith'];

  @Column
  encryptionKey: SharingInviteAttributes['encryptionKey'];

  @Column
  encryptionAlgorithm: SharingInviteAttributes['encryptionAlgorithm'];

  @Column
  type: SharingInviteAttributes['type'];

  @Column
  createdAt: Date;

  @Column
  updatedAt: Date;
}
