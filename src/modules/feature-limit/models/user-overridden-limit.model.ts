import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { UserModel } from '../../user/user.model';
import { Limitmodel } from './limit.model';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'user_overridden_limits',
})
export class UserOverriddenLimitModel extends Model {
  @PrimaryKey
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4 })
  id: string;

  @ForeignKey(() => UserModel)
  @Column(DataType.UUID)
  userId: string;

  @ForeignKey(() => Limitmodel)
  @Column(DataType.UUID)
  limitId: string;

  @BelongsTo(() => UserModel)
  user: UserModel;

  @BelongsTo(() => Limitmodel)
  limit: Limitmodel;

  @Column
  createdAt: Date;

  @Column
  updatedAt: Date;
}
