import {
  AllowNull,
  BelongsTo,
  Column,
  DataType,
  Default,
  ForeignKey,
  HasMany,
  HasOne,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import {
  type PermissionAttributes,
  type RoleAttributes,
  SharedWithType,
  type SharingAttributes,
  type SharingInviteAttributes,
  SharingActionName,
} from '../sharing.domain';
import { UserModel } from '../../user/user.model';
import { FolderModel } from '../../folder/folder.model';
import { FileModel } from '../../../modules/file/file.model';
import { PreCreatedUserModel } from '../../../modules/user/pre-created-users.model';
import { WorkspaceTeamModel } from '../../workspaces/models/workspace-team.model';
import { SharingRolesModel } from './sharing-roles.model';

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

  @HasMany(() => SharingRolesModel, 'roleId')
  role: SharingRolesModel;

  @Column
  createdAt: Date;

  @Column
  updatedAt: Date;
}

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

  @BelongsTo(() => RoleModel, {
    foreignKey: 'roleId',
    targetKey: 'id',
  })
  role: RoleModel;

  @Column
  name: SharingActionName;

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

  @BelongsTo(() => FileModel, {
    foreignKey: 'itemId',
    targetKey: 'uuid',
  })
  file: FileModel;

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

  @Column(DataType.UUIDV4)
  sharedWith: SharingAttributes['sharedWith'];

  @BelongsTo(() => UserModel, {
    foreignKey: 'shared_with',
    targetKey: 'uuid',
    as: 'invited',
  })
  sharedWithUser: UserModel;

  @BelongsTo(() => WorkspaceTeamModel, {
    foreignKey: 'shared_with',
    targetKey: 'id',
    as: 'sharedWithTeam',
  })
  sharedWithTeam: WorkspaceTeamModel;

  @AllowNull(false)
  @Default(SharedWithType.Individual)
  @Column(
    DataType.ENUM(SharedWithType.Individual, SharedWithType.WorkspaceTeam),
  )
  sharedWithType: SharedWithType;

  @Column({ type: DataType.STRING, allowNull: true, defaultValue: null })
  encryptedCode: SharingAttributes['encryptedCode'];

  @Column(DataType.STRING)
  encryptionAlgorithm: SharingAttributes['encryptionAlgorithm'];

  @Column(DataType.STRING)
  encryptionKey: SharingAttributes['encryptionKey'];

  @Column({ type: DataType.STRING, allowNull: true, defaultValue: null })
  encryptedPassword: SharingAttributes['encryptedPassword'];

  @AllowNull(false)
  @Column(DataType.ENUM('public', 'private'))
  type: SharingAttributes['type'];

  @HasOne(() => SharingRolesModel, {
    foreignKey: 'sharingId',
    sourceKey: 'id',
  })
  role: RoleModel;

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

  @BelongsTo(() => UserModel, {
    foreignKey: 'sharedWith',
    targetKey: 'uuid',
    as: 'invited',
  })
  sharedWithUser: UserModel;

  @BelongsTo(() => PreCreatedUserModel, {
    foreignKey: 'sharedWith',
    targetKey: 'uuid',
    as: 'preCreatedUser',
  })
  sharedWithPreCreatedUser: PreCreatedUserModel;

  @BelongsTo(() => FileModel, {
    foreignKey: 'itemId',
    targetKey: 'uuid',
    constraints: false,
    as: 'file',
  })
  file: FileModel;

  @BelongsTo(() => FolderModel, {
    foreignKey: 'itemId',
    targetKey: 'uuid',
    constraints: false,
    as: 'folder',
  })
  folder: FolderModel;

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

  @AllowNull
  @Column
  expirationAt?: Date;

  @Column
  updatedAt: Date;
}
