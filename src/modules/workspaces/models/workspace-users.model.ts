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
import { WorkspaceUserAttributes } from '../attributes/workspace-users.attributes';
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
  id: string;

  @ForeignKey(() => UserModel)
  @Column(DataType.UUID)
  memberId: string;

  @BelongsTo(() => UserModel, {
    foreignKey: 'memberId',
    targetKey: 'uuid',
    as: 'member',
  })
  member: UserModel;

  @ForeignKey(() => FolderModel)
  @Column(DataType.INTEGER)
  rootFolderId: number;

  @HasOne(() => FolderModel, 'id')
  rootFolder: FolderModel;

  @Column(DataType.STRING)
  key: string;

  @ForeignKey(() => WorkspaceModel)
  @Column(DataType.UUID)
  workspaceId: string;

  @BelongsTo(() => WorkspaceModel, {
    foreignKey: 'workspaceId',
    targetKey: 'id',
    as: 'workspace',
  })
  workspace: WorkspaceModel;

  @Column(DataType.BIGINT)
  spaceLimit: bigint;

  @Column(DataType.BIGINT)
  driveUsage: bigint;

  @Column(DataType.BIGINT)
  backupsUsage: bigint;

  @Column(DataType.BOOLEAN)
  deactivated: boolean;

  @Column
  createdAt: Date;

  @Column
  updatedAt: Date;
}
