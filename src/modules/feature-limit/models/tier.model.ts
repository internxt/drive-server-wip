import {
  Column,
  Model,
  Table,
  PrimaryKey,
  DataType,
  AllowNull,
  HasMany,
  BelongsToMany,
} from 'sequelize-typescript';
import { Limitmodel } from './limit.model';
import { TierLimitsModel } from './tier-limits.model';
import { UserModel } from '../../../modules/user/user.model';

export interface TierAttributes {
  id: string;
  label: string;
  context: string;
  createdAt: Date;
  updatedAt: Date;
}

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'tiers',
})
export class TierModel extends Model implements TierAttributes {
  @PrimaryKey
  @Column(DataType.UUIDV4)
  id: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  label: string;

  @Column(DataType.STRING)
  context: string;

  @Column
  createdAt: Date;

  @Column
  updatedAt: Date;

  @BelongsToMany(() => Limitmodel, {
    through: () => TierLimitsModel,
  })
  limits: Limitmodel[];

  @HasMany(() => UserModel, 'tierId')
  users?: UserModel[];
}
