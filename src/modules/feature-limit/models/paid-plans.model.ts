import {
  Column,
  Model,
  Table,
  PrimaryKey,
  DataType,
  AllowNull,
  AutoIncrement,
  ForeignKey,
  BelongsTo,
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
  declare id: number;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare planId: string;

  @ForeignKey(() => TierModel)
  @AllowNull(false)
  @Column(DataType.UUIDV4)
  declare tierId: string;

  @BelongsTo(() => TierModel, {
    foreignKey: 'tier_id',
    targetKey: 'id',
    as: 'tier',
  })
  declare tier: TierModel;

  @Column(DataType.DATE)
  declare createdAt: Date;
}
