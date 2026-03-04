import {
  Column,
  Model,
  Table,
  PrimaryKey,
  DataType,
  BelongsToMany,
  AllowNull,
} from 'sequelize-typescript';
import { LimitTypes, LimitLabels } from '../limits.enum';
import { TierModel } from './tier.model';
import { TierLimitsModel } from './tier-limits.model';
import { type LimitAttributes } from '../domain/limits.attributes';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'limits',
})
export class Limitmodel extends Model implements LimitAttributes {
  @PrimaryKey
  @Column(DataType.UUIDV4)
  id: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  label: LimitLabels;

  @AllowNull(false)
  @Column({
    type: DataType.ENUM,
    values: Object.values(LimitTypes),
  })
  type: LimitTypes;

  @AllowNull(false)
  @Column(DataType.STRING)
  value: string;

  @BelongsToMany(() => TierModel, {
    through: () => TierLimitsModel,
  })
  tiers: TierModel[];

  @Column
  createdAt: Date;

  @Column
  updatedAt: Date;
}
