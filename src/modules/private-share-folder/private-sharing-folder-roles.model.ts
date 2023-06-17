import {
  Column,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { PrivateSharingFolderRolesAttributes } from './private-share-role.domain';
import { UserModel } from '../user/user.model';
import { FolderModel } from '../folder/folder.model';

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
  @Column({ type: DataType.UUID })
  userId: string;

  @ForeignKey(() => FolderModel)
  @Column({ type: DataType.UUID })
  folderId: string;

  @ForeignKey(() => RoleModel)
  @Column({ type: DataType.UUID })
  roleId: string;

  @Column
  createdAt: Date;

  @Column
  updatedAt: Date;
}
