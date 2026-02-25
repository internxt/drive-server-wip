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
  id: string;

  @ForeignKey(() => UserModel)
  @Column(DataType.UUID)
  ownerId: string;

  @BelongsTo(() => UserModel, {
    foreignKey: 'ownerId',
    targetKey: 'uuid',
    as: 'owner',
  })
  owner: UserModel;

  @Column(DataType.STRING)
  address: string;

  @Column(DataType.STRING)
  name: string;

  @Column(DataType.STRING)
  description: string;

  @Column(DataType.BOOLEAN)
  setupCompleted: boolean;

  @AllowNull
  @Column(DataType.STRING)
  avatar: string;

  @ForeignKey(() => WorkspaceTeamModel)
  @Column(DataType.UUID)
  defaultTeamId: string;

  @ForeignKey(() => FolderModel)
  @Column(DataType.UUID)
  rootFolderId?: string;

  @Column(DataType.INTEGER)
  numberOfSeats: number;

  @Column(DataType.STRING)
  phoneNumber: string;

  @HasOne(() => FolderModel, 'uuid')
  rootFolder: FolderModel;

  @BelongsTo(() => WorkspaceTeamModel, {
    foreignKey: 'defaultTeamId',
    targetKey: 'id',
    as: 'defaultTeam',
  })
  defaultTeam: WorkspaceTeamModel;

  @ForeignKey(() => UserModel)
  @Column(DataType.UUID)
  workspaceUserId: string;

  @BelongsTo(() => UserModel, {
    foreignKey: 'workspaceUserId',
    targetKey: 'uuid',
    as: 'workpaceUser',
  })
  workpaceUser: UserModel;

  @HasMany(() => WorkspaceUserModel)
  workspaceUsers: WorkspaceUserModel[];

  @Column
  createdAt: Date;

  @Column
  updatedAt: Date;
}
