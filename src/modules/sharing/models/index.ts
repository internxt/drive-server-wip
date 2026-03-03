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
  declare id: string;

  @Column(DataType.STRING)
  declare name: string;

  @HasMany(() => SharingRolesModel, 'roleId')
  declare role: SharingRolesModel;

  @Column(DataType.DATE)
  declare createdAt: Date;

  @Column(DataType.DATE)
  declare updatedAt: Date;
}

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'permissions',
})
export class PermissionModel extends Model implements PermissionAttributes {
  @PrimaryKey
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4 })
  declare id: string;

  @ForeignKey(() => RoleModel)
  @Column({ type: DataType.UUID })
  declare roleId: string;

  @BelongsTo(() => RoleModel, {
    foreignKey: 'roleId',
    targetKey: 'id',
  })
  declare role: RoleModel;

  @Column(DataType.ENUM(...Object.values(SharingActionName)))
  declare name: SharingActionName;

  @Column(DataType.DATE)
  declare createdAt: Date;

  @Column(DataType.DATE)
  declare updatedAt: Date;
}

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'sharings',
})
export class SharingModel extends Model implements SharingAttributes {
  @PrimaryKey
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4 })
  declare id: string;

  @Column(DataType.UUIDV4)
  declare itemId: SharingAttributes['itemId'];

  @BelongsTo(() => FolderModel, {
    foreignKey: 'itemId',
    targetKey: 'uuid',
  })
  declare folder: FolderModel;

  @BelongsTo(() => FileModel, {
    foreignKey: 'itemId',
    targetKey: 'uuid',
  })
  declare file: FileModel;

  @Column(DataType.STRING)
  declare itemType: SharingAttributes['itemType'];

  @ForeignKey(() => UserModel)
  @Column(DataType.UUIDV4)
  declare ownerId: SharingAttributes['ownerId'];

  @BelongsTo(() => UserModel, {
    foreignKey: 'owner_id',
    targetKey: 'uuid',
    as: 'owner',
  })
  declare owner: UserModel;

  @Column(DataType.UUIDV4)
  declare sharedWith: SharingAttributes['sharedWith'];

  @BelongsTo(() => UserModel, {
    foreignKey: 'shared_with',
    targetKey: 'uuid',
    as: 'invited',
  })
  declare sharedWithUser: UserModel;

  @BelongsTo(() => WorkspaceTeamModel, {
    foreignKey: 'shared_with',
    targetKey: 'id',
    as: 'sharedWithTeam',
  })
  declare sharedWithTeam: WorkspaceTeamModel;

  @AllowNull(false)
  @Default(SharedWithType.Individual)
  @Column(DataType.ENUM(...Object.values(SharedWithType)))
  declare sharedWithType: SharedWithType;

  @Column({ type: DataType.STRING, allowNull: true, defaultValue: null })
  declare encryptedCode: SharingAttributes['encryptedCode'];

  @Column(DataType.STRING)
  declare encryptionAlgorithm: SharingAttributes['encryptionAlgorithm'];

  @Column(DataType.STRING)
  declare encryptionKey: SharingAttributes['encryptionKey'];

  @Column({ type: DataType.STRING, allowNull: true, defaultValue: null })
  declare encryptedPassword: SharingAttributes['encryptedPassword'];

  @AllowNull(false)
  @Column(DataType.ENUM('public', 'private'))
  declare type: SharingAttributes['type'];

  @HasOne(() => SharingRolesModel, {
    foreignKey: 'sharingId',
    sourceKey: 'id',
  })
  declare role: RoleModel;

  @Column(DataType.DATE)
  declare createdAt: Date;

  @Column(DataType.DATE)
  declare updatedAt: Date;
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
  declare id: string;

  @Column(DataType.UUIDV4)
  declare itemId: SharingInviteAttributes['itemId'];

  @Column(DataType.STRING)
  declare itemType: SharingInviteAttributes['itemType'];

  @ForeignKey(() => UserModel)
  @Column(DataType.UUIDV4)
  declare sharedWith: SharingInviteAttributes['sharedWith'];

  @BelongsTo(() => UserModel, {
    foreignKey: 'sharedWith',
    targetKey: 'uuid',
    as: 'invited',
  })
  declare sharedWithUser: UserModel;

  @BelongsTo(() => PreCreatedUserModel, {
    foreignKey: 'sharedWith',
    targetKey: 'uuid',
    as: 'preCreatedUser',
  })
  declare sharedWithPreCreatedUser: PreCreatedUserModel;

  @BelongsTo(() => FileModel, {
    foreignKey: 'itemId',
    targetKey: 'uuid',
    constraints: false,
    as: 'file',
  })
  declare file: FileModel;

  @BelongsTo(() => FolderModel, {
    foreignKey: 'itemId',
    targetKey: 'uuid',
    constraints: false,
    as: 'folder',
  })
  declare folder: FolderModel;

  @Column(DataType.STRING)
  declare encryptionKey: SharingInviteAttributes['encryptionKey'];

  @Column(DataType.STRING)
  declare encryptionAlgorithm: SharingInviteAttributes['encryptionAlgorithm'];

  @Column(DataType.STRING)
  declare type: SharingInviteAttributes['type'];

  @ForeignKey(() => RoleModel)
  @Column(DataType.UUIDV4)
  declare roleId: SharingInviteAttributes['roleId'];

  @Column(DataType.DATE)
  declare createdAt: Date;

  @AllowNull
  @Column(DataType.DATE)
  declare expirationAt?: Date;

  @Column(DataType.DATE)
  declare updatedAt: Date;
}
