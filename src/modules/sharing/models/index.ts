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
  SharingRoleAttributes,
} from '../sharing.domain';
import { UserModel } from '../../user/user.model';
import { FolderModel } from 'src/modules/folder/folder.model';

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
  name: string;

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

  @Column(DataType.UUIDV4)
  itemId: SharingAttributes['itemId'];

  @BelongsTo(() => FolderModel, {
    foreignKey: 'itemId',
    targetKey: 'uuid',
  })
  folder: FolderModel;

  @Column(DataType.STRING)
  itemType: SharingAttributes['itemType'];

  @ForeignKey(() => UserModel)
  @Column(DataType.UUIDV4)
  ownerId: SharingAttributes['ownerId'];

  @BelongsTo(() => UserModel, {
    foreignKey: 'owner_id',
    targetKey: 'uuid',
    as: 'owner',
  })
  owner: UserModel;

  @ForeignKey(() => UserModel)
  @Column(DataType.UUIDV4)
  sharedWith: SharingAttributes['sharedWith'];

  @BelongsTo(() => UserModel, {
    foreignKey: 'shared_with',
    targetKey: 'uuid',
    as: 'invited',
  })
  sharedWithUser: UserModel;

  @Column(DataType.STRING)
  encryptionAlgorithm: SharingAttributes['encryptionAlgorithm'];

  @Column(DataType.STRING)
  encryptionKey: SharingAttributes['encryptionKey'];

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

  @Column(DataType.UUIDV4)
  itemId: SharingInviteAttributes['itemId'];

  @Column(DataType.STRING)
  itemType: SharingInviteAttributes['itemType'];

  @ForeignKey(() => UserModel)
  @Column(DataType.UUIDV4)
  sharedWith: SharingInviteAttributes['sharedWith'];

  @Column(DataType.STRING)
  encryptionKey: SharingInviteAttributes['encryptionKey'];

  @Column(DataType.STRING)
  encryptionAlgorithm: SharingInviteAttributes['encryptionAlgorithm'];

  @Column(DataType.STRING)
  type: SharingInviteAttributes['type'];

  @ForeignKey(() => RoleModel)
  @Column(DataType.UUIDV4)
  roleId: SharingInviteAttributes['roleId'];

  @Column
  createdAt: Date;

  @Column
  updatedAt: Date;
}