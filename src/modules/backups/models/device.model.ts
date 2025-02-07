import {
  Model,
  Table,
  Column,
  DataType,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  ForeignKey,
  BelongsTo,
  Index,
} from 'sequelize-typescript';
import { UserModel } from '../../user/user.model';

@Table({
  timestamps: true,
  tableName: 'devices',
})
export class DeviceModel extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Index
  @Column(DataType.STRING)
  mac: string;

  @ForeignKey(() => UserModel)
  @Column
  userId: number;

  @AllowNull
  @Column(DataType.STRING)
  name: string;

  @AllowNull
  @Column(DataType.STRING(20))
  platform: string;

  @AllowNull
  @Column(DataType.DATE)
  createdAt: Date;

  @AllowNull
  @Column(DataType.DATE)
  updatedAt: Date;

  @BelongsTo(() => UserModel)
  user: UserModel;
}
