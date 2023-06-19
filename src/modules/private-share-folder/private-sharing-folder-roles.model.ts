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
  @Column({ type: DataType.INTEGER, field: 'user_id' })
  userId: number;

  @BelongsTo(() => UserModel)
  user: UserModel;

  @ForeignKey(() => UserModel)
  @Column({ type: DataType.UUIDV4, field: 'user_uuid' })
  userUuid: string;

  @ForeignKey(() => FolderModel)
  @Column({ type: DataType.INTEGER, field: 'folder_id' })
  folderId: number;

  @BelongsTo(() => FolderModel)
  folder: FolderModel;

  @ForeignKey(() => FolderModel)
  @Column({ type: DataType.UUIDV4, field: 'folder_uuid' })
  folderUuid: string;

  @ForeignKey(() => PrivateSharingRoleModel)
  @Column({ type: DataType.UUID, field: 'role_id' })
  roleId: string;

  @Column
  createdAt: Date;

  @Column
  updatedAt: Date;
}
