import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import {
  Column,
  Model,
  Table,
  PrimaryKey,
  DataType,
  Default,
  AutoIncrement,
  AllowNull,
  Unique,
} from 'sequelize-typescript';
import { ReferralAttributes } from './user.domain';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'referrals',
})
export class ReferralModel extends Model implements ReferralAttributes {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  @AllowNull(false)
  id: ReferralAttributes['id'];

  @Column(DataType.STRING)
  @Unique
  @AllowNull(false)
  key: ReferralAttributes['key'];

  @Column(DataType.ENUM('storage'))
  @AllowNull(false)
  type: ReferralAttributes['type'];

  @Column(DataType.INTEGER)
  @AllowNull(false)
  credit: ReferralAttributes['credit'];

  @Column(DataType.INTEGER)
  @AllowNull(false)
  steps: ReferralAttributes['steps'];

  @Column(DataType.BOOLEAN)
  @AllowNull(false)
  @Default(true)
  enabled: ReferralAttributes['enabled'];
}

export interface ReferralsRepository {
  findOne: (
    where: Partial<ReferralAttributes>,
  ) => Promise<ReferralAttributes | null>;
  findAll: (
    where?: Partial<ReferralAttributes>,
  ) => Promise<ReferralAttributes[]>;
}

@Injectable()
export class SequelizeUserRepository implements ReferralsRepository {
  constructor(
    @InjectModel(ReferralModel)
    private model: typeof ReferralModel,
  ) {}

  findOne(
    where: Partial<ReferralAttributes>,
  ): Promise<ReferralAttributes | null> {
    return this.model.findOne(where);
  }

  findAll(where?: Partial<ReferralAttributes>): Promise<ReferralAttributes[]> {
    return this.model.findAll(where ? { where } : {});
  }
}