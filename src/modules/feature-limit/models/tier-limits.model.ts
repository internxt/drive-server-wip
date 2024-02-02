import {
  Column,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { TierModel } from './tier.model';
import { Limitmodel } from './limit.model';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'tiers_limits',
})
export class TierLimitsModel extends Model {
  @PrimaryKey
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4 })
  id: string;

  @ForeignKey(() => TierModel)
  @Column(DataType.UUIDV4)
  tierId: string;

  @ForeignKey(() => Limitmodel)
  @Column(DataType.UUIDV4)
  limitId: string;

  @Column
  createdAt: Date;

  @Column
  updatedAt: Date;
}
