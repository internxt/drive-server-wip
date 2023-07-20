import {
  Column,
  DataType,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { PrivateSharingRoleAttributes } from './private-sharing-role.domain';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'roles',
})
export class PrivateSharingRoleModel
  extends Model
  implements PrivateSharingRoleAttributes
{
  @PrimaryKey
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4 })
  id: string;

  @Column
  role: string;

  @Column
  createdAt: Date;

  @Column
  updatedAt: Date;
}
