import { FolderModel } from './../../folder/folder.model';
import { FileModel } from './../../file/file.model';
import {
  Model,
  Table,
  Column,
  DataType,
  PrimaryKey,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { UserModel } from '../../user/user.model';
import { type WorkspaceLogAttributes } from '../attributes/workspace-logs.attributes';
import { WorkspaceModel } from './workspace.model';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'workspace_logs',
})
export class WorkspaceLogModel extends Model {
  @PrimaryKey
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4 })
  id: string;

  @ForeignKey(() => WorkspaceModel)
  @Column({ type: DataType.UUID, allowNull: false })
  workspaceId: string;

  @BelongsTo(() => WorkspaceModel, {
    foreignKey: 'workspaceId',
    targetKey: 'id',
    as: 'workspace',
  })
  workspace: WorkspaceModel;

  @ForeignKey(() => UserModel)
  @Column({ type: DataType.UUID, allowNull: false })
  creator: string;

  @BelongsTo(() => UserModel, {
    foreignKey: 'creator',
    targetKey: 'uuid',
    as: 'user',
  })
  user: UserModel;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  type: WorkspaceLogAttributes['type'];

  @Column(DataType.STRING)
  platform: string;

  @Column(DataType.STRING)
  entityId: string;

  @BelongsTo(() => FileModel, {
    foreignKey: 'entity_id',
    targetKey: 'uuid',
    as: 'file',
  })
  file?: FileModel;

  @BelongsTo(() => FolderModel, {
    foreignKey: 'entity_id',
    targetKey: 'uuid',
    as: 'folder',
  })
  folder?: FolderModel;

  @Column
  createdAt: Date;

  @Column
  updatedAt: Date;
}
