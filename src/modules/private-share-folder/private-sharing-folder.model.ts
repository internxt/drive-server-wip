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

  @ForeignKey(() => FolderModel)
  @Column({ type: DataType.INTEGER, field: 'folder_id' })
  folderId: number;

  @BelongsTo(() => FolderModel, 'folderId')
  folder: FolderModel;

  @ForeignKey(() => FolderModel)
  @Column({ type: DataType.UUIDV4, field: 'folder_uuid' })
  folderUuid: string;

  @ForeignKey(() => UserModel)
  @Column({ type: DataType.INTEGER, field: 'owner_id' })
  ownerId: number;

  @BelongsTo(() => UserModel, 'ownerId')
  owner: UserModel;

  @ForeignKey(() => UserModel)
  @Column({ type: DataType.UUIDV4, field: 'owner_uuid' })
  ownerUuid: string;

  @ForeignKey(() => UserModel)
  @Column({ type: DataType.INTEGER, field: 'shared_with_id' })
  sharedWithId: number;

  @BelongsTo(() => UserModel, 'sharedWithId')
  sharedWith: UserModel;

  @ForeignKey(() => UserModel)
  @Column({ type: DataType.UUIDV4, field: 'shared_with_uuid' })
  sharedWithUuid: string;

  @Column
  encryptedKey: string;
}
