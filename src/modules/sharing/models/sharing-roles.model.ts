import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { type SharingRoleAttributes } from '../sharing.domain';
import { SharingModel, RoleModel } from '.';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'sharing_roles',
})
export class SharingRolesModel extends Model implements SharingRoleAttributes {
  @PrimaryKey
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4 })
  id: SharingRoleAttributes['id'];

  @ForeignKey(() => SharingModel)
  @Column(DataType.UUIDV4)
  sharingId: SharingRoleAttributes['sharingId'];

  @BelongsTo(() => SharingModel, {
    foreignKey: 'sharing_id',
    targetKey: 'id',
    as: 'sharing',
  })
  sharing: SharingModel;

  @ForeignKey(() => RoleModel)
  @Column(DataType.UUIDV4)
  roleId: SharingRoleAttributes['roleId'];

  @BelongsTo(() => RoleModel)
  role: RoleModel;

  @Column
  createdAt: Date;

  @Column
  updatedAt: Date;
}
