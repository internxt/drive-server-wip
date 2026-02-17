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
  id: ReferralAttributes['id'];

  @AllowNull(false)
  @Unique
  @Column(DataType.STRING)
  key: ReferralAttributes['key'];

  @AllowNull(false)
  @Column(DataType.ENUM('storage'))
  type: ReferralAttributes['type'];

  @AllowNull(false)
  @Column(DataType.INTEGER)
  credit: ReferralAttributes['credit'];

  @AllowNull(false)
  @Column(DataType.INTEGER)
  steps: ReferralAttributes['steps'];

  @Default(true)
  @AllowNull(false)
  @Column(DataType.BOOLEAN)
  enabled: ReferralAttributes['enabled'];
}

interface ReferralsRepository {
  findOne: (
    where: Partial<ReferralAttributes>,
  ) => Promise<ReferralAttributes | null>;
  findAll: (
    where?: Partial<ReferralAttributes>,
  ) => Promise<ReferralAttributes[]>;
}

@Injectable()
export class SequelizeReferralRepository implements ReferralsRepository {
  constructor(
    @InjectModel(ReferralModel)
    private readonly model: typeof ReferralModel,
  ) {}

  findOne(
    where: Partial<ReferralAttributes>,
  ): Promise<ReferralAttributes | null> {
    return this.model.findOne({ where });
  }

  findAll(where?: Partial<ReferralAttributes>): Promise<ReferralAttributes[]> {
    return this.model.findAll(where ? { where } : {});
  }
}
