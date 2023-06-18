import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { PrivateSharingFolderRolesAttributes } from './private-sharing-folder-roles.domain';
import { UserModel } from '../user/user.model';
import { FolderModel } from '../folder/folder.model';
import { PrivateSharingRoleModel } from './private-sharing-role.model';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'private_sharing_folder_roles',
})
export class PrivateSharingFolderRolesModel
  extends Model
  implements PrivateSharingFolderRolesAttributes
{
  @PrimaryKey
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4 })
  id: string;

  @ForeignKey(() => UserModel)
  @Column(DataType.INTEGER)
  userId: number;

  @BelongsTo(() => UserModel)
  user: UserModel;

  @ForeignKey(() => UserModel)
  @Column(DataType.UUIDV4)
  userUuid: string;

  @ForeignKey(() => FolderModel)
  @Column(DataType.INTEGER)
  folderId: number;

  @BelongsTo(() => FolderModel)
  folder: FolderModel;

  @ForeignKey(() => FolderModel)
  @Column(DataType.UUIDV4)
  folderUuid: string;

  @ForeignKey(() => PrivateSharingRoleModel)
  @Column({ type: DataType.UUID })
  roleId: string;

  @Column
  createdAt: Date;

  @Column
  updatedAt: Date;
}
