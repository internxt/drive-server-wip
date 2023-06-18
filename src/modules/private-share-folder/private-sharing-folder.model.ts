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
  @Column(DataType.INTEGER)
  folderId: number;

  @BelongsTo(() => FolderModel)
  folder: FolderModel;

  @ForeignKey(() => FolderModel)
  @Column(DataType.UUIDV4)
  folderUuid: string;

  @ForeignKey(() => UserModel)
  @Column(DataType.INTEGER)
  ownerId: number;

  @BelongsTo(() => UserModel)
  owner: UserModel;

  @ForeignKey(() => UserModel)
  @Column(DataType.UUIDV4)
  ownerUuid: string;

  @ForeignKey(() => UserModel)
  @Column(DataType.INTEGER)
  sharedWithId: number;

  @BelongsTo(() => UserModel)
  sharedWith: UserModel;

  @ForeignKey(() => UserModel)
  @Column(DataType.UUIDV4)
  sharedWithUuid: string;

  @Column
  encryptedKey: string;
}
