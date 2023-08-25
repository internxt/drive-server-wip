import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { FolderModel } from '../folder/folder.model';
import { UserModel } from '../user/user.model';
import { PrivateSharingFolderInviteAttributes } from './private-sharing-folder-invite.domain';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'private_sharing_folder_invite',
})
export class PrivateSharingFolderModel
  extends Model
  implements PrivateSharingFolderInviteAttributes
{
  @PrimaryKey
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4 })
  id: string;

  @BelongsTo(() => FolderModel, {
    foreignKey: 'folderId',
    targetKey: 'uuid',
  })
  folder: FolderModel;

  @ForeignKey(() => FolderModel)
  @Column({ type: DataType.UUIDV4 })
  folderId: string;

  @BelongsTo(() => UserModel, {
    foreignKey: 'owner_id',
    targetKey: 'uuid',
    as: 'owner',
  })
  owner: UserModel;

  @ForeignKey(() => UserModel)
  @Column({ type: DataType.UUIDV4 })
  ownerId: string;

  @BelongsTo(() => UserModel, {
    foreignKey: 'shared_with',
    targetKey: 'uuid',
    as: 'invited',
  })
  sharedWithUser: UserModel;

  @ForeignKey(() => UserModel)
  @Column({ type: DataType.UUIDV4 })
  sharedWith: string;

  @Column({ type: DataType.STRING })
  encryptionKey: string;

  @Column
  createdAt: Date;

  @Column
  updatedAt: Date;
}
