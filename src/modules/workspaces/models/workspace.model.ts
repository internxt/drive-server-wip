import {
  Model,
  Table,
  Column,
  DataType,
  PrimaryKey,
  ForeignKey,
  BelongsTo,
  HasMany,
  AllowNull,
  HasOne,
} from 'sequelize-typescript';
import { UserModel } from '../../user/user.model';
import { WorkspaceUserModel } from './workspace-users.model';
import { type WorkspaceAttributes } from '../attributes/workspace.attributes';
import { WorkspaceTeamModel } from './workspace-team.model';
import { FolderModel } from '../../folder/folder.model';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'workspaces',
})
export class WorkspaceModel extends Model implements WorkspaceAttributes {
  @PrimaryKey
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4 })
  declare id: string;

  @ForeignKey(() => UserModel)
  @Column(DataType.UUID)
  declare ownerId: string;

  @BelongsTo(() => UserModel, {
    foreignKey: 'ownerId',
    targetKey: 'uuid',
    as: 'owner',
  })
  declare owner: UserModel;

  @Column(DataType.STRING)
  declare address: string;

  @Column(DataType.STRING)
  declare name: string;

  @Column(DataType.STRING)
  declare description: string;

  @Column(DataType.BOOLEAN)
  declare setupCompleted: boolean;

  @AllowNull
  @Column(DataType.STRING)
  declare avatar: string;

  @ForeignKey(() => WorkspaceTeamModel)
  @Column(DataType.UUID)
  declare defaultTeamId: string;

  @ForeignKey(() => FolderModel)
  @Column(DataType.UUID)
  declare rootFolderId?: string;

  @Column(DataType.INTEGER)
  declare numberOfSeats: number;

  @Column(DataType.STRING)
  declare phoneNumber: string;

  @HasOne(() => FolderModel, 'uuid')
  declare rootFolder: FolderModel;

  @BelongsTo(() => WorkspaceTeamModel, {
    foreignKey: 'defaultTeamId',
    targetKey: 'id',
    as: 'defaultTeam',
  })
  declare defaultTeam: WorkspaceTeamModel;

  @ForeignKey(() => UserModel)
  @Column(DataType.UUID)
  declare workspaceUserId: string;

  @BelongsTo(() => UserModel, {
    foreignKey: 'workspaceUserId',
    targetKey: 'uuid',
    as: 'workpaceUser',
  })
  declare workpaceUser: UserModel;

  @HasMany(() => WorkspaceUserModel)
  declare workspaceUsers: WorkspaceUserModel[];

  @Column(DataType.DATE)
  declare createdAt: Date;

  @Column(DataType.DATE)
  declare updatedAt: Date;
}
