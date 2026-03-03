import {
  Model,
  Table,
  Column,
  DataType,
  PrimaryKey,
  ForeignKey,
  BelongsTo,
  HasOne,
} from 'sequelize-typescript';
import { UserModel } from '../../user/user.model';
import { WorkspaceModel } from './workspace.model';
import { type WorkspaceUserAttributes } from '../attributes/workspace-users.attributes';
import { FolderModel } from '../../folder/folder.model';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'workspace_users',
})
export class WorkspaceUserModel
  extends Model
  implements WorkspaceUserAttributes
{
  @PrimaryKey
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4 })
  declare id: string;

  @ForeignKey(() => UserModel)
  @Column(DataType.UUID)
  declare memberId: string;

  @BelongsTo(() => UserModel, {
    foreignKey: 'memberId',
    targetKey: 'uuid',
    as: 'member',
  })
  declare member: UserModel;

  @ForeignKey(() => FolderModel)
  @Column(DataType.UUID)
  declare rootFolderId?: string;

  @HasOne(() => FolderModel, 'uuid')
  declare rootFolder: FolderModel;

  @Column(DataType.STRING)
  declare key: string;

  @ForeignKey(() => WorkspaceModel)
  @Column(DataType.UUID)
  declare workspaceId: string;

  @BelongsTo(() => WorkspaceModel, {
    foreignKey: 'workspaceId',
    targetKey: 'id',
    as: 'workspace',
  })
  declare workspace: WorkspaceModel;

  @Column(DataType.BIGINT.UNSIGNED)
  declare spaceLimit: number;

  @Column(DataType.BIGINT.UNSIGNED)
  declare driveUsage: number;

  @Column(DataType.BIGINT.UNSIGNED)
  declare backupsUsage: number;

  @Column(DataType.BOOLEAN)
  declare deactivated: boolean;

  @Column(DataType.DATE)
  declare lastUsageSyncAt: Date;

  @Column(DataType.DATE)
  declare createdAt: Date;

  @Column(DataType.DATE)
  declare updatedAt: Date;
}
