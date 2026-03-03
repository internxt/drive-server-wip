import {
  BelongsTo,
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
  declare id: string;

  @ForeignKey(() => TierModel)
  @Column(DataType.UUIDV4)
  declare tierId: string;

  @ForeignKey(() => Limitmodel)
  @Column(DataType.UUIDV4)
  declare limitId: string;

  @BelongsTo(() => Limitmodel)
  declare limit: Limitmodel;

  @Column(DataType.DATE)
  declare createdAt: Date;

  @Column(DataType.DATE)
  declare updatedAt: Date;
}
