import {
  Column,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { PrivateSharingPermissionAttributes } from './private-sharing-permissions.domain';
import { PrivateSharingRoleModel } from './private-sharing-role.model';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'permissions',
})
export class PrivateSharingPermissionModel
  extends Model
  implements PrivateSharingPermissionAttributes
{
  @PrimaryKey
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4 })
  id: string;

  @ForeignKey(() => PrivateSharingRoleModel)
  @Column({ type: DataType.UUID, field: 'role_id' })
  roleId: string;

  @Column
  type: string;

  @Column({ field: 'created_at' })
  createdAt: Date;

  @Column({ field: 'updated_at' })
  updatedAt: Date;
}
