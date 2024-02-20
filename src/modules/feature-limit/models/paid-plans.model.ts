import {
  Column,
  Model,
  Table,
  PrimaryKey,
  DataType,
  AllowNull,
  AutoIncrement,
  ForeignKey,
} from 'sequelize-typescript';
import { TierModel } from './tier.model';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'paid_plans',
})
export class PaidPlansModel extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  planId: string;

  @ForeignKey(() => TierModel)
  @Column(DataType.UUIDV4)
  tierId: string;

  @Column
  createdAt: Date;
}
