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
  declare id: string;

  @ForeignKey(() => WorkspaceModel)
  @Column({ type: DataType.UUID, allowNull: false })
  declare workspaceId: string;

  @BelongsTo(() => WorkspaceModel, {
    foreignKey: 'workspaceId',
    targetKey: 'id',
    as: 'workspace',
  })
  declare workspace: WorkspaceModel;

  @ForeignKey(() => UserModel)
  @Column({ type: DataType.UUID, allowNull: false })
  declare creator: string;

  @BelongsTo(() => UserModel, {
    foreignKey: 'creator',
    targetKey: 'uuid',
    as: 'user',
  })
  declare user: UserModel;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare type: WorkspaceLogAttributes['type'];

  @Column(DataType.STRING)
  declare platform: string;

  @Column(DataType.STRING)
  declare entityId: string;

  @BelongsTo(() => FileModel, {
    foreignKey: 'entity_id',
    targetKey: 'uuid',
    as: 'file',
  })
  declare file?: FileModel;

  @BelongsTo(() => FolderModel, {
    foreignKey: 'entity_id',
    targetKey: 'uuid',
    as: 'folder',
  })
  declare folder?: FolderModel;

  @Column(DataType.DATE)
  declare createdAt: Date;

  @Column(DataType.DATE)
  declare updatedAt: Date;
}
