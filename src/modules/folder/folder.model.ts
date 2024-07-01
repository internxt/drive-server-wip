import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  DataType,
  Default,
  ForeignKey,
  HasMany,
  HasOne,
  Index,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { UserModel } from '../user/user.model';
import { FolderAttributes } from './folder.attributes';
import { SharingModel } from '../sharing/models';
import { Sharing } from '../sharing/sharing.domain';
import { WorkspaceItemUserModel } from '../workspaces/models/workspace-items-users.model';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'folders',
})
export class FolderModel extends Model implements FolderAttributes {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Index
  @Column
  uuid: string;

  @ForeignKey(() => FolderModel)
  @Column
  parentId: number;

  @BelongsTo(() => FolderModel)
  parent: FolderModel;

  @ForeignKey(() => FolderModel)
  @Column(DataType.UUIDV4)
  parentUuid: FolderAttributes['uuid'];

  @Index
  @Column
  name: string;

  @Column(DataType.STRING(24))
  bucket: string;

  @ForeignKey(() => UserModel)
  @Column
  userId: number;

  @BelongsTo(() => UserModel)
  user: UserModel;

  @Column
  encryptVersion: '03-aes';

  @Index
  @Column
  plainName: string;

  @Default(false)
  @Column
  deleted: boolean;

  @Default(false)
  @Column
  removed: boolean;

  @AllowNull
  @Column
  deletedAt: Date;

  @Column
  createdAt: Date;

  @Column
  updatedAt: Date;

  @Column
  removedAt: Date;

  @HasMany(() => SharingModel, { sourceKey: 'uuid', foreignKey: 'itemId' })
  sharings: Sharing[];

  @HasOne(() => WorkspaceItemUserModel, {
    foreignKey: 'itemId',
    sourceKey: 'uuid',
  })
  workspaceUser: WorkspaceItemUserModel;
}
