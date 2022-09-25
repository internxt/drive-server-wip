import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import {
  AllowNull,
  AutoIncrement,
  Column,
  DataType,
  Default,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { ReferralModel } from './referrals.repository';
import { UserReferralAttributes } from './user.domain';
import { UserModel } from './user.repository';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'users_referrals',
})
export class UserReferralModel extends Model implements UserReferralAttributes {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  @AllowNull(false)
  id: UserReferralAttributes['id'];

  @Column(DataType.INTEGER)
  @ForeignKey(() => UserModel)
  userId: UserReferralAttributes['userId'];

  @Column(DataType.INTEGER)
  @ForeignKey(() => ReferralModel)
  referralId: UserReferralAttributes['referralId'];

  @Column(DataType.STRING)
  @AllowNull(true)
  referred: UserReferralAttributes['referred'];

  @Column(DataType.BOOLEAN)
  @AllowNull(false)
  @Default(false)
  applied: UserReferralAttributes['applied'];
}

export interface UserReferralsRepository {
}

@Injectable()
export class SequelizeUserRepository implements UserReferralsRepository {
  constructor(
    @InjectModel(UserReferralModel)
    private modelUser: typeof UserReferralModel,
  ) {}
}
