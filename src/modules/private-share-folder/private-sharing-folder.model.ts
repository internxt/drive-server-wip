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
import { PrivateSharingFolderAttributes } from './private-sharing-folder.domain';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'private_sharing_folder',
})
export class PrivateSharingFolderModel
  extends Model
  implements PrivateSharingFolderAttributes
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

  @BelongsTo(() => UserModel, { foreignKey: 'owner_id', targetKey: 'uuid' })
  owner: UserModel;

  @ForeignKey(() => UserModel)
  @Column({ type: DataType.UUIDV4 })
  ownerId: string;

  @BelongsTo(() => UserModel, { foreignKey: 'shared_with', targetKey: 'uuid' })
  sharedWithUser: UserModel;

  @ForeignKey(() => UserModel)
  @Column({ type: DataType.UUIDV4 })
  sharedWith: string;

  @Column({ type: DataType.STRING })
  encryptionKey: string;
}
