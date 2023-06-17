import { Column, DataType, PrimaryKey, Table } from 'sequelize-typescript';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'roles',
})
export class RoleModel {
  @PrimaryKey
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4 })
  id: string;

  @Column
  role: string;
}
