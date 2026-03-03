import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { UserModel } from '../user/user.model';

enum PlanTypes {
  subscription = 'subscription',
  oneTime = 'one_time',
}

interface PlanAttributes {
  id: number;
  userId: number;
  name: string;
  type: PlanTypes;
  createdAt: Date;
  updatedAt: Date;
  limit: number;
}

@Table({ tableName: 'plans', underscored: true, timestamps: true })
export class PlanModel extends Model<PlanModel> implements PlanAttributes {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  @ForeignKey(() => UserModel)
  @Column({
    type: DataType.INTEGER,
  })
  declare userId: number;

  @Column({
    type: DataType.STRING,
  })
  declare name: string;

  @Column({
    type: DataType.STRING,
  })
  declare type: PlanTypes;

  @Column({
    type: DataType.DATE,
  })
  declare createdAt: Date;

  @Column({
    type: DataType.DATE,
  })
  declare updatedAt: Date;

  @Column({
    type: DataType.BIGINT.UNSIGNED,
    allowNull: false,
    defaultValue: 0,
  })
  declare limit: number;

  @BelongsTo(() => UserModel)
  declare user: UserModel;
}
