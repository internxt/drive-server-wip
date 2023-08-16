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

  @BelongsTo(() => UserModel, { foreignKey: 'user_id', targetKey: 'uuid' })
  user: UserModel;

  @ForeignKey(() => UserModel)
  @Column({ type: DataType.UUIDV4 })
  userId: string;

  @BelongsTo(() => FolderModel, {
    foreignKey: 'folder_id',
    targetKey: 'uuid',
  })
  folder: FolderModel;

  @ForeignKey(() => FolderModel)
  @Column({ type: DataType.UUIDV4 })
  folderId: string;

  @BelongsTo(() => PrivateSharingRoleModel, {
    foreignKey: 'role_id',
    targetKey: 'id',
  })
  role: PrivateSharingRoleModel;

  @ForeignKey(() => PrivateSharingRoleModel)
  @Column({ type: DataType.UUIDV4 })
  roleId: string;

  @Column
  createdAt: Date;

  @Column
  updatedAt: Date;
}
