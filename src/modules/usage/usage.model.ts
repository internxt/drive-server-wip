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
  declare id: string;

  @ForeignKey(() => UserModel)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare userId: string;

  @Default(0)
  @AllowNull(false)
  @Column(DataType.BIGINT)
  declare delta: number;

  @AllowNull(false)
  @Column(DataType.DATEONLY)
  declare period: Date;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare type: string;

  @AllowNull(false)
  @Default(DataType.NOW)
  @Column(DataType.DATE)
  declare createdAt: Date;

  @AllowNull(false)
  @Default(DataType.NOW)
  @Column(DataType.DATE)
  declare updatedAt: Date;

  @BelongsTo(() => UserModel)
  declare user: UserModel;
}
