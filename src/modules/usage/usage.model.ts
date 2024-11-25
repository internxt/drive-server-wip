import {
  Column,
  Model,
  Table,
  PrimaryKey,
  DataType,
  Default,
  AllowNull,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { UserModel } from '../user/user.model';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'usages',
})
export class UsageModel extends Model {
  @PrimaryKey
  @Column(DataType.UUID)
  id: string;

  @ForeignKey(() => UserModel)
  @AllowNull(false)
  @Column(DataType.UUID)
  userId: string;

  @Default(0)
  @AllowNull(false)
  @Column(DataType.BIGINT)
  delta: number;

  @AllowNull(false)
  @Column(DataType.DATEONLY)
  period: Date;

  @AllowNull(false)
  @Column(DataType.STRING)
  type: string;

  @AllowNull(false)
  @Default(DataType.NOW)
  @Column(DataType.DATE)
  createdAt: Date;

  @AllowNull(false)
  @Default(DataType.NOW)
  @Column(DataType.DATE)
  updatedAt: Date;

  @BelongsTo(() => UserModel)
  user: UserModel;
}
